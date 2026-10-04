import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { generateBindings } from './bindings.js';

it('detects schema drift without writing and regenerates byte-identical bindings', async () => {
  await mkdir('.build/binding-drift', { recursive: true });
  const root = await mkdtemp(resolve('.build/binding-drift/case-'));
  await cp('tests/fixtures/minimal', root, { recursive: true });
  const manifest = join(root, 'component.manifest.json');
  const path = await generateBindings(manifest);
  const original = await readFile(path, 'utf8');
  await generateBindings(manifest);
  expect(await readFile(path, 'utf8')).toBe(original);
  await expect(generateBindings(manifest, true)).resolves.toBe(path);
  const schemaPath = join(root, 'schemas/label.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as { maxLength?: number };
  schema.maxLength = 400;
  await writeFile(schemaPath, JSON.stringify(schema));
  await expect(generateBindings(manifest, true)).rejects.toThrow('npm run bindings');
  expect(await readFile(path, 'utf8')).toBe(original);
  await generateBindings(manifest);
  expect(await readFile(path, 'utf8')).not.toBe(original);
  await expect(generateBindings(manifest, true)).resolves.toBe(path);
});
