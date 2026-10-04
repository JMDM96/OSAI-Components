import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRelease, inspectRelease, readConfiguration, validateComponent } from './build.js';
import { proveCleanWorkspaceReproducibility } from './clean-workspaces.js';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { selectComponents } from './registry.js';
import { parseSelection } from './selection.js';
import { generateBindings } from './bindings.js';

export async function main(args: string[]): Promise<void> {
  const root = process.cwd();
  const command = args[0] ?? 'build';
  if (command === 'scaffold') {
    if (args.length !== 2) throw new Error('Usage: npm run scaffold -- <component-id>');
    const { scaffoldComponent } = await import('./scaffold.js');
    console.log(`Scaffolded ${await scaffoldComponent(root, args[1]!)}`);
    return;
  }
  const { selection, positional } = parseSelection(args.slice(1));
  if (
    command === 'preview' &&
    !selection.component &&
    !selection.all &&
    !selection.manifestFile &&
    process.env.OSAI_COMPONENT
  ) {
    selection.component = process.env.OSAI_COMPONENT;
    selection.fixtureManifests = JSON.parse(process.env.OSAI_FIXTURE_MANIFESTS ?? '[]') as string[];
  }
  if (
    ![
      'build',
      'validate',
      'inspect',
      'verify',
      'release',
      'preview',
      'reproduce',
      'native-plan',
    ].includes(command)
  )
    throw new Error(`Unknown command: ${command}`);
  if (
    positional.length > 1 ||
    (positional.length && !['validate', 'inspect', 'release'].includes(command))
  )
    throw new Error('Unexpected positional arguments.');
  if (command === 'validate' && positional[0]) selection.manifestFile = positional[0];
  if (['release', 'preview'].includes(command) && selection.all)
    throw new Error(`${command} requires one component.`);
  const components = await selectComponents(root, selection);
  if (command === 'release' && components.some((component) => component.fixture))
    throw new Error('Fixture-only components cannot enter the production release catalog.');
  for (const component of components) {
    if (command === 'native-plan') {
      const { saveNativePlans } = await import('./native-plan.js');
      const paths = await saveNativePlans(
        root,
        join(root, 'dist', component.manifest.componentId, component.manifest.version),
      );
      for (const path of paths)
        console.log(`Prepared native plan (tenant checkpoint not executed): ${path}`);
      continue;
    }
    const selected = {
      component: component.manifest.componentId,
      fixtureManifests: component.fixture
        ? [relative(root, component.manifestFile).replaceAll('\\', '/')]
        : [],
    };
    if (command === 'build') {
      await generateBindings(component.manifestFile, true);
      const release = await buildRelease(root, { selection: selected });
      console.log(
        `Built ${release.manifest.componentId}@${release.manifest.version}: ${release.root}`,
      );
      continue;
    }
    if (command === 'validate') {
      await generateBindings(component.manifestFile, true);
      const result = await validateComponent(root, component.manifestFile);
      console.log(`Valid component: ${result.manifest.componentId}@${result.manifest.version}`);
      continue;
    }
    if (command === 'inspect') {
      const config = await readConfiguration(root, selected);
      const folder = positional[0]
        ? resolve(positional[0])
        : join(root, 'dist', component.manifest.componentId, component.manifest.version);
      const stored = JSON.parse(
        await readFile(join(folder, config.targets[0]!, 'manifest.json'), 'utf8'),
      ) as { componentId: string };
      if (stored.componentId !== component.manifest.componentId)
        throw new Error('Inspection folder belongs to another component.');
      await inspectRelease(folder);
      console.log(`Checksums and adapters valid: ${folder}`);
      continue;
    }
    if (command === 'reproduce') {
      const result = await proveCleanWorkspaceReproducibility(root, {
        onProgress: console.log,
        selection: selected,
      });
      console.log(`Byte-identical clean workspaces: ${result.workspaces.join(' and ')}`);
      continue;
    }
    if (command === 'verify' || command === 'release') {
      const { verify } = await import('./verify.js');
      await verify(root, command === 'release', positional[0], selected);
      continue;
    }
    if (command === 'preview') {
      process.env.OSAI_COMPONENT = component.manifest.componentId;
      process.env.OSAI_FIXTURE_MANIFESTS = JSON.stringify(
        selection.fixtureManifests ?? selected.fixtureManifests,
      );
      await import(pathToFileURL(resolve(root, 'tests/browser-harness/server.ts')).href);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
