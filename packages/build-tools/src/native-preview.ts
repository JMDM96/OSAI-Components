import type { ComponentManifest } from '@osai/contract-schemas';
export interface PreviewCase {
  id: string;
  preconditions: string[];
  entry: string;
  expectations: string[];
}
export interface PreviewSuite {
  schemaVersion: '1.0';
  componentId: string;
  version: string;
  cases: PreviewCase[];
}
export function generatePreviewSuite(manifest: ComponentManifest): PreviewSuite {
  const cases: PreviewCase[] = [];
  const add = (
    id: string,
    entry: string,
    expectations: string[],
    preconditions = ['Expected deployed revision and screen marker observed'],
  ) => cases.push({ id, entry, expectations, preconditions });
  add('mount', 'Block.OnReady → BuildConfiguration → BuildResources → Ready → ReadState', [
    'ReadState.ok=true; AcceptedConfigJson equals committed full configuration',
    'One instance and one subscription per declared event',
  ]);
  add(
    'update-accepted',
    'Native sample Apply → Block input assignment → ApplyConfiguration → ReadState',
    [
      'Complete configuration committed only after envelope.ok or observed ready state',
      'Draft text and accepted JSON are displayed separately',
    ],
  );
  add('form-rejected', 'Native sample Apply with malformed JSON', [
    'Serialization rejects draft; native update not invoked; accepted JSON unchanged',
  ]);
  add(
    'bridge-rejected',
    'Native sample TestInvalidConfiguration → ApplyConfiguration (schema-invalid serialized JSON)',
    [
      'Packaged bridge returns ok=false; prior accepted state preserved',
      Object.hasOwn(manifest.events, 'error')
        ? 'Forward_error delivers declared Block error PayloadJson'
        : 'Native diagnostic recorded; no invented Block error event',
    ],
  );
  for (const command of Object.keys(manifest.commands))
    add(
      `command:${command}`,
      `ResolveInstance(ConsumerBlockRootId) → Command_${command}(InstanceId,ArgumentsJson)`,
      ['Envelope matches declared command result schema', 'Only the addressed sibling changes'],
    );
  for (const event of Object.keys(manifest.events))
    add(`event:${event}`, `Block-private subscription → Forward_${event}(PayloadJson)`, [
      'Positional Text parses as declared payload schema',
      'Matching Block event observed with source instance',
    ]);
  add('repeated-render', 'Block.OnRender → BuildConfiguration → ApplyConfiguration', [
    'Unchanged input deduplicated; no duplicate instances or subscriptions',
  ]);
  add('navigation-disposal', 'Native navigation away → Block.OnDestroy → Dispose; navigate back', [
    'Detached host cleanup; listeners/subscriptions cancelled',
    'New lifetime instance; overlapping sibling remains usable',
  ]);
  add('siblings', 'ResolveInstance(each ConsumerBlockRootId) → native command', [
    'Independent state and events',
    'Absent or ambiguous roots fail visibly',
  ]);
  if (manifest.componentId === 'command-palette') {
    add(
      'close-while-open',
      'Native SampleCloseSequence: ResolveInstance → Command_open → await opened Block event → Command_close',
      ['opened then closed observed; modal closes; focus restored'],
      ['Arm sequence through native Client Action before opening; page controls will become inert'],
    );
    add(
      'toggle-to-close',
      'Native SampleToggleSequence: ResolveInstance → Command_open → await opened Block event → Command_toggle',
      ['opened then closed observed; final modal hidden'],
      ['Arm sequence through native Client Action before opening; preserve modal accessibility'],
    );
  }
  return {
    schemaVersion: '1.0',
    componentId: manifest.componentId,
    version: manifest.version,
    cases,
  };
}
export interface PreviewResult {
  caseId: string;
  status: 'passed' | 'failed' | 'blocked' | 'not-executed';
  entry: string;
  evidence: string[];
  observations: string[];
}
export function evaluatePreview(
  suite: PreviewSuite,
  results: PreviewResult[],
  context: {
    planDigest?: string;
    platformVersion?: string;
    appKey?: string;
    envKey?: string;
    deployedRevision?: string;
    expectedRevision?: string;
    observedAt?: string;
    exactPackage: 'exact' | 'mismatched' | 'unverified';
  },
) {
  const issues: string[] = [];
  for (const field of [
    'planDigest',
    'platformVersion',
    'appKey',
    'envKey',
    'deployedRevision',
    'expectedRevision',
    'observedAt',
  ] as const)
    if (!context[field]) issues.push(`missing:${field}`);
  if (context.deployedRevision !== context.expectedRevision) issues.push('old-deployment');
  if (!context.observedAt || !Number.isFinite(Date.parse(context.observedAt)))
    issues.push('invalid-time');
  const cases = suite.cases.map((test) => {
    const matches = results.filter((r) => r.caseId === test.id),
      result = matches[0];
    if (
      matches.length !== 1 ||
      !result ||
      result.entry !== test.entry ||
      !result.evidence.length ||
      result.observations.length < test.expectations.length
    )
      return { caseId: test.id, status: 'not-executed' };
    return { caseId: test.id, status: result.status };
  });
  if (results.some((r) => !suite.cases.some((c) => c.id === r.caseId))) issues.push('unknown-case');
  return {
    cases,
    issues,
    previewPassed: !issues.length && cases.every((c) => c.status === 'passed'),
    exactPackage: context.exactPackage,
    nativeQualified: false,
  };
}
