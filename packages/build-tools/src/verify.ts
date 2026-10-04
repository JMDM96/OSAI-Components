import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { validateEvidence } from '@osai/adapter-schema';
import type { CompatibilityEvidence, EvidenceExpectations, GateResult } from '@osai/adapter-schema';
import { buildRelease, inspectRelease, readConfiguration, validateComponent } from './build.js';
import type { BuiltRelease } from './build.js';
import { checksum, payloadChecksums, registerRelease, writeJson } from './release.js';
import { canonicalJson } from '@osai/contract-schemas';
import { loadManifest } from '@osai/contract-schemas/authoring';
import type { Target } from '@osai/contract-schemas';
import { loadPolicy } from './policy.js';
import type { ReleasePolicy } from './policy.js';

interface BrowserAttachment {
  name: string;
  contentType: string;
  path?: string;
  body?: string;
}
interface BrowserResult {
  status: string;
  attachments?: BrowserAttachment[];
}
interface BrowserTest {
  projectName: string;
  annotations?: { type: string; description?: string }[];
  results: BrowserResult[];
  status: string;
}
interface BrowserSuite {
  title: string;
  suites?: BrowserSuite[];
  specs?: { title: string; tests: BrowserTest[] }[];
}
export interface BrowserReport {
  suites: BrowserSuite[];
  errors?: unknown[];
  stats: { expected: number; unexpected: number; skipped: number; flaky: number };
}
const browserGates = [
  'browser',
  'accessibility',
  'keyboard',
  'theme',
  'rtl',
  'visual',
  'multi-instance',
  'lifecycle',
  'leaks',
];
const resourceNames = [
  'listeners',
  'timers',
  'observers',
  'animationFrames',
  'workers',
  'portals',
  'backgroundLocks',
  'ownedRoots',
  'disposables',
  'shortcutClaims',
];
interface BrowserPin {
  name: string;
  revision: string;
  browserVersion: string;
}
interface VerificationAuthority {
  pins: BrowserPin[];
  gates: EvidenceExpectations['gates'];
  requiredGates: string[];
}

function policyGates(policy: ReleasePolicy): EvidenceExpectations['gates'] {
  const result: EvidenceExpectations['gates'] = Object.fromEntries(
    [
      'schema',
      'types',
      'lint',
      'unit',
      'contract',
      'dependencies',
      'reproducibility',
      'size',
      ...browserGates,
    ].map((name) => [name, { operator: 'at-most', threshold: 0 }]),
  );
  result.csp = { operator: 'at-most', threshold: policy.security.maxFindings };
  result.accessibility = { operator: 'at-most', threshold: policy.accessibility.maxViolations };
  result.leaks = { operator: 'at-most', threshold: policy.lifecycle.maxRetainedResources };
  result['lifecycle-cycles'] = { operator: 'at-least', threshold: policy.lifecycle.minCycles };
  result['javascript-size'] = {
    operator: 'at-most',
    threshold: policy.budgets.javascriptGzipBytes,
  };
  result['css-size'] = { operator: 'at-most', threshold: policy.budgets.cssGzipBytes };
  for (const name of policy.mandatoryGates)
    if (!result[name]) throw new Error(`No authoritative verifier rule exists for gate: ${name}`);
  return result;
}

