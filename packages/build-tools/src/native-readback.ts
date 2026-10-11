import { canonicalJson } from '@osai/contract-schemas';
import type { OdcNativePlan } from './native-plan.js';
import { inspectNativePlan } from './native-plan.js';
import { checksum } from './release.js';

export interface NativeIdentity {
  target: 'odc';
  appKey: string;
  envKey: string;
  revision: string;
  layer: 'draft' | 'published' | 'deployed';
}
export interface ReadBackEntry {
  key: string;
  nativeId: string;
  revision: string;
  evidence: string;
  kind: 'exact-source' | 'structured-wiring' | 'resource-mapping' | 'summary' | 'absent';
  content: unknown;
}
export interface NativeReadBack {
  schemaVersion: '1.0';
  identity: NativeIdentity;
  inspectedAt: string;
  afterOperation: string | null;
  slots: Record<string, string>;
  entries: ReadBackEntry[];
}
export interface AppliedBaseline {
  planDigest: string;
  appKey: string;
  envKey: string;
  confirmedRevision: string;
  entries: { key: string; nativeId: string; content: unknown; evidence: string }[];
  servedHashes: Record<string, string>;
}
export interface Adoption {
  key: string;
  nativeId: string;
  decisionEvidence: string;
}
export interface ResourceBytes {
  id: string;
  layer: 'model' | 'served';
  bytes: Uint8Array;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);

