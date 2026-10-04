import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { componentManifest } from '@osai/command-palette';
import { compileAssets, mergeGraphs } from './asset-graph.js';
import { dependencyInventory } from './dependency.js';
import { loadPolicy } from './policy.js';

async function fixture(
  source: string,
  path = 'nested/worker.js',
  type: 'worker' | 'style' | 'data' = 'worker',
) {
  const root = await mkdtemp(join(tmpdir(), 'osai-graph-'));
  const directory = join(root, 'components/graph');
  await mkdir(join(directory, 'nested'), { recursive: true });
  await writeFile(join(directory, path), source);
  const manifest = structuredClone(componentManifest);
  manifest.assets = [{ path, type }];
  manifest.capabilities.workers = type === 'worker' ? [path] : [];
  return { root, directory, manifest };
}
it.each([
  ['eval("secret")', 'nested/worker.js', 'worker', /security scan/],
  ['fetch("https://unlisted.invalid")', 'nested/worker.js', 'worker', /security scan/],
  ['import(missing)', 'nested/worker.js', 'worker', /security scan/],
  ['import "./absent.js"', 'nested/worker.js', 'worker', /resolve/],
  ['anything', 'nested/worker.wasm', 'worker', /format/],
  ['eval("hidden")', 'nested/hidden.js', 'data', /Unsupported/],
  ['.x{background:url(https://unlisted.invalid/a.png)}', 'nested/other.css', 'style', /style scan/],
] as const)('rejects unsafe auxiliary %s', async (source, path, type, expected) => {
  const setup = await fixture(source, path, type);
  await expect(
    compileAssets(setup.root, setup.directory, setup.manifest, 'OSAI.Components.v1'),
  ).rejects.toThrow(expected);
});
it('governs worker-only transitive packages and rejects missing license metadata', async () => {
  const setup = await fixture(
    'import {run} from "direct"; self.addEventListener("message", () => self.postMessage(run()));',
  );
  const packages = {
    'components/graph': {
      name: '@osai/graph',
      version: '1.0.0',
      license: 'UNLICENSED',
      private: true,
    },
    'node_modules/direct': {
      name: 'direct',
      version: '1.0.0',
      license: 'MIT',
      main: 'index.js',
      dependencies: { transitive: '1.0.0' },
    },
    'node_modules/transitive': {
      name: 'transitive',
      version: '1.0.0',
      license: 'MIT',
      main: 'index.js',
    },
  };
  for (const [path, metadata] of Object.entries(packages)) {
    await mkdir(join(setup.root, path), { recursive: true });
    await writeFile(join(setup.root, path, 'package.json'), JSON.stringify(metadata));
    await writeFile(join(setup.root, path, 'LICENSE'), 'MIT licensed fixture');
  }
  await writeFile(join(setup.root, 'package-lock.json'), JSON.stringify({ packages }));
  await writeFile(
    join(setup.root, 'node_modules/direct/index.js'),
    'export {run} from "transitive";',
  );
  await writeFile(join(setup.root, 'node_modules/transitive/index.js'), 'export const run=()=>42;');
  setup.manifest.dependencies = [
    { name: 'direct', version: '1.0.0', license: 'MIT', bundled: true },
  ];
  const graph = await compileAssets(
    setup.root,
    setup.directory,
    setup.manifest,
    'OSAI.Components.v1',
  );
  expect(graph.assets[0]!.integrity).toMatch(/^sha256-/);
  expect(graph.assets[0]!.gzipBytes).toBeGreaterThan(0);
  const policy = await loadPolicy(join(process.cwd(), 'release-policy.json'));
  const inventory = await dependencyInventory(
    setup.root,
    mergeGraphs(graph.graphs),
    setup.manifest,
    policy,
  );
  expect(inventory.find((item) => item.name === 'transitive')?.relationship).toBe('transitive');
  const lock = JSON.parse(await readFile(join(setup.root, 'package-lock.json'), 'utf8'));
  delete lock.packages['node_modules/transitive'].license;
  await writeFile(join(setup.root, 'package-lock.json'), JSON.stringify(lock));
  await expect(
    dependencyInventory(setup.root, mergeGraphs(graph.graphs), setup.manifest, policy),
  ).rejects.toThrow('incomplete');
});
