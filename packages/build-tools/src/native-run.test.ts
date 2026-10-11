import { beforeAll, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, cp, rm, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease } from './build.js';
import { generateNativePlan } from './native-plan.js';
import {
  initNativeRun,
  exportNativeRun,
  inspectNativeRun,
  validateNativeRun,
  assertExportSafe,
  nativeRunCommand,
  continuation,
} from './native-run.js';
import type { NativeRun, RunOutcome } from './native-run.js';
import { checksum } from './release.js';
let base: string;
beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), 'osai-run-'));
  const built = await buildRelease(process.cwd(), { outputRoot: join(base, 'package') });
  const plan = await generateNativePlan(built.root, 'odc');
  await writeFile(join(base, 'prepared-plan.json'), JSON.stringify(plan));
  await initNativeRun(join(base, 'prepared-plan.json'), built.root, join(base, 'original'));
});
async function example() {
  const root = await mkdtemp(join(tmpdir(), 'osai-run-example-'));
  await cp(join(base, 'original'), root, { recursive: true });
  return { root, run: JSON.parse(await readFile(join(root, 'run.json'), 'utf8')) as NativeRun };
}
async function save(root: string, run: NativeRun) {
  await writeFile(join(root, 'run.json'), JSON.stringify(run));
  return join(root, 'run.json');
}
async function attachment(
  root: string,
  run: NativeRun,
  data: string,
  kind: NativeRun['evidence'][number]['kind'] = 'observation',
) {
  await writeFile(join(root, 'evidence.json'), data);
  run.evidence.push({
    id: 'observation',
    path: 'evidence.json',
    sha256: checksum(data),
    kind,
    assetId: null,
    complete: true,
    redacted: false,
  });
}
it('exports only an allowlisted validated bundle, relocates and never overwrites', async () => {
  const { root, run } = await example();
  await attachment(root, run, '{"observation":"synthetic manual resource inspection"}');
  run.transfer = { route: 'manual', status: 'inspected', evidence: ['observation'] };
  run.native.appKey = 'synthetic-app';
  run.native.envKey = 'synthetic-env';
  const record = await save(root, run);
  const before = await readFile(record);
  expect(
    ((await nativeRunCommand(['inspect', '--record', record])) as { valid: boolean }).valid,
  ).toBe(true);
  expect(await readFile(record)).toEqual(before);
  await writeFile(join(root, 'unlisted-private-notes.txt'), 'excluded');
  const exported = join(base, 'exported');
  await exportNativeRun(record, exported);
  await expect(access(join(exported, 'unlisted-private-notes.txt'))).rejects.toThrow();
  const relocated = join(await mkdtemp(join(tmpdir(), 'osai-relocated-')), 'bundle');
  await cp(exported, relocated, { recursive: true });
  expect((await validateNativeRun(join(relocated, 'run.json'))).continuation.next).toBe(
    'inspect-native-source-and-wiring',
  );
  await expect(exportNativeRun(record, exported)).rejects.toThrow();
  expect(await nativeRunCommand(['--help'])).toContain('--record');
  await expect(nativeRunCommand(['validate', '--unknown', record])).rejects.toThrow('native-run');
});
it('rejects secrets before persistence, unsafe paths, symlinks, missing and changed evidence', async () => {
  for (const text of [
    '{"access_token":"fixture-secret"}',
    '{"sessionId":"opaque-secret"}',
    '{"cookie":"sensitive"}',
    'Authorization: Bearer fixture-secret',
    'https://host/cb?code=fixture-secret&state=opaque',
    'https://host/a?X-Amz-Signature=signed',
  ])
    expect(() => assertExportSafe(Buffer.from(text))).toThrow('Sensitive');
  const { root, run } = await example();
  await attachment(root, run, 'safe');
  await save(root, run);
  await writeFile(join(root, 'evidence.json'), 'changed');
  expect((await inspectNativeRun(join(root, 'run.json'))).valid).toBe(false);
  await rm(join(root, 'evidence.json'));
  expect((await inspectNativeRun(join(root, 'run.json'))).continuation.next).toBe(
    'restore-missing-evidence',
  );
  await symlink(join(base, 'prepared-plan.json'), join(root, 'evidence.json'));
  expect((await inspectNativeRun(join(root, 'run.json'))).problems.join()).toContain('symlinks');
  run.evidence[0]!.path = '../outside';
  await save(root, run);
  expect((await inspectNativeRun(join(root, 'run.json'))).problems.join()).toContain('relative');
  run.evidence[0]!.path = 'evidence.json';
  await rm(join(root, 'evidence.json'));
  await writeFile(join(root, 'evidence.json'), 'Cookie: secret');
  run.evidence[0]!.sha256 = checksum('Cookie: secret');
  await save(root, run);
  const destination = join(base, 'unsafe-export');
  await expect(exportNativeRun(join(root, 'run.json'), destination)).rejects.toThrow('Sensitive');
  await expect(access(destination)).rejects.toThrow();
});
it('rejects false readiness, format/identity drift and redacted complete source', async () => {
  for (const alter of [
    (r: NativeRun) => (r.assetIdentity = 'exact'),
    (r: NativeRun) => (r.readiness = 'preview-observed'),
    (r: NativeRun) => (r.package.version = 'wrong'),
    (r: NativeRun) => (r.transfer = { route: 'document', status: 'inspected', evidence: [] }),
  ]) {
    const { root, run } = await example();
    alter(run);
    await expect(validateNativeRun(await save(root, run))).rejects.toThrow();
  }
  const { root, run } = await example();
  await attachment(root, run, '{}', 'read-back');
  run.evidence[0]!.redacted = true;
  await expect(validateNativeRun(await save(root, run))).rejects.toThrow('redacted-source');
  await writeFile(join(root, 'run.json'), JSON.stringify({ ...run, target: 'o11-reactive' }));
  await expect(validateNativeRun(join(root, 'run.json'))).rejects.toThrow('schema');
  await writeFile(join(root, 'run.json'), JSON.stringify({ ...run, secret: 'unknown-field' }));
  await expect(validateNativeRun(join(root, 'run.json'))).rejects.toThrow('schema');
});
it('preserves independent outcomes, edits before failure and ambiguous releases', async () => {
  const { run } = await example();
  expect(continuation(run).next).toBe('resolve-native-identities');
  run.native.appKey = 'a';
  run.native.envKey = 'e';
  run.transfer = { route: 'manual', status: 'inspected', evidence: ['inspection'] };
  const event = (
    stage: RunOutcome['stage'],
    status: RunOutcome['status'],
    revision: string | null = null,
  ): RunOutcome => ({
    operation: stage,
    stage,
    status,
    revision,
    nativeId: null,
    evidence: ['observation'],
    mutationPossible: false,
  });
  run.outcomes = [event('run', 'succeeded'), event('publication', 'failed')];
  expect(continuation(run)).toMatchObject({
    publication: 'failed',
    deployment: 'not-started',
    next: 'diagnose-publication',
  });
  run.outcomes = [{ ...event('run', 'failed'), mutationPossible: true }];
  expect(continuation(run).next).toBe('fresh-read-back-required');
  run.outcomes = [event('library-release', 'succeeded')];
  expect(continuation(run).next).toBe('inspect-library-release');
  run.outcomes = [event('publication', 'succeeded', 'r2'), event('deployment', 'succeeded', 'r1')];
  expect(continuation(run).next).toBe('deploy-published-revision');
});

it('reconciles a confirmed library release without inventing an application deployment', async () => {
  const { run } = await example();
  run.native.appKey = 'library';
  run.native.envKey = 'development';
  run.transfer = { route: 'manual', status: 'inspected', evidence: ['inspection'] };
  const published: RunOutcome = {
    operation: 'publish-library',
    stage: 'publication',
    status: 'succeeded',
    revision: 'r2',
    nativeId: 'library',
    evidence: ['publication'],
    mutationPossible: false,
  };
  const released: RunOutcome = {
    ...published,
    operation: 'release-library',
    stage: 'library-release',
    evidence: ['release'],
  };
  run.outcomes = [published, released];
  expect(continuation(run)).toMatchObject({
    next: 'inspect-native-source-and-wiring',
    deployment: 'not-started',
  });
  run.readBack = { evidence: 'readback', afterOperation: 'release-library' };
  expect(continuation(run).next).toBe('reconcile-complete-read-back');
  for (const change of [
    { revision: 'r1' },
    { revision: null },
    { nativeId: 'other-library' },
    { status: 'failed' as const },
  ]) {
    run.outcomes = [published, { ...released, ...change }];
    expect(continuation(run).next).toBe('deploy-published-revision');
  }
});
