import { expect, it } from 'vitest';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  assertReviewedReferences,
  executionMetadata,
  referenceFiles,
  snapshotTemplate,
  validateExecutionMetadata,
  visualCollectionArguments,
  visualDigest,
  visualHost,
  visualInputs,
} from './visual-host.js';

it('selects only the actual supported host and preserves the original Windows paths', () => {
  expect(snapshotTemplate(visualHost('win32', 'x64'))).toBe(
    '{testDir}/baselines/{projectName}/{arg}{ext}',
  );
  expect(snapshotTemplate(visualHost('darwin', 'arm64'))).toBe(
    '{testDir}/baselines/darwin-arm64/{projectName}/{arg}{ext}',
  );
  for (const [os, cpu] of [
    ['linux', 'x64'],
    ['darwin', 'x64'],
    ['win32', 'arm64'],
  ])
    expect(() => visualHost(os, cpu)).toThrow('No host fallback');
});

it('collects tagged descriptor, palette and workbench visuals with no host overrides', async () => {
  expect(visualCollectionArguments([])).toEqual([
    'test',
    '--grep',
    '@visual',
    '--update-snapshots=all',
  ]);
  expect(() => visualCollectionArguments(['--project=odc-chromium'])).toThrow('no overrides');
  const shared = await readFile('tests/browser/shared.spec.ts', 'utf8');
  expect(shared).toContain("scenario.kind === 'visual'");
  for (const file of ['shared', 'pipeline', 'workbench'])
    expect(await readFile(`tests/browser/${file}.spec.ts`, 'utf8')).toContain("'@visual'");
  expect(await readFile('playwright.config.ts', 'utf8')).toContain(
    "updateSnapshots: collection ? 'all' : 'none'",
  );
});

it('binds all hosts and reviews, detects missing/tampered references without writing them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'osai-visual-inputs-'));
  for (const file of [
    'packages/build-tools/src/visual-host.ts',
    'tests/workflows/visual-review-v1.json',
  ]) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await cp(file, join(root, file));
  }
  await cp('tests/browser/baselines', join(root, 'tests/browser/baselines'), { recursive: true });
  const before = visualDigest(root);
  const windows = referenceFiles(root, 'win32-x64');
  const file = join(root, windows[0]!.path);
  assertReviewedReferences(root, 'win32-x64');
  const bytes = await readFile(file);
  await writeFile(file, 'tampered');
  expect(visualDigest(root)).not.toBe(before);
  expect(() => assertReviewedReferences(root, 'win32-x64')).toThrow('stale');
  await rm(file);
  expect(() => assertReviewedReferences(root, 'win32-x64')).toThrow('Missing');
  await expect(readFile(file)).rejects.toThrow('ENOENT');
  await writeFile(file, bytes);
  expect(visualDigest(root)).toBe(before);
  const review = join(root, 'tests/browser/baselines/reviews/win32-x64.json');
  await writeFile(
    review,
    (await readFile(review, 'utf8')).replace('integrity migration', 'modified review'),
  );
  expect(visualDigest(root)).not.toBe(before);
  expect(referenceFiles(root, 'win32-x64')).toEqual(windows);
});

it('validates recorded host metadata independently of the inspecting machine', () => {
  const root = process.cwd();
  const inputs = visualInputs(root);
  const windows = {
    ...executionMetadata(root),
    platform: 'win32',
    architecture: 'x64',
    referenceSet: 'win32-x64',
    osRelease: '10.0',
    osVersion: 'Windows (synthetic validator input)',
  };
  expect(() => validateExecutionMetadata(root, windows)).not.toThrow();
  expect(visualInputs(root)).toEqual(inputs);
  for (const invalid of [
    undefined,
    { ...windows, referenceSet: 'darwin-arm64' },
    { ...windows, baselineDigest: 'stale' },
    { ...windows, browsers: [] },
    { ...windows, purpose: 'reference-collection' },
    { ...windows, osVersion: '' },
  ])
    expect(() => validateExecutionMetadata(root, invalid)).toThrow();
});
