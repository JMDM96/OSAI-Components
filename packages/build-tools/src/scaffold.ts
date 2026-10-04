import { cp, mkdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { format } from 'prettier';
import { generateBindings } from './bindings.js';
import { discoverComponents } from './registry.js';

/** Creates component-owned files; only workspace metadata is registered centrally. */
export async function scaffoldComponent(root: string, id: string): Promise<string> {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))
    throw new Error('Use a kebab-case component identifier.');
  if ((await discoverComponents(root)).some((item) => item.manifest.componentId === id))
    throw new Error('Component already exists.');
  const destination = resolve(root, 'components', id);
  try {
    await access(destination);
    throw new Error('Scaffold destination already exists.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const source = resolve(root, 'tests/fixtures/minimal');
  const packageMetadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    workspaces: string[];
  };
  if (!packageMetadata.workspaces.includes('components/*'))
    throw new Error('Workspace must discover components/*.');
  const configPath = join(root, 'tsconfig.json');
  const project = JSON.parse(await readFile(configPath, 'utf8')) as {
    references: { path: string }[];
  };
  if (!Array.isArray(project.references)) throw new Error('Project references are unavailable.');
  // Stage outside discovery so a partial file copy is never a registered component.
  const staging = join(root, '.build/scaffolds', id);
  await mkdir(dirname(staging), { recursive: true });
  try {
    await access(staging);
    throw new Error('A previous scaffold staging directory needs inspection.');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await cp(source, staging, { recursive: true });
  const json = async (file: string, value: unknown) =>
    writeFile(
      join(staging, file),
      await format(JSON.stringify(value), { parser: 'json', printWidth: 100 }),
    );
  const manifest = JSON.parse(await readFile(join(staging, 'component.manifest.json'), 'utf8')) as {
    componentId: string;
    version: string;
    themeTokens: Record<string, unknown>;
  };
  manifest.componentId = id;
  manifest.version = '0.1.0';
  manifest.themeTokens = Object.fromEntries(
    Object.entries(manifest.themeTokens).map(([name, value]) => [
      name.replace('minimal', id),
      value,
    ]),
  );
  await json('component.manifest.json', manifest);
  await json('package.json', {
    name: `@osai/${id}`,
    version: '0.1.0',
    private: true,
    type: 'module',
    license: 'UNLICENSED',
    exports: { '.': './src/index.ts' },
    dependencies: { '@osai/component-sdk': '1.0.0', '@osai/contract-schemas': '1.0.0' },
  });
  const cssPath = join(staging, 'src/styles.css');
  await writeFile(cssPath, (await readFile(cssPath, 'utf8')).replaceAll('minimal', id));
  await json('tsconfig.json', {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      outDir: `../../.build/components/${id}`,
      rootDir: '.',
      tsBuildInfoFile: `../../.build/${id}.tsbuildinfo`,
    },
    include: ['src/**/*.ts', '*.json', 'schemas/**/*.json'],
    exclude: ['**/*.test.ts'],
    references: [
      { path: '../../packages/component-sdk' },
      { path: '../../packages/contract-schemas' },
    ],
  });
  await json('sample-input.json', { label: 'Hello' });
  await json('certification.json', {
    schemaVersion: '1.0',
    componentId: id,
    profile: { id: 'base-ui', version: '1.0.0' },
    scenarioModule: 'certification/scenarios.ts',
    validConfiguration: { label: 'Hello' },
    invalidConfigurations: [{ label: 42 }],
    scenarios: [
      { id: 'command-read', kind: 'command', member: 'read' },
      { id: 'event-read', kind: 'event', member: 'read' },
      { id: 'accessible', kind: 'accessibility', member: 'root' },
      { id: 'default', kind: 'visual', member: 'default' },
    ],
  });
  await mkdir(join(staging, 'certification'), { recursive: true });
  await writeFile(
    join(staging, 'certification/scenarios.ts'),
    `import type { ScenarioDriver } from '@osai/component-sdk/certification';
export const scenarios = {
  'command-read'(driver: ScenarioDriver) { driver.assert(driver.invoke('read', {}) === 'Hello', 'Read returns label'); },
  async 'event-read'(driver: ScenarioDriver) { driver.invoke('read', {}); await driver.flush(); driver.assert(driver.events().some(event => event.name === 'read'), 'Read event delivered'); },
  accessible(driver: ScenarioDriver) { driver.assert(driver.root.textContent === 'Hello', 'Visible label'); },
  default(driver: ScenarioDriver) { driver.assert(driver.root.textContent === 'Hello', 'Default visual state'); },
};
`,
  );
  await generateBindings(join(staging, 'component.manifest.json'));
  await rename(staging, destination);
  project.references.push({ path: `components/${id}` });
  await writeFile(
    configPath,
    await format(JSON.stringify(project), { parser: 'json', printWidth: 100 }),
  );
  const npm =
    process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  await promisify(execFile)(
    process.execPath,
    [npm, 'install', '--package-lock-only', '--ignore-scripts', '--offline'],
    { cwd: root, windowsHide: true },
  );
  return destination;
}
