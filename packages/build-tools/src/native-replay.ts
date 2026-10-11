import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { generateNativePlan } from './native-plan.js';
import { initNativeRun, exportNativeRun, assertExportSafe } from './native-run.js';
import type { NativeRun, RunEvidence } from './native-run.js';
import type { OdcNativePlan } from './native-plan.js';
import type { NativeReadBack, AppliedBaseline } from './native-readback.js';
import { desiredNativeContent } from './native-readback.js';
import { checksum } from './release.js';

/** Synthetic supplied-state examples, deliberately separate from live evidence. */
export async function prepareReplayBundles(releaseRoot: string, out: string) {
  await mkdir(out, { recursive: false });
  const plan = (await generateNativePlan(releaseRoot, 'odc')) as OdcNativePlan;
  const planPath = join(out, 'prepared-plan.json');
  await writeFile(planPath, JSON.stringify(plan));
  const base = join(out, 'initial');
  await initNativeRun(planPath, releaseRoot, base);
  const scenarios = [
    'manual-import',
    'quota-pause',
    'partial-mutation',
    'conflicting-source',
    'missing-evidence',
    'unchanged-rerun',
  ];
  const results: Record<string, string> = {};
  for (const scenario of scenarios) {
    const root = join(out, scenario);
    await cp(base, root, { recursive: true });
    const run = JSON.parse(await readFile(join(root, 'run.json'), 'utf8')) as NativeRun;
    const attach = async (
      id: string,
      kind: RunEvidence['kind'],
      data: Uint8Array,
      assetId: string | null = null,
    ) => {
      assertExportSafe(data);
      const path = `${id}.evidence`;
      await writeFile(join(root, path), data);
      run.evidence.push({
        id,
        path,
        kind,
        assetId,
        sha256: checksum(data),
        complete: true,
        redacted: false,
      });
    };
    await attach(
      'inspection',
      'observation',
      Buffer.from(
        JSON.stringify({
          synthetic: true,
          observed: 'Imported resources inspected in synthetic app; no live claim',
          revision: 'r1',
        }),
      ),
    );
    await attach(
      'human-request',
      'human-request',
      Buffer.from(
        JSON.stringify({
          synthetic: true,
          text: 'Fixture authority reference only; not an actual human grant.',
        }),
      ),
    );
    run.native = {
      appKey: 'synthetic-app',
      envKey: 'synthetic-env',
      draftRevision: 'r1',
      publishedRevision: null,
      deployedRevision: null,
    };
    run.authority = [
      {
        request: 'human-request',
        appKey: 'synthetic-app',
        envKey: 'synthetic-env',
        operations: ['edit'],
        revoked: false,
      },
    ];
    run.transfer = { route: 'manual', status: 'inspected', evidence: ['inspection'] };
    if (scenario === 'quota-pause')
      run.attempts = [
        {
          id: 'quota-1',
          operation: 'publish',
          route: 'observed-route',
          outcome: 'quota',
          hypothesis: 'Initial publication',
          evidence: ['inspection'],
          condition: 'quota-window-1',
          mutationPossible: false,
        },
      ];
    if (scenario === 'partial-mutation')
      run.outcomes = [
        {
          operation: 'edit-1',
          stage: 'run',
          status: 'failed',
          revision: 'r1',
          nativeId: null,
          evidence: ['inspection'],
          mutationPossible: true,
        },
      ];
    if (['conflicting-source', 'missing-evidence', 'unchanged-rerun'].includes(scenario)) {
      const slots = Object.fromEntries(
        plan.implementation.slots.map((s) => [
          s.name,
          s.name.startsWith('resource:')
            ? `https://synthetic.invalid/assets/${s.name.slice(9)}`
            : `synthetic-${s.name}`,
        ]),
      );
      const snapshot: NativeReadBack = {
        schemaVersion: '1.0',
        identity: {
          target: 'odc',
          appKey: 'synthetic-app',
          envKey: 'synthetic-env',
          revision: 'r1',
          layer: 'draft',
        },
        inspectedAt: '2026-10-08T00:00:00Z',
        afterOperation: null,
        slots,
        entries: Object.entries(desiredNativeContent(plan, slots)).map(([key, content]) => ({
          key,
          nativeId: `synthetic-${key}`,
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
      const baseline: AppliedBaseline = {
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
        servedHashes: {},
      };
      for (const [index, asset] of plan.resources.assets.filter((a) => !a.origin).entries()) {
        const data = await readFile(join(releaseRoot, 'odc', asset.path));
        await attach(`served-${index}`, 'served-bytes', data, asset.id);
        baseline.servedHashes[asset.id] = checksum(data);
      }
      if (scenario === 'conflicting-source')
        snapshot.entries[0]!.content += '\n// synthetic user customization';
      await attach('read-back', 'read-back', Buffer.from(JSON.stringify(snapshot)));
      await attach('baseline', 'applied-baseline', Buffer.from(JSON.stringify(baseline)));
      run.readBack = { evidence: 'read-back', afterOperation: null };
      run.baseline.evidence = 'baseline';
      run.assetIdentity = 'exact';
    }
    await writeFile(join(root, 'run.json'), JSON.stringify(run, null, 2) + '\n');
    // Validate export before deliberately omitting one attachment for the missing-evidence scenario.
    const exported = join(out, `${scenario}-portable`);
    await exportNativeRun(join(root, 'run.json'), exported);
    if (scenario === 'missing-evidence') {
      const { rm } = await import('node:fs/promises');
      await rm(join(exported, 'read-back.evidence'));
    }
    results[scenario] = join(exported, 'run.json');
  }
  return results;
}