async function authority(root: string, release: BuiltRelease): Promise<VerificationAuthority> {
  const config = await readConfiguration(root);
  const policy = await loadPolicy(resolve(root, config.policy));
  const loaded = await loadManifest(resolve(root, config.manifest));
  if (
    !loaded.ok ||
    !loaded.value ||
    canonicalJson(loaded.value) !== canonicalJson(release.manifest)
  )
    throw new Error('Release manifest differs from the authoritative source contract.');
  if (
    canonicalJson(config) !== canonicalJson(release.config) ||
    canonicalJson(policy) !== canonicalJson(release.policy)
  )
    throw new Error(
      'Release configuration or policy differs from authoritative repository inputs.',
    );
  if (
    new Set(config.targets).size !== config.targets.length ||
    canonicalJson([...config.targets].sort()) !== canonicalJson([...policy.targets].sort()) ||
    config.targets.some((target) => !loaded.value!.targets.includes(target))
  )
    throw new Error('Release target matrix differs from its authoritative policy and manifest.');
  const [lock, installed, pinFile] = await Promise.all([
    readFile(join(root, 'package-lock.json'), 'utf8').then(
      (text) => JSON.parse(text) as { packages: Record<string, { version?: string }> },
    ),
    readFile(join(root, 'node_modules/playwright-core/package.json'), 'utf8').then(
      (text) => JSON.parse(text) as { version?: string },
    ),
    readFile(join(root, 'node_modules/playwright-core/browsers.json'), 'utf8').then(
      (text) => JSON.parse(text) as { browsers: BrowserPin[] },
    ),
  ]);
  if (
    !installed.version ||
    lock.packages['node_modules/playwright-core']?.version !== installed.version
  )
    throw new Error('Installed browser toolchain differs from package-lock.json.');
  const pins = policy.browsers.map((name) => {
    const matching = pinFile.browsers.filter((pin) => pin.name === name);
    if (matching.length !== 1 || !matching[0]?.revision || !matching[0].browserVersion)
      throw new Error(`Missing or ambiguous pinned browser metadata: ${name}`);
    return matching[0];
  });
  const gates = policyGates(policy);
  return { pins, gates, requiredGates: Object.keys(gates) };
}

function expectations(
  release: BuiltRelease,
  target: Target,
  trusted: VerificationAuthority,
): EvidenceExpectations {
  return {
    componentId: release.manifest.componentId,
    version: release.manifest.version,
    target,
    policyVersion: release.policy.policyVersion,
    suiteVersion: '1.0.0',
    artifactChecksums: release.checksums,
    browserRevisions: Object.fromEntries(trusted.pins.map((pin) => [pin.name, pin.revision])),
    gates: trusted.gates,
  };
}

function validateUnitReport(unit: UnitReport): void {
  if (
    !unit.success ||
    !Number.isInteger(unit.numTotalTests) ||
    unit.numTotalTests < 1 ||
    unit.numFailedTests !== 0 ||
    unit.numPendingTests !== 0 ||
    !Array.isArray(unit.testResults)
  )
    throw new Error('Unit evidence contains failures, skipped tests, or no assertions.');
  if (
    unit.testResults.some(
      (result) =>
        result.status !== 'passed' ||
        result.assertionResults.some((assertion) => assertion.status !== 'passed'),
    )
  )
    throw new Error('A reported unit assertion has not passed.');
  const count = unit.testResults.reduce(
    (total, result) => total + result.assertionResults.length,
    0,
  );
  if (count !== unit.numTotalTests)
    throw new Error('Unit assertion count differs from its report summary.');
  for (const area of [
    'contract-schemas',
    'component-sdk',
    'runtime-bridge',
    'command-palette',
    'build-tools',
    'adapter-schema',
  ])
    if (
      !unit.testResults.some(
        (result) =>
          result.name.replaceAll('\\', '/').includes(`/${area}/`) && result.assertionResults.length,
      )
    )
      throw new Error(`Missing unit coverage for ${area}`);
}
interface BrowserProof {
  target: string;
  browser: string;
  browserVersion: string;
  artifactChecksum: string;
  artifacts: Record<string, string>;
  suiteVersion: string;
  policyVersion: string;
}
interface LeakProof {
  cycles: number;
  snapshot: {
    instances: number;
    subscriptions: number;
    pendingEvents: number;
    resources: Record<string, number>;
  };
}
interface UnitReport {
  success: boolean;
  numTotalTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: { name: string; status: string; assertionResults: { status: string }[] }[];
}

