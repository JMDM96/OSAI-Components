import { beforeAll, describe, expect, it } from 'vitest';
import { access, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease } from './build.js';
import type { BuiltRelease } from './build.js';
import {
  collectEvidence,
  registerVerifiedRelease,
  verify,
  evidenceProvenance,
  evidenceReadiness,
} from './verify.js';
import { loadCertification, requiredInventory } from './certification.js';
import type { Certification } from './certification.js';
import { selectComponents } from './registry.js';
import { prepareCleanWorkspace } from './clean-workspaces.js';
import type { BrowserReport } from './verify.js';
import type { CompatibilityEvidence } from '@osai/adapter-schema';

const root = process.cwd();
let built: BuiltRelease;
let certification: Certification;
let inventory: string[];
let pins: { name: string; revision: string; browserVersion: string }[];
const gates = [
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

beforeAll(async () => {
  const [component] = await selectComponents(root, {});
  certification = await loadCertification(component!);
  inventory = await requiredInventory(root, certification);
  built = await buildRelease(root, {
    outputRoot: await mkdtemp(join(tmpdir(), 'osai-verifier-payload-')),
  });
  pins = (
    JSON.parse(
      await readFile(join(root, 'node_modules/playwright-core/browsers.json'), 'utf8'),
    ) as { browsers: typeof pins }
  ).browsers;
}, 30_000);

function jsonAttachment(name: string, value: unknown) {
  return {
    name,
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(value)).toString('base64'),
  };
}

function browserReport(release = built): BrowserReport {
  const specs = inventory.map((id) => ({
    title: id.startsWith('palette/') ? id.slice(8) : id,
    tests: release.config.targets.flatMap((target) =>
      release.policy.browsers.map((browser) => ({
        projectName: `${target}-${browser}`,
        status: 'expected',
        annotations: gates.map((description) => ({ type: 'gate', description })),
        results: [
          {
            status: 'passed',
            attachments: [
              jsonAttachment('compatibility-evidence', {
                target,
                browser,
                browserVersion: pins.find((pin) => pin.name === browser)!.browserVersion,
                artifactChecksum: release.checksums[`${target}/${release.manifest.componentId}.js`],
                artifacts: Object.fromEntries(
                  ['js', 'css'].map((extension) => {
                    const file = `${release.manifest.componentId}.${extension}`;
                    return [file, release.checksums[`${target}/${file}`]];
                  }),
                ),
                policyVersion: release.policy.policyVersion,
                suiteVersion: '2.0.0',
              }),
              jsonAttachment('accessibility-measurements', { violations: 0 }),
              jsonAttachment('leak-measurements', {
                cycles: 100,
                snapshot: {
                  instances: 0,
                  subscriptions: 0,
                  pendingEvents: 0,
                  resources: Object.fromEntries(resourceNames.map((name) => [name, 0])),
                },
              }),
              jsonAttachment('scenario-evidence', {
                schemaVersion: '2.0',
                scenarioId: id,
                componentId: release.manifest.componentId,
                version: release.manifest.version,
                target,
                browser,
                browserVersion: pins.find((pin) => pin.name === browser)!.browserVersion,
                suiteVersion: '2.0.0',
                ...evidenceProvenance(certification, release.policy),
                artifactChecksums: release.checksums,
                passed: true,
                afterCleanup: {
                  before: { effects: 0 },
                  after: {
                    ...Object.fromEntries(
                      [
                        'listeners',
                        'timers',
                        'animationFrames',
                        'observers',
                        'workers',
                        'portals',
                        'effects',
                      ].map((name) => [name, 0]),
                    ),
                    workerUrls: [],
                    origins: [],
                    portalSelectors: [],
                    apis: [],
                  },
                  managed: {
                    instances: 0,
                    subscriptions: 0,
                    pendingEvents: 0,
                    resources: Object.fromEntries(
                      [...resourceNames, 'operations'].map((name) => [name, 0]),
                    ),
                  },
                },
                measurement:
                  id === 'platform/cleanup'
                    ? { cycles: 100 }
                    : id === 'platform/accessibility'
                      ? {
                          violations: 0,
                          componentObservations: {
                            workerUrls: [],
                            origins: [],
                            portalSelectors: [],
                            apis: [],
                          },
                        }
                      : id === 'platform/negative-listener'
                        ? { rejected: true }
                        : id === 'platform/negative-performance'
                          ? {
                              rejected: true,
                              measuredMs: certification.profile.benchmark.input.worstMs + 10,
                              thresholdMs: certification.profile.benchmark.input.worstMs,
                            }
                          : id === 'platform/benchmark'
                            ? {
                                settings: certification.profile.benchmark,
                                environment: {
                                  userAgent: 'Synthetic regression input',
                                  platform: 'test',
                                },
                                resources: Object.fromEntries(
                                  [
                                    'listeners',
                                    'timers',
                                    'animationFrames',
                                    'observers',
                                    'workers',
                                    'portals',
                                  ].map((name) => [name, 0]),
                                ),
                                workloads: [1000, 10000].map((records) => ({
                                  records,
                                  samples: {
                                    create: Array(30).fill(1),
                                    update: Array(30).fill(1),
                                    input: Array(30).fill(1),
                                  },
                                  create: { p95Ms: 1, worstMs: 1 },
                                  update: { p95Ms: 1, worstMs: 1 },
                                  input: { p95Ms: 1, worstMs: 1 },
                                })),
                              }
                            : {
                                assertions: 1,
                                commands: Object.keys(release.manifest.commands),
                                events: Object.keys(release.manifest.events),
                              },
              }),
            ],
          },
        ],
      })),
    ),
  }));
  const tests = specs.flatMap((spec) => spec.tests);
  return {
    suites: [{ title: 'Synthetic parser input', specs }],
    stats: { expected: tests.length, unexpected: 0, skipped: 0, flaky: 0 },
    errors: [],
  };
}

