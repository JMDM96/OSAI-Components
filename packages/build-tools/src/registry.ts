import { readdir, realpath, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { loadManifest } from '@osai/contract-schemas/authoring';
import type { ComponentManifest, Target } from '@osai/contract-schemas';

export interface RegisteredComponent {
  manifest: ComponentManifest;
  manifestFile: string;
  directory: string;
  fixture: boolean;
}
export interface ComponentSelection {
  component?: string;
  all?: boolean;
  manifestFile?: string;
  fixtureManifests?: string[];
  target?: Target;
}
export async function containedPath(root: string, path: string): Promise<string> {
  const [base, candidate] = await Promise.all([realpath(root), realpath(resolve(root, path))]);
  const rel = relative(base, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error('Component paths must remain inside their allowed root.');
  return candidate;
}

export async function discoverComponents(
  root: string,
  fixtureManifests: string[] = [],
): Promise<RegisteredComponent[]> {
  const candidates: { path: string; fixture: boolean }[] = [];
  let entries: Dirent[];
  try {
    entries = await readdir(resolve(root, 'components'), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    entries = [];
  }
  for (const entry of entries.filter((entry) => entry.isDirectory() || entry.isSymbolicLink()))
    candidates.push({ path: `components/${entry.name}/component.manifest.json`, fixture: false });
  for (const path of fixtureManifests) {
    const normalized = path.replaceAll('\\', '/');
    if (
      isAbsolute(path) ||
      !normalized.startsWith('tests/fixtures/') ||
      normalized.split('/').includes('..')
    )
      throw new Error(
        'Fixtures require explicit repository-relative manifests under tests/fixtures.',
      );
    candidates.push({ path: normalized, fixture: true });
  }
  const found: RegisteredComponent[] = [];
  const ids = new Set<string>();
  for (const candidate of candidates.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  )) {
    const manifestFile = await containedPath(root, candidate.path);
    await containedPath(
      resolve(root, candidate.fixture ? 'tests/fixtures' : 'components'),
      manifestFile,
    );
    const loaded = await loadManifest(manifestFile);
    if (!loaded.value)
      throw new Error(
        `Invalid registry manifest ${candidate.path}: ${JSON.stringify(loaded.diagnostics)}`,
      );
    const manifest = loaded.value;
    if (ids.has(manifest.componentId))
      throw new Error(`Duplicate component ID: ${manifest.componentId}`);
    ids.add(manifest.componentId);
    const directory = dirname(manifestFile);
    for (const path of [
      manifest.entry,
      ...manifest.styles,
      ...manifest.assets.filter((asset) => !asset.origin).map((asset) => asset.path),
    ])
      await containedPath(directory, path);
    found.push({ manifest, manifestFile, directory, fixture: candidate.fixture });
  }
  return found.sort((a, b) =>
    a.manifest.componentId < b.manifest.componentId
      ? -1
      : a.manifest.componentId > b.manifest.componentId
        ? 1
        : 0,
  );
}

export async function selectComponents(
  root: string,
  options: ComponentSelection = {},
): Promise<RegisteredComponent[]> {
  if (
    [Boolean(options.component), Boolean(options.all), Boolean(options.manifestFile)].filter(
      Boolean,
    ).length > 1
  )
    throw new Error('Use exactly one component selector.');
  const fixtures = [...(options.fixtureManifests ?? [])];
  const manifestPath = options.manifestFile
    ? relative(root, await containedPath(root, options.manifestFile)).replaceAll('\\', '/')
    : undefined;
  if (manifestPath?.startsWith('tests/fixtures/')) fixtures.push(manifestPath);
  const registry = await discoverComponents(root, [...new Set(fixtures)]);
  let selected = registry;
  if (options.manifestFile) {
    const wanted = await containedPath(root, options.manifestFile);
    selected = registry.filter((item) => item.manifestFile === wanted);
  } else if (!options.all) {
    const id =
      options.component ??
      (
        JSON.parse(await readFile(resolve(root, 'build.config.json'), 'utf8')) as {
          component: string;
        }
      ).component;
    selected = registry.filter((item) => item.manifest.componentId === id);
  }
  if (!selected.length) throw new Error('No registered component matches the selection.');
  for (const item of selected)
    if (options.target && !item.manifest.targets.includes(options.target))
      throw new Error(`Unsupported target for ${item.manifest.componentId}: ${options.target}`);
  return selected;
}
