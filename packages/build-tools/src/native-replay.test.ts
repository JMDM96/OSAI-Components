import { expect, it } from 'vitest';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease } from './build.js';
import { prepareReplayBundles } from './native-replay.js';
import { inspectNativeRun, nativeRunCommand } from './native-run.js';
import { checksum } from './release.js';
it('replays six relocated supplied-state bundles without tenant calls', async () => {
  const base = await mkdtemp(join(tmpdir(), 'osai-replay-test-'));
  const release = await buildRelease(process.cwd(), { outputRoot: join(base, 'package') });
  const bundles = await prepareReplayBundles(release.root, join(base, 'fixtures'));
  const expected: Record<string, string> = {
    'manual-import': 'inspect-native-source-and-wiring',
    'quota-pause': 'quota-checkpoint',
    'partial-mutation': 'fresh-read-back-required',
    'conflicting-source': 'resolve-native-conflict',
    'missing-evidence': 'restore-missing-evidence',
    'unchanged-rerun': 'native-state-unchanged',
  };
  for (const [name, path] of Object.entries(bundles)) {
    const relocated = join(base, `relocated-${name}`);
    await cp(join(path, '..'), relocated, { recursive: true });
    const result = await inspectNativeRun(join(relocated, 'run.json'));
    expect(result.continuation.next, name).toBe(expected[name]);
    expect(result.continuation.nativeQualified).toBe(false);
    if (name === 'quota-pause')
      expect(
        await nativeRunCommand(['inspect', '--record', join(relocated, 'run.json')]),
      ).toMatchObject({
        continuation: { attempts: [{ id: 'quota-1', operation: 'publish', outcome: 'quota' }] },
      });
    if (name === 'conflicting-source')
      expect(
        await nativeRunCommand(['inspect', '--record', join(relocated, 'run.json')]),
      ).toMatchObject({
        continuation: {
          conflicts: [
            { key: 'source:RegisterResources', nativeId: 'synthetic-source:RegisterResources' },
          ],
        },
      });
    if (name === 'unchanged-rerun') expect(result.continuation.conflicts).toEqual([]);
    if (name === 'missing-evidence') expect(result.continuation.conflicts).toBeNull();
  }
  const path = bundles['unchanged-rerun']!;
  const run = JSON.parse(await readFile(path, 'utf8'));
  const evidence = run.evidence.find((e: { id: string }) => e.id === 'read-back');
  const observed = JSON.parse(await readFile(join(path, '..', evidence.path), 'utf8'));
  observed.identity.revision = 'other';
  const bytes = JSON.stringify(observed);
  await writeFile(join(path, '..', evidence.path), bytes);
  evidence.sha256 = checksum(bytes);
  await writeFile(path, JSON.stringify(run));
  expect((await inspectNativeRun(path)).problems.join()).toContain('revision conflict');
});