function firstTest(report: BrowserReport) {
  return report.suites[0]!.specs![0]!.tests[0]!;
}
function changeAttachment(
  report: BrowserReport,
  name: string,
  mutate: (value: Record<string, unknown>) => void,
): void {
  const attachment = firstTest(report).results[0]!.attachments!.find(
    (value) => value.name === name,
  )!;
  const value = JSON.parse(Buffer.from(attachment.body!, 'base64').toString('utf8')) as Record<
    string,
    unknown
  >;
  mutate(value);
  attachment.body = Buffer.from(JSON.stringify(value)).toString('base64');
}

async function archivedFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'osai-verifier-registration-'));
  const release = { ...structuredClone(built), root: join(directory, 'payload') };
  await cp(built.root, release.root, { recursive: true });
  const report = browserReport(release);
  const records = await collectEvidence(root, release, report);
  const reports = join(release.root, 'evidence/reports');
  await mkdir(reports, { recursive: true });
  await writeFile(join(reports, 'browser.json'), JSON.stringify(report));
  const areas = [
    'contract-schemas',
    'component-sdk',
    'runtime-bridge',
    'command-palette',
    'build-tools',
    'adapter-schema',
  ];
  await writeFile(
    join(reports, 'unit.json'),
    JSON.stringify({
      success: true,
      numTotalTests: areas.length,
      numFailedTests: 0,
      numPendingTests: 0,
      testResults: areas.map((area) => ({
        name: `/fixture/${area}/test.ts`,
        status: 'passed',
        assertionResults: [{ status: 'passed' }],
      })),
    }),
  );
  await writeFile(
    join(reports, 'reproducibility.json'),
    JSON.stringify({
      first: { checksums: release.checksums },
      second: { checksums: release.checksums },
    }),
  );
  for (const record of records)
    for (const gate of record.gates)
      if (gate.evidence.endsWith('.log'))
        await writeFile(
          join(release.root, gate.evidence),
          'Synthetic successful measured gate for verifier regression test.\n',
        );
  return { release, report, records, reports, catalog: join(directory, 'catalog.json') };
}

