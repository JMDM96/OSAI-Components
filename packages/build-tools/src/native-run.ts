import { readFile, writeFile, mkdir, lstat, realpath, rm } from 'node:fs/promises';
import { dirname, resolve, relative, join, isAbsolute } from 'node:path';
import Ajv from 'ajv';
import { canonicalJson } from '@osai/contract-schemas';
import type { OdcNativePlan } from './native-plan.js';
import { inspectNativePlan, validateNativePlan } from './native-plan.js';
import type { AuthorityReference, Attempt } from './native-workflow.js';
import { reconcileNative } from './native-readback.js';
import type { AppliedBaseline, Adoption, NativeReadBack } from './native-readback.js';
import { checksum } from './release.js';

export interface RunEvidence {
  id: string;
  path: string;
  sha256: string;
  kind:
    | 'applied-baseline'
    | 'read-back'
    | 'model-bytes'
    | 'served-bytes'
    | 'observation'
    | 'human-request'
    | 'preview';
  assetId: string | null;
  complete: boolean;
  redacted: boolean;
}
export interface RunOutcome {
  operation: string;
  stage:
    | 'run'
    | 'mutation'
    | 'validation'
    | 'publication'
    | 'library-release'
    | 'deployment'
    | 'preview';
  status: 'not-started' | 'pending' | 'succeeded' | 'failed' | 'unknown';
  revision: string | null;
  nativeId: string | null;
  evidence: string[];
  mutationPossible: boolean;
}
export interface NativeRun {
  schemaVersion: '1.0';
  target: 'odc';
  package: { componentId: string; version: string; artifactDigest: string };
  plan: { path: string; sha256: string; planDigest: string };
  native: {
    appKey: string | null;
    envKey: string | null;
    draftRevision: string | null;
    publishedRevision: string | null;
    deployedRevision: string | null;
  };
  authority: AuthorityReference[];
  outcomes: RunOutcome[];
  attempts: Attempt[];
  evidence: RunEvidence[];
  nextSteps: string[];
  transfer: {
    route: 'none' | 'manual' | 'automated' | 'document';
    status: 'pending' | 'inspected' | 'conflicting';
    evidence: string[];
  };
  baseline: { evidence: string | null; adoptions: Adoption[] };
  readBack: { evidence: string | null; afterOperation: string | null };
  assetIdentity: 'exact' | 'mismatched' | 'unverified';
  readiness: 'local-preparation' | 'preview-observed';
}
const str = { type: 'string', minLength: 1 };
const nullable = { anyOf: [str, { type: 'null' }] };
const array = (items: unknown) => ({ type: 'array', items });
const en = (...values: string[]) => ({ enum: values });
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
export const nativeRunSchema = obj({
  schemaVersion: { const: '1.0' },
  target: { const: 'odc' },
  package: obj({ componentId: str, version: str, artifactDigest: hash }),
  plan: obj({ path: str, sha256: hash, planDigest: hash }),
  native: obj({
    appKey: nullable,
    envKey: nullable,
    draftRevision: nullable,
    publishedRevision: nullable,
    deployedRevision: nullable,
  }),
  authority: array(
    obj({
      request: str,
      appKey: str,
      envKey: str,
      operations: array(en('edit', 'publish', 'deploy')),
      revoked: { type: 'boolean' },
    }),
  ),
  outcomes: array(
    obj({
      operation: str,
      stage: en(
        'run',
        'mutation',
        'validation',
        'publication',
        'library-release',
        'deployment',
        'preview',
      ),
      status: en('not-started', 'pending', 'succeeded', 'failed', 'unknown'),
      revision: nullable,
      nativeId: nullable,
      evidence: array(str),
      mutationPossible: { type: 'boolean' },
    }),
  ),
  attempts: array(
    obj({
      id: str,
      operation: str,
      route: str,
      outcome: en('success', 'failed', 'quota', 'authentication', 'rejected'),
      hypothesis: str,
      evidence: array(str),
      condition: str,
      mutationPossible: { type: 'boolean' },
    }),
  ),
  evidence: array(
    obj({
      id: str,
      path: str,
      sha256: hash,
      kind: en(
        'applied-baseline',
        'read-back',
        'model-bytes',
        'served-bytes',
        'observation',
        'human-request',
        'preview',
      ),
      assetId: nullable,
      complete: { type: 'boolean' },
      redacted: { type: 'boolean' },
    }),
  ),
  nextSteps: array(str),
  transfer: obj({
    route: en('none', 'manual', 'automated', 'document'),
    status: en('pending', 'inspected', 'conflicting'),
    evidence: array(str),
  }),
  baseline: obj({
    evidence: nullable,
    adoptions: array(obj({ key: str, nativeId: str, decisionEvidence: str })),
  }),
  readBack: obj({ evidence: nullable, afterOperation: nullable }),
  assetIdentity: en('exact', 'mismatched', 'unverified'),
  readiness: en('local-preparation', 'preview-observed'),
});
const validator = new Ajv({ allErrors: true }).compile(nativeRunSchema);
export function parseNativeRun(value: unknown): NativeRun {
  if (!validator(value))
    throw new Error('Invalid native run schema: ' + JSON.stringify(validator.errors));
  assertExportSafe(Buffer.from(JSON.stringify(value)));
  return value as unknown as NativeRun;
}
/** Reject before writing. No redaction can retain a claim of complete source. */
export function assertExportSafe(bytes: Uint8Array): void {
  const text = Buffer.from(bytes).toString('utf8');
  const forbidden = [
    /\bBearer\s+[A-Za-z0-9._~+/-]+/i,
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /[?&](?:code|state|token|access_token|signature|sig|x-amz-signature|x-goog-signature|session|credential)=[^\s"&#]+/i,
    /["'](?:access[_-]?token|refresh[_-]?token|mentor[_-]?session[_-]?(?:token|id|handle)|session[_-]?(?:token|id|handle)|authorization|cookie|set-cookie|password|client[_-]?secret|upload[_-]?url|callback[_-]?url)["']\s*:\s*["'][^"']+["']/i,
    /(?:^|\n)(?:Authorization|Cookie|Set-Cookie):\s*\S+/i,
  ];
  if (forbidden.some((pattern) => pattern.test(text)))
    throw new Error('Sensitive evidence rejected before persistence');
}
function safeRelative(path: string): void {
  if (
    !path ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.split('/').some((p) => p === '..' || p === '.' || !p) ||
    /^[A-Za-z]:/.test(path)
  )
    throw new Error('Evidence path must be contained and relative');
}
async function containedFile(root: string, path: string): Promise<string> {
  safeRelative(path);
  const base = await realpath(root);
  let current = base;
  for (const part of path.split('/')) {
    current = join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error('Evidence symlinks are forbidden');
  }
  const actual = await realpath(current);
  if (relative(base, actual).startsWith('..')) throw new Error('Escaping evidence path');
  if (!(await lstat(actual)).isFile()) throw new Error('Evidence must be a file');
  return actual;
}
export function continuation(run: NativeRun, missing: string[] = []) {
  const last = (stage: RunOutcome['stage']) => run.outcomes.filter((o) => o.stage === stage).at(-1);
  const observedIndex = run.readBack.evidence
    ? run.outcomes.map((o) => o.operation).lastIndexOf(run.readBack.afterOperation ?? '')
    : -1;
  const uncertain = run.outcomes.filter((o, i) => o.mutationPossible && i > observedIndex);
  const publication = last('publication'),
    deployment = last('deployment'),
    release = last('library-release');
  const releasedLibrary =
    release?.status === 'succeeded' &&
    release.nativeId === run.native.appKey &&
    release.revision !== null &&
    release.revision === publication?.revision;
  const next = missing.length
    ? 'restore-missing-evidence'
    : !run.native.appKey || !run.native.envKey
      ? 'resolve-native-identities'
      : uncertain.length
        ? 'fresh-read-back-required'
        : run.transfer.status === 'conflicting'
          ? 'resolve-resource-conflict'
          : run.attempts.at(-1)?.outcome === 'quota'
            ? 'quota-checkpoint'
            : run.transfer.status !== 'inspected'
              ? 'inspect-resource-import'
              : publication?.status === 'failed'
                ? 'diagnose-publication'
                : release?.status === 'succeeded' && !release.nativeId
                  ? 'inspect-library-release'
                  : publication?.status === 'succeeded' &&
                      !releasedLibrary &&
                      (deployment?.status !== 'succeeded' ||
                        deployment.revision !== publication.revision)
                    ? 'deploy-published-revision'
                    : !run.readBack.evidence
                      ? 'inspect-native-source-and-wiring'
                      : 'reconcile-complete-read-back';
  return {
    next,
    history: run.outcomes,
    attempts: run.attempts,
    conflicts: null as { key: string; nativeId: string }[] | null,
    publication: publication?.status ?? 'not-started',
    deployment: deployment?.status ?? 'not-started',
    assetIdentity: run.assetIdentity,
    nativeQualified: false,
    authority: 'requires-accessible-human-request',
    connection: 'recheck-through-official-skill',
  };
}
export async function inspectNativeRun(recordPath: string) {
  const root = dirname(resolve(recordPath));
  const run = parseNativeRun(JSON.parse(await readFile(recordPath, 'utf8')));
  const problems: string[] = [];
  const files = new Map<string, Uint8Array>();
  const seen = new Set<string>(),
    paths = new Set<string>();
  for (const item of [
    { id: 'plan', path: run.plan.path, sha256: run.plan.sha256 },
    ...run.evidence,
  ]) {
    if (seen.has(item.id) || paths.has(item.path)) problems.push(`duplicate-evidence:${item.id}`);
    seen.add(item.id);
    paths.add(item.path);
    try {
      const data = await readFile(await containedFile(root, item.path));
      assertExportSafe(data);
      if (checksum(data) !== item.sha256) throw new Error('hash mismatch');
      files.set(item.id, data);
    } catch (error) {
      problems.push(`evidence:${item.id}:${(error as Error).message}`);
    }
  }
  let plan: OdcNativePlan | undefined;
  try {
    plan = JSON.parse(Buffer.from(files.get('plan') ?? []).toString('utf8')) as OdcNativePlan;
    if (plan.schemaVersion !== '3.0' || inspectNativePlan(plan).execution !== 'supported')
      throw new Error('Unsupported ODC plan');
    if (
      plan.planDigest !== run.plan.planDigest ||
      plan.componentId !== run.package.componentId ||
      plan.version !== run.package.version ||
      plan.artifactDigest !== run.package.artifactDigest
    )
      throw new Error('Plan/package binding differs');
  } catch (error) {
    problems.push(`plan:${(error as Error).message}`);
    plan = undefined;
  }
  if ((run.outcomes.length || run.attempts.length) && (!run.native.appKey || !run.native.envKey))
    problems.push('missing-native-identities');
  for (const [stage, field] of [
    ['publication', 'publishedRevision'],
    ['deployment', 'deployedRevision'],
  ] as const) {
    const latest = run.outcomes.filter((o) => o.stage === stage).at(-1);
    if (latest?.status === 'succeeded' && latest.revision !== run.native[field])
      problems.push(`conflicting-current-revision:${stage}`);
  }
  const ref = (id: string) => {
    if (!run.evidence.some((e) => e.id === id)) problems.push(`missing-reference:${id}`);
  };
  for (const outcome of run.outcomes) {
    outcome.evidence.forEach(ref);
    if (outcome.status === 'succeeded' && !outcome.evidence.length)
      problems.push(`unsupported-outcome:${outcome.operation}`);
    if (
      outcome.status === 'succeeded' &&
      ['publication', 'deployment'].includes(outcome.stage) &&
      !outcome.revision
    )
      problems.push(`missing-revision:${outcome.operation}`);
  }
  for (const attempt of run.attempts) attempt.evidence.forEach(ref);
  run.authority.forEach((a) => ref(a.request));
  run.transfer.evidence.forEach(ref);
  if (new Set(run.attempts.map((a) => a.id)).size !== run.attempts.length)
    problems.push('duplicate-attempt');
  if (
    run.transfer.status === 'inspected' &&
    (!['manual', 'automated'].includes(run.transfer.route) || !run.transfer.evidence.length)
  )
    problems.push('import-not-inspected');
  for (const entry of run.evidence)
    if (entry.kind === 'read-back' && entry.complete && entry.redacted)
      problems.push(`redacted-source-incomplete:${entry.id}`);
  let readBackComplete = false;
  let observed: NativeReadBack | undefined;
  let reconciliation: ReturnType<typeof reconcileNative> | undefined;
  if (run.readBack.evidence) {
    ref(run.readBack.evidence);
    const entry = run.evidence.find((e) => e.id === run.readBack.evidence);
    try {
      if (!entry?.complete || entry.redacted || entry.kind !== 'read-back' || !plan)
        throw new Error('Read-back is incomplete');
      const { evaluateReadBack } = await import('./native-readback.js');
      const readBack = JSON.parse(Buffer.from(files.get(entry.id) ?? []).toString('utf8'));
      if (
        readBack.identity.appKey !== run.native.appKey ||
        readBack.identity.envKey !== run.native.envKey ||
        readBack.identity.revision !==
          run.native[
            `${readBack.identity.layer === 'draft' ? 'draft' : readBack.identity.layer === 'published' ? 'published' : 'deployed'}Revision`
          ]
      )
        throw new Error('Read-back identity/revision conflict');
      if (readBack.afterOperation !== run.readBack.afterOperation)
        throw new Error('Read-back operation conflict');
      const evaluated = evaluateReadBack(plan, readBack);
      if (!evaluated.complete) throw new Error(evaluated.issues.join(','));
      for (const observed of readBack.entries) ref(observed.evidence);
      readBackComplete = true;
      observed = readBack;
    } catch (error) {
      problems.push(`read-back:${(error as Error).message}`);
    }
  }
  if (run.baseline.evidence) ref(run.baseline.evidence);
  run.baseline.adoptions.forEach((a) => ref(a.decisionEvidence));
  if (observed && plan) {
    try {
      let baseline: AppliedBaseline | undefined;
      if (run.baseline.evidence) {
        if (run.evidence.find((e) => e.id === run.baseline.evidence)?.kind !== 'applied-baseline')
          throw new Error('Expected applied baseline');
        baseline = JSON.parse(Buffer.from(files.get(run.baseline.evidence) ?? []).toString('utf8'));
        baseline!.entries.forEach((e) => ref(e.evidence));
      }
      reconciliation = reconcileNative(plan, observed, {
        baseline,
        adoptions: run.baseline.adoptions,
        bytes: run.evidence
          .filter((e) => ['model-bytes', 'served-bytes'].includes(e.kind) && files.has(e.id))
          .map((e) => ({
            id: e.assetId ?? '',
            layer: e.kind === 'model-bytes' ? 'model' : 'served',
            bytes: files.get(e.id)!,
          })),
      });
      if (reconciliation.status !== 'ready') problems.push(...reconciliation.issues);
    } catch (error) {
      problems.push(`baseline:${(error as Error).message}`);
    }
  }
  // Hash actual captures independently, preserving originals and per-resource attribution.
  const expected = plan?.resources.assets.filter((a) => !a.origin) ?? [];
  for (const capture of run.evidence.filter((e) =>
    ['model-bytes', 'served-bytes'].includes(e.kind),
  ))
    if (!expected.some((a) => a.id === capture.assetId))
      problems.push(`unknown-resource:${capture.id}`);
  const identity = expected.map((asset) => {
    const captures = run.evidence.filter(
      (e) => e.kind === 'served-bytes' && e.assetId === asset.id,
    );
    if (captures.length > 1) problems.push(`ambiguous-resource:${asset.id}`);
    const data = captures.length === 1 ? files.get(captures[0]!.id) : undefined;
    return !data
      ? 'unverified'
      : checksum(data) === plan?.artifactChecksums[`odc/${asset.path}`]
        ? 'exact'
        : 'mismatched';
  });
  const established = identity.includes('mismatched')
    ? 'mismatched'
    : identity.length && identity.every((v) => v === 'exact')
      ? 'exact'
      : 'unverified';
  if (run.assetIdentity !== 'unverified' && run.assetIdentity !== established)
    problems.push('unsupported-asset-identity');
  let previewPassed = false;
  for (const evidence of run.evidence.filter((e) => e.kind === 'preview')) {
    try {
      const payload = JSON.parse(Buffer.from(files.get(evidence.id) ?? []).toString('utf8'));
      const { evaluatePreview } = await import('./native-preview.js');
      if (
        !plan ||
        payload.context.planDigest !== plan.planDigest ||
        payload.context.appKey !== run.native.appKey ||
        payload.context.envKey !== run.native.envKey ||
        payload.context.deployedRevision !== run.native.deployedRevision ||
        payload.context.exactPackage !== established
      )
        throw new Error('Preview identity conflict');
      for (const result of payload.results) result.evidence.forEach(ref);
      previewPassed = evaluatePreview(plan.preview, payload.results, payload.context).previewPassed;
    } catch {
      problems.push(`invalid-preview:${evidence.id}`);
    }
  }
  if (run.readiness === 'preview-observed' && !previewPassed)
    problems.push('unsupported-preview-readiness');
  const state = continuation(
    {
      ...run,
      readBack: readBackComplete ? run.readBack : { evidence: null, afterOperation: null },
    },
    problems,
  );
  if (!problems.length && state.next === 'reconcile-complete-read-back' && reconciliation) {
    state.conflicts = reconciliation.operations
      .filter((operation) => operation.operation === 'conflict')
      .map(({ key, nativeId }) => ({ key, nativeId }));
    state.next = reconciliation.operations.some((o) => o.operation === 'conflict')
      ? 'resolve-native-conflict'
      : reconciliation.nativeUnchanged
        ? 'native-state-unchanged'
        : 'review-native-differences';
  }
  return {
    valid: problems.length === 0,
    problems,
    run,
    plan,
    files,
    reconciliation,
    continuation: state,
  };
}
export async function validateNativeRun(recordPath: string) {
  const result = await inspectNativeRun(recordPath);
  if (!result.valid) throw new Error(result.problems.join('\n'));
  return result;
}
async function persistBundle(out: string, run: NativeRun, files: Map<string, Uint8Array>) {
  parseNativeRun(run);
  for (const data of files.values()) assertExportSafe(data);
  // Exclusive directory creation prevents replacement, including empty existing bundles.
  await mkdir(out, { recursive: false });
  try {
    for (const item of [{ id: 'plan', path: run.plan.path }, ...run.evidence]) {
      safeRelative(item.path);
      const file = join(out, item.path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, files.get(item.id)!, { flag: 'wx' });
    }
    await writeFile(join(out, 'run.json'), canonicalJson(run) + '\n', { flag: 'wx' });
    await validateNativeRun(join(out, 'run.json'));
  } catch (error) {
    await rm(out, { recursive: true, force: true });
    throw error;
  }
}
export async function initNativeRun(planPath: string, releaseRoot: string, out: string) {
  const data = await readFile(planPath);
  assertExportSafe(data);
  const plan = JSON.parse(data.toString('utf8')) as OdcNativePlan;
  if (plan.schemaVersion !== '3.0' || plan.target !== 'odc')
    throw new Error('Native run requires ODC plan 3.0');
  await validateNativePlan(plan, releaseRoot);
  const run: NativeRun = {
    schemaVersion: '1.0',
    target: 'odc',
    package: {
      componentId: plan.componentId,
      version: plan.version,
      artifactDigest: plan.artifactDigest,
    },
    plan: { path: 'plan.json', sha256: checksum(data), planDigest: plan.planDigest },
    native: {
      appKey: null,
      envKey: null,
      draftRevision: null,
      publishedRevision: null,
      deployedRevision: null,
    },
    authority: [],
    outcomes: [],
    attempts: [],
    evidence: [],
    nextSteps: [
      'Resolve current capabilities and scoped human authority for a separately requested live run.',
    ],
    transfer: { route: 'none', status: 'pending', evidence: [] },
    baseline: { evidence: null, adoptions: [] },
    readBack: { evidence: null, afterOperation: null },
    assetIdentity: 'unverified',
    readiness: 'local-preparation',
  };
  await persistBundle(out, run, new Map([['plan', data]]));
  return run;
}
export async function exportNativeRun(recordPath: string, out: string) {
  const source = await validateNativeRun(recordPath);
  await persistBundle(out, source.run, source.files);
  return join(out, 'run.json');
}
export const nativeRunHelp =
  'native-run init --plan PATH --package PATH --out NEW_DIRECTORY | native-run validate|inspect --record PATH | native-run export --record PATH --out NEW_DIRECTORY';
export async function nativeRunCommand(args: string[]): Promise<unknown> {
  if (args.length === 0 || args[0] === '--help') return nativeRunHelp;
  const command = args[0],
    options: Record<string, string> = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--') || options[key])
      throw new Error(nativeRunHelp);
    options[key] = value;
  }
  const allowed =
    command === 'init'
      ? ['--plan', '--package', '--out']
      : command === 'export'
        ? ['--record', '--out']
        : ['validate', 'inspect'].includes(command!)
          ? ['--record']
          : [];
  if (
    !allowed.length ||
    Object.keys(options).length !== allowed.length ||
    allowed.some((k) => !options[k])
  )
    throw new Error(nativeRunHelp);
  if (command === 'init')
    return initNativeRun(options['--plan']!, options['--package']!, options['--out']!);
  if (command === 'export')
    return { record: await exportNativeRun(options['--record']!, options['--out']!) };
  const result =
    command === 'validate'
      ? await validateNativeRun(options['--record']!)
      : await inspectNativeRun(options['--record']!);
  return { valid: result.valid, problems: result.problems, continuation: result.continuation };
}
