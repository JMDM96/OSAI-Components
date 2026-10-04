import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { discoverComponents, selectComponents } from './registry.js';

async function workspace(ids: string[]) {
  await mkdir('.build/registry-tests', { recursive: true });
  const root = await mkdtemp(resolve('.build/registry-tests/case-'));
  for (const [index, id] of ids.entries()) {
    const directory = join(root, 'components', String(index));
    await cp('tests/fixtures/minimal', directory, { recursive: true });
    const path = join(directory, 'component.manifest.json');
    const manifest = JSON.parse(await readFile(path, 'utf8')) as {
      componentId: string;
      themeTokens: object;
    };
    manifest.componentId = id;
    manifest.themeTokens = {};
    await writeFile(path, JSON.stringify(manifest));
  }
  await writeFile(join(root, 'build.config.json'), JSON.stringify({ component: ids[0] }));
  return root;
}
it('discovers deterministic IDs, preserves defaults and excludes unselected fixtures', async () => {
  const root = await workspace(['z-last', 'a-first']);
  expect((await discoverComponents(root)).map((item) => item.manifest.componentId)).toEqual([
    'a-first',
    'z-last',
  ]);
  expect((await selectComponents(root))[0]?.manifest.componentId).toBe('z-last');
  expect((await selectComponents(root, { all: true })).length).toBe(2);
  expect((await discoverComponents(process.cwd())).some((item) => item.fixture)).toBe(false);
  expect(
    (
      await selectComponents(process.cwd(), {
        component: 'minimal',
        fixtureManifests: ['tests/fixtures/minimal/component.manifest.json'],
      })
    )[0]?.fixture,
  ).toBe(true);
  expect(
    (
      await selectComponents(process.cwd(), {
        manifestFile: join(process.cwd(), 'tests/fixtures/minimal/component.manifest.json'),
      })
    )[0]?.manifest.componentId,
  ).toBe('minimal');
});
it('rejects duplicates, missing manifests, escaped paths and conflicting/unknown selectors', async () => {
  await expect(discoverComponents(await workspace(['duplicate', 'duplicate']))).rejects.toThrow(
    'Duplicate',
  );
  const root = await workspace(['valid']);
  await expect(selectComponents(root, { component: 'unknown' })).rejects.toThrow();
  await expect(selectComponents(root, { component: 'valid', all: true })).rejects.toThrow(
    'selector',
  );
  await expect(selectComponents(root, { manifestFile: '../outside.json' })).rejects.toThrow();
  await expect(discoverComponents(root, ['../fixture.json'])).rejects.toThrow('Fixtures');
  const path = join(root, 'components/0/component.manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8')) as { targets: string[]; entry: string };
  manifest.targets = ['odc'];
  await writeFile(path, JSON.stringify(manifest));
  await expect(selectComponents(root, { target: 'o11-reactive' })).rejects.toThrow(
    'Unsupported target',
  );
  manifest.entry = '../../../outside.ts';
  await writeFile(path, JSON.stringify(manifest));
  await expect(discoverComponents(root)).rejects.toThrow();
  const missing = await workspace(['valid']);
  await mkdir(join(missing, 'components/missing'));
  await expect(discoverComponents(missing)).rejects.toThrow();
});