describe('browser measurement parser', () => {
  it('accepts a complete target/browser matrix and records authoritative measured thresholds', async () => {
    const report = browserReport();
    Object.assign(report.stats, { startTime: '2026-10-04T00:00:00Z', duration: 12.5 });
    const records = await collectEvidence(root, built, report);
    expect(records.map((record) => record.target)).toEqual(['odc', 'o11-reactive']);
    for (const record of records) {
      expect(record.status).toBe('browser-verified');
      expect(record.hostEvidence).toEqual([]);
      expect(record.gates.find((gate) => gate.gate === 'lifecycle-cycles')).toMatchObject({
        measured: 100,
        threshold: 100,
        operator: 'at-least',
        passed: true,
      });
      expect(record.gates.find((gate) => gate.gate === 'javascript-size')?.threshold).toBe(
        built.policy.budgets.javascriptGzipBytes,
      );
      expect(record.browserResults.map((browser) => browser.revision)).toEqual(
        built.policy.browsers.map((name) => pins.find((pin) => pin.name === name)!.revision),
      );
    }
  });

  it.each([
    ['artifactChecksum', '0'.repeat(64)],
    ['policyVersion', '99.0.0'],
    ['suiteVersion', 'old-suite'],
    ['browserVersion', '0.0.0'],
    ['artifacts', {}],
  ])('rejects stale or incorrect proof %s', async (field, value) => {
    const report = browserReport();
    changeAttachment(report, 'compatibility-evidence', (proof) => {
      proof[field] = value;
    });
    await expect(collectEvidence(root, built, report)).rejects.toThrow('does not match');
  });

  it('rejects CSS proof drift even when the JavaScript proof still matches', async () => {
    const report = browserReport();
    changeAttachment(report, 'compatibility-evidence', (proof) => {
      (proof.artifacts as Record<string, string>)['command-palette.css'] = '0'.repeat(64);
    });
    await expect(collectEvidence(root, built, report)).rejects.toThrow('does not match');
  });

  it.each(['unexpected', 'skipped', 'flaky'] as const)(
    'rejects a nonzero %s report summary',
    async (field) => {
      const report = browserReport();
      report.stats[field] = 1;
      await expect(collectEvidence(root, built, report)).rejects.toThrow(
        'failures, skipped, or flaky',
      );
    },
  );

  it('rejects individual failures, missing browser cells, unknown projects and incorrect totals', async () => {
    const failed = browserReport();
    firstTest(failed).results[0]!.status = 'failed';
    await expect(collectEvidence(root, built, failed)).rejects.toThrow('passing browser');
    const missing = browserReport();
    missing.suites[0]!.specs![0]!.tests.pop();
    missing.stats.expected--;
    await expect(collectEvidence(root, built, missing)).rejects.toThrow('scenario inventory');
    const extra = browserReport();
    firstTest(extra).projectName = 'unknown-chromium';
    await expect(collectEvidence(root, built, extra)).rejects.toThrow('project matrix');
    const total = browserReport();
    total.stats.expected++;
    await expect(collectEvidence(root, built, total)).rejects.toThrow('count or project');
  });

  it('uses exact scenario inventory instead of annotations and rejects duplicate or missing evidence', async () => {
    const missing = browserReport();
    firstTest(missing).annotations = firstTest(missing).annotations!.filter(
      (value) => value.description !== 'keyboard',
    );
    await expect(collectEvidence(root, built, missing)).resolves.toHaveLength(2);
    const duplicate = browserReport();
    firstTest(duplicate).results[0]!.attachments!.push(
      firstTest(duplicate).results[0]!.attachments![0]!,
    );
    await expect(collectEvidence(root, built, duplicate)).rejects.toThrow('duplicate evidence');
    const proof = browserReport();
    firstTest(proof).results[0]!.attachments = [];
    await expect(collectEvidence(root, built, proof)).rejects.toThrow('does not match');
  });

  it.each([
    'profileHash',
    'contractHash',
    'descriptorHash',
    'policyHash',
    'suiteHash',
    'componentId',
    'scenarioId',
  ])('rejects stale or substituted scenario provenance %s', async (field) => {
    const report = browserReport();
    changeAttachment(report, 'scenario-evidence', (proof) => {
      proof[field] = 'unmatched';
    });
    await expect(collectEvidence(root, built, report)).rejects.toThrow('provenance');
  });
  it('rejects omitted and duplicated passing scenarios even with forged gate annotations', async () => {
    const report = browserReport();
    report.suites[0]!.specs!.splice(1, 1);
    report.stats.expected -= 6;
    await expect(collectEvidence(root, built, report)).rejects.toThrow('scenario inventory');
    const duplicate = browserReport();
    duplicate.suites[0]!.specs!.push(structuredClone(duplicate.suites[0]!.specs![0]!));
    duplicate.stats.expected += 6;
    await expect(collectEvidence(root, built, duplicate)).rejects.toThrow('scenario inventory');
  });
  it('rejects independent leaks when SDK counters are zero', async () => {
    const report = browserReport();
    changeAttachment(report, 'scenario-evidence', (proof) => {
      (proof.afterCleanup as { after: { listeners: number } }).after.listeners = 1;
    });
    await expect(collectEvidence(root, built, report)).rejects.toThrow('cleanup');
  });
  it('rejects deliberately slow measurements without changing the profile', async () => {
    const report = browserReport();
    const spec = report.suites[0]!.specs!.find((spec) => spec.title === 'platform/benchmark')!;
    const attachment = spec.tests[0]!.results[0]!.attachments!.find(
      (item) => item.name === 'scenario-evidence',
    )!;
    const proof = JSON.parse(Buffer.from(attachment.body!, 'base64').toString('utf8'));
    proof.measurement.workloads[0].samples.create = Array(30).fill(99999);
    proof.measurement.workloads[0].create = { p95Ms: 99999, worstMs: 99999 };
    attachment.body = Buffer.from(JSON.stringify(proof)).toString('base64');
    await expect(collectEvidence(root, built, report)).rejects.toThrow('Performance profile');
  });

  it('separates scanner allocations while still requiring declared component observations', async () => {
    const report = browserReport();
    const spec = report.suites[0]!.specs!.find((spec) => spec.title === 'platform/accessibility')!;
    const attachment = spec.tests[0]!.results[0]!.attachments!.find(
      (item) => item.name === 'scenario-evidence',
    )!;
    const proof = JSON.parse(Buffer.from(attachment.body!, 'base64').toString('utf8'));
    const save = () => {
      attachment.body = Buffer.from(JSON.stringify(proof)).toString('base64');
    };
    proof.afterCleanup.after.observers = 1;
    proof.afterCleanup.after.apis = ['MutationObserver'];
    save();
    await expect(collectEvidence(root, built, report)).resolves.toHaveLength(2);
    proof.measurement.componentObservations.apis = ['UndeclaredBrowserApi'];
    save();
    await expect(collectEvidence(root, built, report)).rejects.toThrow('not declared');
    delete proof.measurement.componentObservations;
    save();
    await expect(collectEvidence(root, built, report)).rejects.toThrow(
      'Missing observed capability',
    );
  });

  it('does not infer zero leaks or accessibility violations from an incomplete measurement', async () => {
    const missing = browserReport();
    changeAttachment(missing, 'leak-measurements', (proof) => {
      const snapshot = proof.snapshot as { resources: Record<string, number> };
      delete snapshot.resources.observers;
    });
    await expect(collectEvidence(root, built, missing)).rejects.toThrow(
      'Invalid leak measurements',
    );
    const leaking = browserReport();
    changeAttachment(leaking, 'leak-measurements', (proof) => {
      const snapshot = proof.snapshot as { resources: Record<string, number> };
      snapshot.resources.listeners = 1;
    });
    await expect(collectEvidence(root, built, leaking)).rejects.toThrow('leaks');
    const short = browserReport();
    changeAttachment(short, 'leak-measurements', (proof) => {
      proof.cycles = 99;
    });
    await expect(collectEvidence(root, built, short)).rejects.toThrow('lifecycle-cycles');
    const inaccessible = browserReport();
    changeAttachment(inaccessible, 'accessibility-measurements', (proof) => {
      proof.violations = 1;
    });
    await expect(collectEvidence(root, built, inaccessible)).rejects.toThrow('accessibility');
  });

  it('uses measured security and dependency failures and refuses modified release policy inputs', async () => {
    const badSecurity = structuredClone(built);
    badSecurity.measurements.odc.securityFindings = 1;
    await expect(collectEvidence(root, badSecurity, browserReport())).rejects.toThrow('csp');
    const badDependencies = structuredClone(built);
    badDependencies.measurements.odc.dependencyFindings = 1;
    await expect(collectEvidence(root, badDependencies, browserReport())).rejects.toThrow(
      'dependencies',
    );
    const weakened = structuredClone(built);
    weakened.policy.lifecycle.minCycles = 1;
    await expect(collectEvidence(root, weakened, browserReport())).rejects.toThrow(
      'authoritative repository inputs',
    );
  });
});