function flatten(suites: BrowserSuite[]): BrowserTest[] {
  return suites.flatMap((suite) => [
    ...(suite.specs ?? []).flatMap((spec) => spec.tests),
    ...flatten(suite.suites ?? []),
  ]);
}
async function attachment<T>(test: BrowserTest, name: string): Promise<T | undefined> {
  const matches = test.results
    .flatMap((result) => result.attachments ?? [])
    .filter((value) => value.name === name);
  if (matches.length > 1) throw new Error(`Ambiguous duplicate evidence attachment: ${name}`);
  const item = matches[0];
  if (!item) return undefined;
  if (item.contentType !== 'application/json')
    throw new Error(`Evidence attachment must be JSON: ${name}`);
  const content = item.path
    ? await readFile(item.path, 'utf8')
    : Buffer.from(item.body ?? '', 'base64').toString('utf8');
  return JSON.parse(content) as T;
}
function failing(tests: BrowserTest[]): number {
  return tests.filter(
    (test) =>
      test.status !== 'expected' ||
      test.results.length !== 1 ||
      test.results[0]?.status !== 'passed',
  ).length;
}
function gate(
  gate: string,
  measured: number,
  threshold: number,
  evidence: string,
  operator: 'at-most' | 'at-least' = 'at-most',
): GateResult {
  return {
    gate,
    measured,
    threshold,
    operator,
    evidence,
    passed: operator === 'at-most' ? measured <= threshold : measured >= threshold,
  };
}

