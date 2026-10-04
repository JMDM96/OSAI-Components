import { beforeAll, describe, expect, it } from 'vitest';
import { cp, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease, inspectRelease } from './build.js';
import { payloadChecksums, writeJson } from './release.js';
import { targetProfile } from './bundler.js';

let original: string;
beforeAll(async () => {
  original = (
    await buildRelease(process.cwd(), {
      outputRoot: await mkdtemp(join(tmpdir(), 'osai-inspection-original-')),
    })
  ).root;
}, 30_000);

async function fixture(): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), 'osai-inspection-case-')), 'payload');
  await cp(original, root, { recursive: true });
  return root;
}

// Deliberately rehash corrupted fixtures: inspection must enforce contracts independently
// of a self-consistent checksum map. Production releases are never edited by these tests.
async function rehash(root: string): Promise<void> {
  const release = JSON.parse(await readFile(join(root, 'shared/release.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const checksums = await payloadChecksums(root);
  await writeJson(join(root, 'shared/release.json'), { ...release, checksums });
  await writeFile(
    join(root, 'shared/checksums.sha256'),
    Object.entries(checksums)
      .map(([path, hash]) => `${hash}  ${path}`)
      .join('\n') + '\n',
  );
}

describe('independent packaged contract inspection', () => {
  it('accepts a complete original release and safe recorded compile-time target overrides', async () => {
    await expect(inspectRelease(original)).resolves.toBeUndefined();
    const root = await fixture();
    await writeJson(
      join(root, 'odc/target.json'),
      targetProfile('odc', {
        rationale: 'Documented target-specific host constant.',
        defines: { OSAI_BUILD_HOST: 'odc' },
      }),
    );
    await rehash(root);
    await expect(inspectRelease(root)).resolves.toBeUndefined();
  });

  it.each([
    'schemas/config.schema.json',
    'schemas/command-open-arguments.schema.json',
    'schemas/command-open-result.schema.json',
    'schemas/event-commandSelected.schema.json',
  ])('rejects changed %s even with regenerated checksums', async (file) => {
    const root = await fixture();
    await writeJson(join(root, 'odc', file), { type: 'string' });
    await rehash(root);
    await expect(inspectRelease(root)).rejects.toThrow('schema');
  });

  it.each(['integration.md', 'mentor-recipe.json', 'adapter.json', 'csp.json', 'target.json'])(
    'rejects generated %s contract drift even with regenerated checksums',
    async (file) => {
      const root = await fixture();
      await writeFile(
        join(root, 'odc', file),
        file.endsWith('.json') ? '{}' : 'Outdated instructions.',
      );
      await rehash(root);
      await expect(inspectRelease(root)).rejects.toThrow();
    },
  );

  it.each(['schemas/command-retired-result.schema.json', 'stale.js', 'shared/stale.json'])(
    'rejects a stale or unlisted %s file even when present in the checksum map',
    async (file) => {
      const root = await fixture();
      await writeFile(join(root, file.startsWith('shared/') ? file : `odc/${file}`), '{}');
      await rehash(root);
      await expect(inspectRelease(root)).rejects.toThrow('payload file inventory');
    },
  );

  it.each([
    'odc/command-palette.css',
    'shared/component.mjs',
    'odc/schemas/command-open-result.schema.json',
  ])('rejects missing required %s after checksum regeneration', async (file) => {
    const root = await fixture();
    await rename(join(root, file), join(root, '..', 'retained-missing-fixture'));
    await rehash(root);
    await expect(inspectRelease(root)).rejects.toThrow();
  });

  it('rejects changed types, inconsistent manifests, identities and checksum indexes', async () => {
    const types = await fixture();
    await writeFile(join(types, 'shared/types/index.d.ts'), 'export interface Wrong {}\n');
    await rehash(types);
    await expect(inspectRelease(types)).rejects.toThrow('TypeScript declarations');

    const manifests = await fixture();
    const manifest = JSON.parse(
      await readFile(join(manifests, 'o11-reactive/manifest.json'), 'utf8'),
    ) as Record<string, unknown>;
    manifest.entry = 'src/other.ts';
    await writeJson(join(manifests, 'o11-reactive/manifest.json'), manifest);
    await rehash(manifests);
    await expect(inspectRelease(manifests)).rejects.toThrow('cross-target manifest');

    const identity = await fixture();
    const release = JSON.parse(
      await readFile(join(identity, 'shared/release.json'), 'utf8'),
    ) as Record<string, unknown>;
    release.version = '99.0.0';
    await writeJson(join(identity, 'shared/release.json'), release);
    await expect(inspectRelease(identity)).rejects.toThrow('identity');

    const index = await fixture();
    await writeFile(
      join(index, 'shared/checksums.sha256'),
      '0'.repeat(64) + '  odc/command-palette.js\n',
    );
    await expect(inspectRelease(index)).rejects.toThrow('checksums.sha256');
  });

  it.each([
    { overrides: [{ rationale: 'Unsafe key', defines: { 'process.env.NODE_ENV': 'production' } }] },
    { overrides: [{ rationale: 'Unknown metadata', defines: {}, hidden: true }] },
    { overrides: [{ rationale: 'Malformed', defines: [] }] },
    { overrides: [], scriptFormat: 'esm' },
  ])('rejects altered target metadata %#', async (changes) => {
    const root = await fixture();
    await writeJson(join(root, 'odc/target.json'), { ...targetProfile('odc'), ...changes });
    await rehash(root);
    await expect(inspectRelease(root)).rejects.toThrow();
  });

  it('rejects unnormalized packaged schema references and unsafe release targets', async () => {
    const root = await fixture();
    const manifest = JSON.parse(await readFile(join(root, 'odc/manifest.json'), 'utf8')) as {
      commands: Record<string, { result: unknown }>;
    };
    manifest.commands.open!.result = { $ref: './undeclared.schema.json' };
    await writeJson(join(root, 'odc/manifest.json'), manifest);
    await rehash(root);
    await expect(inspectRelease(root)).rejects.toThrow('normalized manifest');
    const release = JSON.parse(await readFile(join(root, 'shared/release.json'), 'utf8')) as Record<
      string,
      unknown
    >;
    release.targets = ['../outside', 'odc'];
    await writeJson(join(root, 'shared/release.json'), release);
    await expect(inspectRelease(root)).rejects.toThrow('supported bootstrap targets');
  });
});