describe('verification before immutable registration', () => {
  it('never grants readiness from missing, stale, target-mismatched or invented evidence', async () => {
    const setup = await archivedFixture();
    const record = setup.records.find((record) => record.target === 'odc')!;
    expect(await evidenceReadiness(root, setup.release, record, 'odc')).toBe('browser-verified');
    expect(await evidenceReadiness(root, setup.release, record, 'o11-reactive')).toBe('stale');
    for (const mutate of [
      (value: CompatibilityEvidence) => {
        value.componentId = 'sibling';
      },
      (value: CompatibilityEvidence) => {
        value.provenance!.descriptorHash = '0'.repeat(64);
      },
      (value: CompatibilityEvidence) => {
        value.scenarios!.pop();
      },
      (value: CompatibilityEvidence) => {
        value.gates[0]!.passed = false;
      },
      (value: CompatibilityEvidence) => {
        value.status = 'OutSystems-verified';
      },
    ]) {
      const copy = structuredClone(record);
      mutate(copy);
      expect(await evidenceReadiness(root, setup.release, copy, 'odc')).toBe('stale');
    }
    await writeFile(join(setup.reports, 'browser.json'), '{}');
    expect(await evidenceReadiness(root, setup.release, record, 'odc')).toBe('stale');
  });
  it.each([false, true])(
    'records machine-readable failures from actual verify/release execution (register=%s)',
    async (register) => {
      const directory = await mkdtemp(join(tmpdir(), 'osai-verification-failure-'));
      await prepareCleanWorkspace(root, directory);
      await writeFile(
        join(directory, 'build.config.json'),
        JSON.stringify({
          ...built.config,
          manifest: built.config.manifest,
          policy: join(root, built.config.policy),
        }),
      );
      await expect(verify(directory, register, '99.0.0')).rejects.toThrow('Requested version');
      const failure = JSON.parse(
        await readFile(
          join(directory, 'test-results/command-palette/verification-failure.json'),
          'utf8',
        ),
      );
      expect(failure).toMatchObject({
        schemaVersion: '1.0',
        policyVersion: built.policy.policyVersion,
        operation: register ? 'release' : 'verify',
        stage: 'version',
        gate: 'version',
        metric: 'failed-checks',
        measured: 1,
        threshold: 0,
        operator: 'at-most',
        passed: false,
        error: { name: 'Error', message: expect.stringContaining('Requested version') },
      });
      expect(Number.isNaN(Date.parse(failure.occurredAt as string))).toBe(false);
      await expect(access(join(directory, 'releases/catalog.json'))).rejects.toThrow();
    },
  );

  it('registers only matching archived measurements and permits exact retry', async () => {
    const setup = await archivedFixture();
    await registerVerifiedRelease(setup.release, setup.records, setup.catalog, root);
    const initial = await readFile(setup.catalog, 'utf8');
    await registerVerifiedRelease(setup.release, setup.records, setup.catalog, root);
    expect(await readFile(setup.catalog, 'utf8')).toBe(initial);
    expect(JSON.parse(initial)).toHaveLength(1);
  });

  const mutations: [string, (record: CompatibilityEvidence) => void][] = [
    [
      'forced failed gate',
      (record) => {
        record.gates[0]!.passed = false;
      },
    ],
    [
      'forged threshold',
      (record) => {
        record.gates.find((gate) => gate.gate === 'leaks')!.threshold = 100;
      },
    ],
    [
      'missing gate',
      (record) => {
        record.gates = record.gates.filter((gate) => gate.gate !== 'lifecycle-cycles');
      },
    ],
    [
      'duplicate gate',
      (record) => {
        record.gates.push(record.gates[0]!);
      },
    ],
    [
      'stale artifact',
      (record) => {
        record.artifactChecksums['odc/command-palette.js'] = '0'.repeat(64);
      },
    ],
    [
      'wrong component',
      (record) => {
        record.componentId = 'other';
      },
    ],
    [
      'wrong policy',
      (record) => {
        record.policyVersion = '99.0.0';
      },
    ],
    [
      'wrong browser revision',
      (record) => {
        record.browserResults[0]!.revision = '999';
      },
    ],
    [
      'wrong browser version',
      (record) => {
        record.browserResults[0]!.version = 'wrong';
      },
    ],
    [
      'unmeasured browser totals',
      (record) => {
        record.browserResults[0]!.passed += 1;
      },
    ],
    [
      'unearned tenant status',
      (record) => {
        record.status = 'OutSystems-verified';
      },
    ],
  ];
  it.each(mutations)('does not append a catalog after %s', async (_name, mutate) => {
    const setup = await archivedFixture();
    mutate(setup.records[0]!);
    await expect(
      registerVerifiedRelease(setup.release, setup.records, setup.catalog, root),
    ).rejects.toThrow();
    await expect(access(setup.catalog)).rejects.toThrow();
  });

  it('rejects duplicate target records and preserves an existing catalog on failure', async () => {
    const setup = await archivedFixture();
    await writeFile(setup.catalog, '[]\n');
    setup.records[1] = setup.records[0]!;
    await expect(
      registerVerifiedRelease(setup.release, setup.records, setup.catalog, root),
    ).rejects.toThrow('exactly one');
    expect(await readFile(setup.catalog, 'utf8')).toBe('[]\n');
  });

  it('rejects changed payloads, failed archived unit tests and stale reproduction proof', async () => {
    const changed = await archivedFixture();
    await writeFile(join(changed.release.root, 'odc/command-palette.js'), 'changed');
    await expect(
      registerVerifiedRelease(changed.release, changed.records, changed.catalog, root),
    ).rejects.toThrow('payload changed');
    const unit = await archivedFixture();
    const report = JSON.parse(await readFile(join(unit.reports, 'unit.json'), 'utf8')) as {
      success: boolean;
    };
    report.success = false;
    await writeFile(join(unit.reports, 'unit.json'), JSON.stringify(report));
    await expect(
      registerVerifiedRelease(unit.release, unit.records, unit.catalog, root),
    ).rejects.toThrow('Unit evidence');
    const stale = await archivedFixture();
    await writeFile(
      join(stale.reports, 'reproducibility.json'),
      JSON.stringify({ first: { checksums: {} }, second: { checksums: {} } }),
    );
    await expect(
      registerVerifiedRelease(stale.release, stale.records, stale.catalog, root),
    ).rejects.toThrow('reproduction evidence');
    for (const setup of [changed, unit, stale])
      await expect(access(setup.catalog)).rejects.toThrow();
  });
});