/** Templates contain named slots. Their values must come from inspected identities. */
export function desiredNativeContent(
  plan: OdcNativePlan,
  slots: Record<string, string>,
): Record<string, unknown> {
  inspectNativePlan(plan);
  const bind = (value: unknown): unknown => {
    if (typeof value === 'string' && value.startsWith('slot:'))
      return slots[value.slice(5)] ?? value;
    if (Array.isArray(value)) return value.map(bind);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bind(v)]));
    return value;
  };
  return Object.fromEntries([
    ...plan.implementation.nodes.flatMap((node) => [
      [`source:${node.name}`, node.source],
      [
        `wiring:${node.name}`,
        bind({
          visibility: node.visibility,
          inputs: node.inputs,
          outputs: node.outputs,
          bindings: node.bindings,
        }),
      ],
    ]),
    ...plan.implementation.forwarders.map((flow) => [
      `wiring:${flow.name}`,
      bind({
        visibility: flow.visibility,
        inputs: flow.inputs,
        outputs: flow.outputs,
        bindings: flow.bindings,
      }),
    ]),
    [
      'wiring:Block',
      {
        block: plan.block,
        lifecycle: plan.implementation.lifecycle,
        loadOrder: plan.implementation.loadOrder,
      },
    ],
    ...plan.implementation.resources.map((asset) => [
      `resource:${asset.id}`,
      { path: asset.path, kind: asset.kind, url: slots[asset.slot], integrity: asset.integrity },
    ]),
  ]);
}
export function evaluateReadBack(
  plan: OdcNativePlan,
  readBack: NativeReadBack,
  pendingOperation?: string,
) {
  const issues: string[] = [];
  if (
    readBack.schemaVersion !== '1.0' ||
    readBack.identity?.target !== 'odc' ||
    !readBack.identity.appKey ||
    !readBack.identity.envKey ||
    !readBack.identity.revision ||
    !['draft', 'published', 'deployed'].includes(readBack.identity.layer)
  )
    issues.push('invalid-identity');
  if (!Number.isFinite(Date.parse(readBack.inspectedAt))) issues.push('invalid-observation-time');
  if (pendingOperation && readBack.afterOperation !== pendingOperation)
    issues.push('fresh-read-back-required');
  for (const slot of plan.implementation.slots)
    if (!readBack.slots[slot.name]) issues.push(`missing-slot:${slot.name}`);
  const expected = desiredNativeContent(plan, readBack.slots);
  const seen = new Set<string>();
  for (const entry of readBack.entries) {
    if (seen.has(entry.key)) issues.push(`duplicate:${entry.key}`);
    seen.add(entry.key);
    if (!Object.hasOwn(expected, entry.key)) issues.push(`unexpected:${entry.key}`);
    if (entry.revision !== readBack.identity.revision) issues.push(`mixed-revision:${entry.key}`);
    if (!entry.evidence) issues.push(`missing-evidence:${entry.key}`);
    if (entry.kind === 'absent') {
      if (entry.content !== null) issues.push(`invalid-absence:${entry.key}`);
      continue;
    }
    if (!entry.nativeId) issues.push(`missing-native-id:${entry.key}`);
    const kind = entry.key.startsWith('source:')
      ? 'exact-source'
      : entry.key.startsWith('wiring:')
        ? 'structured-wiring'
        : 'resource-mapping';
    if (entry.kind !== kind) issues.push(`incomplete:${entry.key}`);
    if (kind === 'exact-source' && (typeof entry.content !== 'string' || !entry.content.trim()))
      issues.push(`missing-source:${entry.key}`);
    if (kind !== 'exact-source') {
      const content = entry.content as Record<string, unknown> | null;
      const required =
        entry.key === 'wiring:Block'
          ? ['block', 'lifecycle', 'loadOrder']
          : kind === 'structured-wiring'
            ? ['visibility', 'inputs', 'outputs', 'bindings']
            : ['path', 'kind', 'url', 'integrity'];
      if (
        !content ||
        typeof content !== 'object' ||
        Array.isArray(content) ||
        required.some((key) => !Object.hasOwn(content, key))
      )
        issues.push(`missing-mappings:${entry.key}`);
    }
  }
  for (const key of Object.keys(expected)) if (!seen.has(key)) issues.push(`missing:${key}`);
  return { complete: issues.length === 0, issues };
}
/** Compare actual inspected content with both intended and last confirmed content. */
export function reconcileNative(
  plan: OdcNativePlan,
  readBack: NativeReadBack,
  options: {
    baseline?: AppliedBaseline;
    adoptions?: Adoption[];
    bytes?: ResourceBytes[];
    pendingOperation?: string;
  } = {},
) {
  const completeness = evaluateReadBack(plan, readBack, options.pendingOperation);
  const baseline = options.baseline;
  if (
    baseline &&
    (baseline.appKey !== readBack.identity.appKey ||
      baseline.envKey !== readBack.identity.envKey ||
      !baseline.confirmedRevision ||
      !baseline.planDigest)
  )
    completeness.issues.push('baseline-identity-conflict');
  if (baseline && new Set(baseline.entries.map((e) => e.key)).size !== baseline.entries.length)
    completeness.issues.push('ambiguous-baseline');
  if (completeness.issues.length)
    return {
      status: 'read-back-required' as const,
      issues: completeness.issues,
      operations: [],
      bytes: [],
      nativeUnchanged: false,
      exactPackage: 'unverified' as const,
    };
  const desired = desiredNativeContent(plan, readBack.slots);
  const operations = readBack.entries.map((observed) => {
    const prior = baseline?.entries.find((e) => e.key === observed.key);
    const adoption = options.adoptions?.some(
      (a) => a.key === observed.key && a.nativeId === observed.nativeId && a.decisionEvidence,
    );
    let operation: 'create' | 'update' | 'unchanged' | 'conflict';
    if (observed.kind === 'absent') operation = prior ? 'conflict' : 'create';
    else if (
      prior &&
      (prior.nativeId !== observed.nativeId ||
        !prior.evidence ||
        !same(prior.content, observed.content))
    )
      operation = 'conflict';
    else if (!prior && !adoption) operation = 'conflict';
    else operation = same(observed.content, desired[observed.key]) ? 'unchanged' : 'update';
    return { key: observed.key, nativeId: observed.nativeId, operation };
  });
  const bytes = plan.resources.assets
    .filter((a) => !a.origin)
    .flatMap((asset) =>
      ['model', 'served'].map((layer) => {
        const captures = options.bytes?.filter((b) => b.id === asset.id && b.layer === layer) ?? [];
        const data = captures.length === 1 ? captures[0]!.bytes : undefined;
        const qualified = plan.artifactChecksums[`${plan.target}/${asset.path}`];
        const observed = data ? checksum(data) : undefined;
        return {
          id: asset.id,
          layer,
          qualified,
          observed,
          identity:
            !observed || !qualified
              ? ('unverified' as const)
              : observed === qualified
                ? ('exact' as const)
                : ('mismatched' as const),
          bomOnly:
            !!data &&
            !!qualified &&
            data[0] === 239 &&
            data[1] === 187 &&
            data[2] === 191 &&
            checksum(data.slice(3)) === qualified,
          unchanged:
            !!observed && layer === 'served' && baseline?.servedHashes[asset.id] === observed,
        };
      }),
    );
  const served = bytes.filter((b) => b.layer === 'served');
  const exactPackage = served.some((b) => b.identity === 'mismatched')
    ? 'mismatched'
    : served.every((b) => b.identity === 'exact')
      ? 'exact'
      : 'unverified';
  return {
    status: 'ready' as const,
    issues: [],
    operations,
    bytes,
    nativeUnchanged:
      operations.every((o) => o.operation === 'unchanged') && served.every((b) => b.unchanged),
    exactPackage,
  };
}