export async function runStep(root: string, name: string, script: string): Promise<void> {
  const npm =
    process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const log = join(root, 'test-results/gates', `${name}.log`);
  await mkdir(dirname(log), { recursive: true });
  console.log(`Verifying ${name}…`);
  const result = spawnSync(process.execPath, [npm, 'run', script], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  await writeFile(log, output, 'utf8');
  if (result.status !== 0)
    throw new Error(
      `${name} failed (${result.status ?? result.error?.message}). See ${log}\n${output.slice(-8000)}`,
    );
}

export async function collectEvidence(
  root: string,
  release: BuiltRelease,
  report: BrowserReport,
): Promise<CompatibilityEvidence[]> {
  const trusted = await authority(root, release);
  if (
    !report?.stats ||
    !Array.isArray(report.suites) ||
    ['expected', 'unexpected', 'skipped', 'flaky'].some((name) => {
      const value = report.stats[name as keyof BrowserReport['stats']];
      return !Number.isInteger(value) || value < 0;
    })
  )
    throw new Error('Invalid browser report summary.');
  if (
    report.errors?.length ||
    report.stats.unexpected ||
    report.stats.skipped ||
    report.stats.flaky
  )
    throw new Error('Browser report has errors, failures, skipped, or flaky tests.');
  const tests = flatten(report.suites);
  const projects = new Set(
    release.config.targets.flatMap((target) =>
      release.policy.browsers.map((browser) => `${target}-${browser}`),
    ),
  );
  if (
    !tests.length ||
    report.stats.expected !== tests.length ||
    tests.some((test) => !projects.has(test.projectName))
  )
    throw new Error('Browser report count or project matrix differs from the required suite.');
  const records: CompatibilityEvidence[] = [];
  for (const target of release.config.targets) {
    const selected = tests.filter((test) => test.projectName.startsWith(`${target}-`));
    if (!selected.length || failing(selected))
      throw new Error(`No complete passing browser suite for ${target}.`);
    const results: CompatibilityEvidence['browserResults'] = [];
    const gateFailures: Record<string, number> = {};
    let minCycles = Infinity;
    let maxResources = 0;
    let violations = 0;
    for (const browser of release.policy.browsers) {
      const cases = selected.filter((test) => test.projectName === `${target}-${browser}`);
      const pin = trusted.pins.find((item) => item.name === browser);
      if (!pin || !cases.length || failing(cases))
        throw new Error(`Missing pinned browser coverage: ${target}/${browser}`);
      const proofs = await Promise.all(
        cases.map((test) => attachment<BrowserProof>(test, 'compatibility-evidence')),
      );
      const expectedArtifacts = Object.fromEntries(
        ['js', 'css'].map((extension) => {
          const file = `${release.manifest.componentId}.${extension}`;
          return [file, release.checksums[`${target}/${file}`]];
        }),
      );
      for (const proof of proofs)
        if (
          !proof ||
          proof.target !== target ||
          proof.browser !== browser ||
          proof.artifactChecksum !==
            release.checksums[`${target}/${release.manifest.componentId}.js`] ||
          canonicalJson(proof.artifacts ?? null) !== canonicalJson(expectedArtifacts) ||
          proof.policyVersion !== release.policy.policyVersion ||
          proof.suiteVersion !== '1.0.0' ||
          proof.browserVersion !== pin.browserVersion
        )
          throw new Error(`Browser proof does not match the built payload: ${target}/${browser}`);
      results.push({
        browser,
        revision: pin.revision,
        version: proofs[0]!.browserVersion,
        passed: cases.length,
        failed: 0,
        skipped: 0,
      });
      for (const name of browserGates) {
        const coverage = cases.filter((test) =>
          test.annotations?.some(
            (annotation) => annotation.type === 'gate' && annotation.description === name,
          ),
        );
        if (!coverage.length) throw new Error(`No ${name} coverage for ${target}/${browser}`);
        gateFailures[name] = (gateFailures[name] ?? 0) + failing(coverage);
      }
      const leakCases = cases.filter((test) =>
        test.annotations?.some(
          (annotation) => annotation.type === 'gate' && annotation.description === 'leaks',
        ),
      );
      for (const item of leakCases) {
        const proof = await attachment<LeakProof>(item, 'leak-measurements');
        if (
          !proof ||
          !Number.isInteger(proof.cycles) ||
          proof.cycles < 0 ||
          !proof.snapshot?.resources
        )
          throw new Error('Missing measured leak evidence.');
        const values = [
          proof.snapshot.instances,
          proof.snapshot.subscriptions,
          proof.snapshot.pendingEvents,
          ...resourceNames.map((name) => proof.snapshot.resources[name]),
          ...Object.values(proof.snapshot.resources),
        ];
        if (values.some((value) => !Number.isInteger(value) || value === undefined || value < 0))
          throw new Error('Invalid leak measurements.');
        minCycles = Math.min(minCycles, proof.cycles);
        maxResources = Math.max(maxResources, ...(values as number[]));
      }
      const a11y = cases.filter((test) =>
        test.annotations?.some(
          (annotation) => annotation.type === 'gate' && annotation.description === 'accessibility',
        ),
      );
      let measuredA11y = 0;
      for (const item of a11y) {
        const proof = await attachment<{ violations: number }>(item, 'accessibility-measurements');
        if (!proof) continue;
        if (!Number.isInteger(proof.violations) || proof.violations < 0)
          throw new Error('Invalid accessibility measurement.');
        violations += proof.violations;
        measuredA11y++;
      }
      if (!measuredA11y)
        throw new Error(`Missing measured accessibility audit for ${target}/${browser}`);
    }
    const measures = release.measurements[target];
    if (!measures || Object.values(measures).some((value) => !Number.isInteger(value) || value < 0))
      throw new Error(`Invalid build gate measurements for ${target}.`);
    const gates: GateResult[] = [
      ...['schema', 'types', 'lint', 'unit', 'contract', 'reproducibility'].map((name) =>
        gate(name, 0, 0, `evidence/reports/${name}.log`),
      ),
      gate('dependencies', measures.dependencyFindings, 0, 'evidence/reports/dependencies.log'),
      gate(
        'csp',
        measures.securityFindings,
        release.policy.security.maxFindings,
        'evidence/reports/csp.log',
      ),
      ...['browser', 'keyboard', 'theme', 'rtl', 'visual', 'multi-instance', 'lifecycle'].map(
        (name) => gate(name, gateFailures[name] ?? Infinity, 0, 'evidence/reports/browser.json'),
      ),
      gate(
        'accessibility',
        violations,
        release.policy.accessibility.maxViolations,
        'evidence/reports/browser.json',
      ),
      gate(
        'leaks',
        maxResources,
        release.policy.lifecycle.maxRetainedResources,
        'evidence/reports/browser.json',
      ),
      gate(
        'lifecycle-cycles',
        minCycles,
        release.policy.lifecycle.minCycles,
        'evidence/reports/browser.json',
        'at-least',
      ),
      gate(
        'size',
        Number(measures.javascriptGzipBytes > release.policy.budgets.javascriptGzipBytes) +
          Number(measures.cssGzipBytes > release.policy.budgets.cssGzipBytes),
        0,
        'shared/release.json',
      ),
      gate(
        'javascript-size',
        measures.javascriptGzipBytes,
        release.policy.budgets.javascriptGzipBytes,
        'shared/release.json',
      ),
      gate(
        'css-size',
        measures.cssGzipBytes,
        release.policy.budgets.cssGzipBytes,
        'shared/release.json',
      ),
    ];
    const record: CompatibilityEvidence = {
      schemaVersion: '1.0',
      componentId: release.manifest.componentId,
      version: release.manifest.version,
      target,
      status: 'browser-verified',
      policyVersion: release.policy.policyVersion,
      suiteVersion: '1.0.0',
      artifactChecksums: release.checksums,
      browserResults: results,
      gates,
      hostEvidence: [],
    };
    const issues = validateEvidence(
      record,
      trusted.requiredGates,
      release.policy.browsers,
      expectations(release, target, trusted),
    );
    if (issues.length) throw new Error(`Evidence validation failed: ${issues.join('; ')}`);
    records.push(record);
  }
  return records;
}

export async function registerVerifiedRelease(
  release: BuiltRelease,
  records: CompatibilityEvidence[],
  catalogPath: string,
  root = process.cwd(),
): Promise<void> {
  const trusted = await authority(root, release);
  if (
    records.length !== release.config.targets.length ||
    new Set(records.map((record) => record.target)).size !== records.length
  )
    throw new Error('Each required target needs exactly one verification record.');
  for (const target of release.config.targets) {
    const record = records.find((value) => value.target === target);
    if (!record || record.status !== 'browser-verified' || record.hostEvidence.length)
      throw new Error('Local registration requires browser verification without tenant claims.');
    const issues = validateEvidence(
      record,
      trusted.requiredGates,
      release.policy.browsers,
      expectations(release, target, trusted),
    );
    if (issues.length) throw new Error(`Release evidence is invalid: ${issues.join('; ')}`);
    for (const browser of record.browserResults)
      if (
        browser.version !== trusted.pins.find((pin) => pin.name === browser.browser)?.browserVersion
      )
        throw new Error('Recorded browser version differs from the pinned toolchain.');
  }
  if (canonicalJson(await payloadChecksums(release.root)) !== canonicalJson(release.checksums))
    throw new Error('Verified payload changed before catalog registration.');
  await inspectRelease(release.root);
  const storedRelease = JSON.parse(
    await readFile(join(release.root, 'shared/release.json'), 'utf8'),
  ) as { measurements: BuiltRelease['measurements'] };
  if (canonicalJson(storedRelease.measurements) !== canonicalJson(release.measurements))
    throw new Error('Build measurements differ from the inspected release.');
  const reports = join(release.root, 'evidence/reports');
  validateUnitReport(JSON.parse(await readFile(join(reports, 'unit.json'), 'utf8')) as UnitReport);
  const reproduction = JSON.parse(
    await readFile(join(reports, 'reproducibility.json'), 'utf8'),
  ) as {
    first: { checksums: Record<string, string> };
    second: { checksums: Record<string, string> };
  };
  if (
    canonicalJson(reproduction.first?.checksums) !== canonicalJson(release.checksums) ||
    canonicalJson(reproduction.second?.checksums) !== canonicalJson(release.checksums)
  )
    throw new Error('Clean-workspace reproduction evidence differs from this payload.');
  const report = JSON.parse(await readFile(join(reports, 'browser.json'), 'utf8')) as BrowserReport;
  const measured = await collectEvidence(root, release, report);
  const ordered = (values: CompatibilityEvidence[]) =>
    [...values].sort((a, b) => a.target.localeCompare(b.target));
  if (canonicalJson(ordered(measured)) !== canonicalJson(ordered(records)))
    throw new Error('Submitted records differ from the archived browser measurements.');
  for (const record of records)
    for (const result of record.gates) {
      if (
        result.evidence.startsWith('/') ||
        result.evidence.includes('\\') ||
        /^[A-Za-z]+:/.test(result.evidence) ||
        result.evidence.split('/').some((part) => !part || part === '.' || part === '..')
      )
        throw new Error('Gate evidence must reference an artifact inside this release.');
      await readFile(join(release.root, result.evidence));
    }
  await registerRelease(catalogPath, {
    componentId: release.manifest.componentId,
    version: release.manifest.version,
    payloadDigest: checksum(canonicalJson(release.checksums)),
    manifest: release.manifest,
  });
}

export async function verify(root: string, register: boolean, version?: string): Promise<void> {
  let stage = 'configuration';
  let policyVersion: string | null = null;
  try {
    const configuration = await readConfiguration(root);
    policyVersion = (await loadPolicy(resolve(root, configuration.policy))).policyVersion;
    stage = 'schema';
    const { manifest } = await validateComponent(root);
    stage = 'version';
    if (version && version !== manifest.version)
      throw new Error(
        `Requested version ${version} differs from manifest ${manifest.version}; update the source contract first.`,
      );
    for (const [name, script] of [
      ['format', 'format:check'],
      ['lint', 'lint'],
      ['types', 'typecheck'],
      ['unit', 'test:unit'],
    ] as const) {
      stage = name;
      await runStep(root, name, script);
    }
    stage = 'unit-evidence';
    const unit = JSON.parse(
      await readFile(join(root, 'test-results/unit.json'), 'utf8'),
    ) as UnitReport;
    validateUnitReport(unit);
    stage = 'build';
    const release = await buildRelease(root);
    stage = 'browser';
    await runStep(root, 'browser', 'test:browser');
    stage = 'reproducibility';
    const { proveCleanWorkspaceReproducibility } = await import('./clean-workspaces.js');
    const reproduced = await proveCleanWorkspaceReproducibility(root, { onProgress: console.log });
    if (canonicalJson(reproduced.first.checksums) !== canonicalJson(release.checksums))
      throw new Error('Clean workspace build differs from verified workspace build.');
    stage = 'browser-evidence';
    const report = JSON.parse(
      await readFile(join(root, 'test-results/browser.json'), 'utf8'),
    ) as BrowserReport;
    const records = await collectEvidence(root, release, report);
    stage = 'evidence-archive';
    const reports = join(release.root, 'evidence/reports');
    await mkdir(reports, { recursive: true });
    for (const file of ['unit.json', 'browser.json'])
      await cp(join(root, 'test-results', file), join(reports, file));
    for (const name of ['format', 'lint', 'types', 'unit', 'browser'])
      await cp(join(root, 'test-results/gates', `${name}.log`), join(reports, `${name}.log`));
    for (const name of ['schema', 'contract', 'dependencies', 'csp'])
      await writeFile(
        join(reports, `${name}.log`),
        `Validated by build and named unit suites; component ${manifest.componentId}@${manifest.version}; payload ${checksum(canonicalJson(release.checksums))}.\n`,
      );
    await writeJson(join(reports, 'reproducibility.json'), reproduced);
    await writeFile(
      join(reports, 'reproducibility.log'),
      `Two clean workspaces installed from the lockfile produced ${Object.keys(release.checksums).length} byte-identical payload files.\n`,
    );
    for (const record of records)
      await writeJson(join(release.root, 'evidence', `${record.target}.json`), record);
    stage = 'package-inspection';
    await inspectRelease(release.root);
    if (register) {
      stage = 'registration';
      await registerVerifiedRelease(release, records, join(root, 'releases/catalog.json'), root);
    }
    console.log(
      `${register ? 'Registered' : 'Verified'} ${manifest.componentId}@${manifest.version}: ${unit.numTotalTests} unit tests, ${report.stats.expected} browser tests; both targets browser-verified.\n${release.root}`,
    );
  } catch (error) {
    await writeJson(join(root, 'test-results/verification-failure.json'), {
      schemaVersion: '1.0',
      operation: register ? 'release' : 'verify',
      occurredAt: new Date().toISOString(),
      policyVersion,
      stage,
      gate: stage,
      metric: 'failed-checks',
      measured: 1,
      threshold: 0,
      operator: 'at-most',
      passed: false,
      error: {
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
