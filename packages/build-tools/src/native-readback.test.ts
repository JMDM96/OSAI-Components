import { beforeAll, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease } from './build.js';
import { generateNativePlan } from './native-plan.js';
import type { OdcNativePlan } from './native-plan.js';
import { desiredNativeContent, evaluateReadBack, reconcileNative } from './native-readback.js';
import type { NativeReadBack, AppliedBaseline, ResourceBytes } from './native-readback.js';
import { checksum } from './release.js';
let plan: OdcNativePlan,
  snapshot: NativeReadBack,
  baseline: AppliedBaseline,
  bytes: ResourceBytes[];
beforeAll(async () => {
  const release = await buildRelease(process.cwd(), {
    outputRoot: await mkdtemp(join(tmpdir(), 'osai-readback-')),
  });
  plan = (await generateNativePlan(release.root, 'odc')) as OdcNativePlan;
  const slots = Object.fromEntries(
    plan.implementation.slots.map((s) => [s.name, `inspected-${s.name}`]),
  );
  const desired = desiredNativeContent(plan, slots);
  snapshot = {
    schemaVersion: '1.0',
    identity: {
      target: 'odc',
      appKey: 'synthetic-app',
      envKey: 'synthetic-env',
      revision: 'r1',
      layer: 'draft',
    },
    inspectedAt: '2026-10-08T00:00:00Z',
    afterOperation: 'edit-1',
    slots,
    entries: Object.entries(desired).map(([key, content]) => ({
      key,
      nativeId: `native-${key}`,
      revision: 'r1',
      evidence: 'inspection',
      kind: key.startsWith('source:')
        ? 'exact-source'
        : key.startsWith('wiring:')
          ? 'structured-wiring'
          : 'resource-mapping',
      content,
    })),
  };
  bytes = await Promise.all(
    plan.resources.assets
      .filter((a) => !a.origin)
      .map(async (a) => ({
        id: a.id,
        layer: 'served' as const,
        bytes: await readFile(join(release.root, 'odc', a.path)),
      })),
  );
  baseline = {
    planDigest: plan.planDigest,
    appKey: 'synthetic-app',
    envKey: 'synthetic-env',
    confirmedRevision: 'r1',
    entries: snapshot.entries.map((e) => ({
      key: e.key,
      nativeId: e.nativeId,
      content: e.content,
      evidence: e.evidence,
    })),
    servedHashes: Object.fromEntries(bytes.map((b) => [b.id, checksum(b.bytes)])),
  };
});
it('derives completeness from content inventory and one revision', () => {
  expect(evaluateReadBack(plan, snapshot).complete).toBe(true);
  for (const alter of [
    (s: NativeReadBack) => s.entries.pop(),
    (s: NativeReadBack) => s.entries.push(s.entries[0]!),
    (s: NativeReadBack) => (s.entries[0]!.revision = 'r2'),
    (s: NativeReadBack) => (s.entries[0]!.kind = 'summary'),
    (s: NativeReadBack) =>
      (s.entries.find((e) => e.kind === 'structured-wiring')!.content = {
        fingerprint: 'expected',
      }),
  ]) {
    const s = structuredClone(snapshot);
    alter(s);
    expect(evaluateReadBack(plan, s).complete).toBe(false);
  }
  expect(evaluateReadBack(plan, snapshot, 'interrupted-edit-2').issues).toContain(
    'fresh-read-back-required',
  );
});
it('compares intended/current/prior content and requires explicit adoption', () => {
  expect(reconcileNative(plan, snapshot).operations.every((o) => o.operation === 'conflict')).toBe(
    true,
  );
  const adopted = reconcileNative(plan, snapshot, {
    adoptions: snapshot.entries.map((e) => ({
      key: e.key,
      nativeId: e.nativeId,
      decisionEvidence: 'human-adoption',
    })),
  });
  expect(adopted.operations.every((o) => o.operation === 'unchanged')).toBe(true);
  expect(adopted.nativeUnchanged).toBe(false);
  const absent = structuredClone(snapshot);
  absent.entries = absent.entries.map((e) => ({ ...e, kind: 'absent', content: null }));
  expect(reconcileNative(plan, absent).operations.every((o) => o.operation === 'create')).toBe(
    true,
  );
  const edited = structuredClone(snapshot);
  edited.entries[0]!.content = '// user customization';
  expect(reconcileNative(plan, edited, { baseline }).operations[0]!.operation).toBe('conflict');
  const prior = structuredClone(baseline);
  prior.entries[0]!.content = '// prior approved source';
  const current = structuredClone(snapshot);
  current.entries[0]!.content = prior.entries[0]!.content;
  expect(reconcileNative(plan, current, { baseline: prior }).operations[0]!.operation).toBe(
    'update',
  );
  expect(reconcileNative(plan, snapshot, { baseline, bytes }).nativeUnchanged).toBe(true);
  expect(reconcileNative(plan, snapshot, { baseline, bytes }).exactPackage).toBe('exact');
});
it('retains BOM mismatch when observed native state is unchanged', () => {
  const changed = structuredClone(bytes);
  changed[0]!.bytes = Buffer.concat([Buffer.from([239, 187, 191]), changed[0]!.bytes]);
  const prior = structuredClone(baseline);
  prior.servedHashes[changed[0]!.id] = checksum(changed[0]!.bytes);
  const result = reconcileNative(plan, snapshot, { baseline: prior, bytes: changed });
  expect(result.nativeUnchanged).toBe(true);
  expect(result.exactPackage).toBe('mismatched');
  expect(result.bytes.find((b) => b.id === changed[0]!.id && b.layer === 'served')!.bomOnly).toBe(
    true,
  );
  expect(reconcileNative(plan, snapshot, { baseline }).exactPackage).toBe('unverified');
});
