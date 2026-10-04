import { describe, expect, it } from 'vitest';
import { validateEvidence } from './evidence.js';
import type { CompatibilityEvidence, EvidenceExpectations, HostEvidence } from './evidence.js';

const hashes = {
  'odc/command-palette.js': 'a'.repeat(64),
  'odc/command-palette.css': 'b'.repeat(64),
};
const mandatoryGates = ['schema', 'lifecycle'];
const browsers = ['chromium', 'firefox', 'webkit'];
function expectations(): EvidenceExpectations {
  return {
    componentId: 'command-palette',
    version: '1.0.0',
    target: 'odc',
    policyVersion: '1.0.0',
    suiteVersion: 'local-1',
    artifactChecksums: { ...hashes },
    browserRevisions: { chromium: '100', firefox: '200', webkit: '300' },
    gates: {
      schema: { operator: 'at-most', threshold: 0 },
      lifecycle: { operator: 'at-least', threshold: 100 },
    },
  };
}
function browserEvidence(): CompatibilityEvidence {
  return {
    schemaVersion: '1.0',
    componentId: 'command-palette',
    version: '1.0.0',
    target: 'odc',
    status: 'browser-verified',
    policyVersion: '1.0.0',
    suiteVersion: 'local-1',
    artifactChecksums: { ...hashes },
    browserResults: browsers.map((browser, index) => ({
      browser,
      revision: String((index + 1) * 100),
      version: '1.0',
      passed: 12,
      failed: 0,
      skipped: 0,
    })),
    gates: [
      {
        gate: 'schema',
        passed: true,
        measured: 0,
        threshold: 0,
        operator: 'at-most',
        evidence: 'evidence/schema.json',
      },
      {
        gate: 'lifecycle',
        passed: true,
        measured: 100,
        threshold: 100,
        operator: 'at-least',
        evidence: 'evidence/lifecycle.json',
      },
    ],
    hostEvidence: [],
  };
}
function hostEvidence(): HostEvidence {
  return {
    target: 'odc',
    environmentIdentity: 'tenant-environment',
    assetIdentity: 'test-asset',
    platformVersion: 'ODC smoke version',
    lane: 'reactive-web',
    suiteVersion: 'host-1',
    artifactChecksums: { ...hashes },
    results: {
      create: true,
      update: true,
      event: true,
      command: true,
      navigation: true,
      dispose: true,
    },
  };
}
const check = (record: unknown) =>
  validateEvidence(record, mandatoryGates, browsers, expectations());

describe('compatibility evidence', () => {
  it('distinguishes generated from browser-verified and refuses self-declared authoritative thresholds', () => {
    const generated = { ...browserEvidence(), status: 'generated', gates: [], browserResults: [] };
    expect(validateEvidence(generated, mandatoryGates, browsers)).toEqual([]);
    expect(check(browserEvidence())).toEqual([]);
    expect(validateEvidence(browserEvidence(), mandatoryGates, browsers)).toContain(
      'Verified status requires authoritative release, policy, and pinned browser expectations.',
    );
    expect(check({ ...generated, status: 'browser-verified' }).length).toBeGreaterThan(0);
  });

  it('returns diagnostics instead of throwing for malformed, cyclic or non-JSON values', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const value of [null, undefined, [], {}, { schemaVersion: '1.0' }, cyclic, () => {}]) {
      expect(() => check(value)).not.toThrow();
      expect(check(value).length).toBeGreaterThan(0);
    }
    const record = browserEvidence();
    for (const [field, value] of [
      ['artifactChecksums', null],
      ['gates', null],
      ['hostEvidence', null],
      ['version', 'not-semver'],
      ['target', 'traditional'],
      ['componentId', ' '],
    ] as const)
      expect(check({ ...record, [field]: value }).length).toBeGreaterThan(0);
  });

  it('rejects failed, skipped, missing, duplicate and unpinned browser results', () => {
    const record = browserEvidence();
    for (const mutation of [
      { failed: 1 },
      { skipped: 1 },
      { passed: 0 },
      { passed: 1.5 },
      { passed: -1 },
      { revision: 'spoofed' },
    ]) {
      expect(
        check({
          ...record,
          browserResults: [
            { ...record.browserResults[0], ...mutation },
            ...record.browserResults.slice(1),
          ],
        }).length,
      ).toBeGreaterThan(0);
    }
    expect(
      check({ ...record, browserResults: record.browserResults.slice(1) }).length,
    ).toBeGreaterThan(0);
    expect(
      check({ ...record, browserResults: [...record.browserResults, record.browserResults[0]] }),
    ).toContain('Duplicate browser evidence.');
  });

  it('rejects threshold/operator spoofing, nonfinite measurements, false flags and duplicate gates', () => {
    const record = browserEvidence();
    for (const mutation of [
      { passed: false },
      { measured: 1 },
      { threshold: 10 },
      { operator: 'anything' },
      { operator: 'at-least' },
      { measured: Number.NaN },
      { measured: Number.POSITIVE_INFINITY },
      { evidence: ' ' },
    ]) {
      expect(
        check({ ...record, gates: [{ ...record.gates[0], ...mutation }, record.gates[1]] }).length,
      ).toBeGreaterThan(0);
    }
    expect(check({ ...record, gates: [...record.gates, record.gates[0]] })).toContain(
      'Duplicate gate evidence.',
    );
    const underCycles = {
      ...record,
      gates: [record.gates[0], { ...record.gates[1], measured: 99 }],
    };
    expect(check(underCycles)).toContain('Unsatisfied mandatory gate: lifecycle');
  });

  it('binds reports to release identity, versions and the complete artifact hash set', () => {
    const record = browserEvidence();
    for (const mutation of [
      { componentId: 'other' },
      { version: '1.0.1' },
      { target: 'o11-reactive' },
      { policyVersion: '2.0.0' },
      { suiteVersion: 'other-suite' },
      { artifactChecksums: { ...hashes, extra: 'c'.repeat(64) } },
      { artifactChecksums: { 'odc/command-palette.js': 'd'.repeat(64) } },
      { artifactChecksums: { '../outside': 'a'.repeat(64) } },
    ])
      expect(check({ ...record, ...mutation }).length).toBeGreaterThan(0);
  });

  it('requires real named host evidence and exact successful lanes for OutSystems verification', () => {
    const record: CompatibilityEvidence = {
      ...browserEvidence(),
      status: 'OutSystems-verified',
      hostEvidence: [hostEvidence()],
      verifiedHostLanes: ['reactive-web'],
    };
    expect(check(record)).toEqual([]);
    expect(check({ ...record, hostEvidence: [] })).toContain(
      'Real OutSystems host evidence is required.',
    );
    expect(check({ ...record, verifiedHostLanes: ['reactive-web', 'mobile-webview'] })).toContain(
      'Verified host lanes must exactly match recorded host smoke evidence.',
    );
    expect(check({ ...record, status: 'browser-verified' })).toContain(
      'Host lanes cannot be claimed before OutSystems verification.',
    );
    for (const mutation of [
      { environmentIdentity: ' ' },
      { assetIdentity: '' },
      { platformVersion: '' },
      { lane: 'unspecified' },
      { target: 'o11-reactive' },
      { artifactChecksums: { ...hashes, added: 'c'.repeat(64) } },
      { results: { ...hostEvidence().results, dispose: false } },
      { results: {} },
    ])
      expect(
        check({ ...record, hostEvidence: [{ ...hostEvidence(), ...mutation }] }).length,
      ).toBeGreaterThan(0);
  });
});
