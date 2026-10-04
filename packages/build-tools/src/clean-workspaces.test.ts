import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { prepareCleanWorkspace } from './clean-workspaces.js';

it('clean copies contain source and pinned lockfiles but no caches, credentials or generated output', async () => {
  const base = await mkdtemp(join(tmpdir(), 'osai-clean-copy-test-'));
  const source = join(base, 'source');
  const target = join(base, 'target');
  await mkdir(join(source, 'packages/example/node_modules/dependency'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json', 'build.config.json'])
    await writeFile(join(source, file), '{}');
  await writeFile(join(source, '.env'), 'secret');
  await writeFile(join(source, 'packages/example/source.ts'), 'export const value = 1;');
  await writeFile(join(source, 'packages/example/node_modules/dependency/cache.js'), 'generated');
  await mkdir(join(source, 'dist'));
  await writeFile(join(source, 'dist/output.js'), 'generated');
  await prepareCleanWorkspace(source, target);
  expect(await readFile(join(target, 'packages/example/source.ts'), 'utf8')).toContain('value');
  expect(await readdir(target)).toEqual(expect.arrayContaining(['packages', 'package-lock.json']));
  expect(await readdir(target)).not.toEqual(expect.arrayContaining(['.env', 'dist']));
  expect(await readdir(join(target, 'packages/example'))).toEqual(['source.ts']);
  await expect(prepareCleanWorkspace(source, target)).rejects.toThrow('empty');
  await expect(prepareCleanWorkspace(source, join(source, 'nested'))).rejects.toThrow('separate');
});
