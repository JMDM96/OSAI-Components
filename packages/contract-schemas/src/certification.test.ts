import { describe, expect, it } from 'vitest';
import {
  BASE_SCENARIOS,
  capabilityProfileSchema,
  certificationDescriptorSchema,
  validateCapabilityProfile,
  validateCertificationDescriptor,
} from './certification.js';
import type { CapabilityProfile, CertificationDescriptor } from './certification.js';
import { validateSchemaDefinition } from './json-schema.js';
import { capabilityProfile } from './profiles.js';

// Structural test values, not reviewed qualification policy.
const profile = (): CapabilityProfile => ({
  schemaVersion: '1.0',
  profileId: 'test-only',
  version: '1.0.0',
  capabilities: [],
  requiredScenarios: [...BASE_SCENARIOS],
  limits: { jsonBytes: 1024, jsonDepth: 8, eventCapacity: 16, deliveryBatch: 4 },
  budgets: { javascriptGzipBytes: 61440, cssGzipBytes: 12288 },
  benchmark: {
    protocolVersion: '1.0',
    datasets: [1000, 10000],
    warmup: 2,
    samples: 10,
    lifecycleCycles: 100,
    create: { p95Ms: 100, worstMs: 200 },
    update: { p95Ms: 100, worstMs: 200 },
    input: { p95Ms: 50, worstMs: 100 },
    maxResourceGrowth: 0,
  },
});
const descriptor = (): CertificationDescriptor => ({
  schemaVersion: '1.0',
  componentId: 'minimal',
  profile: { id: 'test-only', version: '1.0.0' },
  scenarioModule: 'certification/scenarios.ts',
  validConfiguration: {},
  invalidConfigurations: [{ unexpected: true }],
  scenarios: [
    { id: 'accessible', kind: 'accessibility', member: 'root' },
    { id: 'default', kind: 'visual', member: 'default' },
  ],
});

describe('versioned certification formats', () => {
  it('requires component-specific setup for every selected capability scenario', () => {
    const selected = capabilityProfile('managed-async');
    const input = {
      ...descriptor(),
      profile: { id: selected.profileId, version: selected.version },
    };
    expect(
      validateCertificationDescriptor(input, undefined, selected).diagnostics.some(
        (issue) => issue.code === 'missing-scenario',
      ),
    ).toBe(true);
    input.scenarios.push(
      { id: 'supersede', kind: 'capability', member: 'async-supersession' },
      { id: 'dispose', kind: 'capability', member: 'async-disposal' },
    );
    expect(validateCertificationDescriptor(input, undefined, selected).ok).toBe(true);
    input.scenarios.push({ id: 'unknown', kind: 'capability', member: 'worker-lifecycle' });
    expect(validateCertificationDescriptor(input, undefined, selected).ok).toBe(false);
  });
  it('uses supported schemas and returns independent normalized snapshots', () => {
    expect(validateSchemaDefinition(capabilityProfileSchema)).toEqual([]);
    expect(validateSchemaDefinition(certificationDescriptorSchema)).toEqual([]);
    const input = profile();
    const result = validateCapabilityProfile(input);
    expect(result.ok).toBe(true);
    input.limits.jsonBytes = 1;
    expect(result.value?.limits.jsonBytes).toBe(1024);
    expect(validateCertificationDescriptor(descriptor(), undefined, profile()).ok).toBe(true);
  });
  it.each(['', '0.9', '2.0', 1, null])('rejects unknown version %s', (schemaVersion) => {
    for (const result of [
      validateCapabilityProfile({ ...profile(), schemaVersion }),
      validateCertificationDescriptor({ ...descriptor(), schemaVersion }),
    ])
      expect(result.diagnostics[0]?.code).toBe('unsupported-schema-version');
  });
  it('rejects omitted mandatory coverage and attempts to disable gates', () => {
    expect(validateCapabilityProfile({ ...profile(), requiredScenarios: [] }).ok).toBe(false);
    expect(
      validateCapabilityProfile({
        ...profile(),
        requiredScenarios: [...BASE_SCENARIOS.filter((id) => id !== 'cleanup'), 'fake'],
      }).ok,
    ).toBe(false);
    expect(validateCertificationDescriptor({ ...descriptor(), scenarios: [] }).ok).toBe(false);
    expect(validateCertificationDescriptor({ ...descriptor(), gates: { cleanup: false } }).ok).toBe(
      false,
    );
    expect(
      validateCertificationDescriptor({
        ...descriptor(),
        scenarios: [descriptor().scenarios[0], descriptor().scenarios[0]],
      }).ok,
    ).toBe(false);
    expect(validateCapabilityProfile({ ...profile(), capabilities: ['workers'] }).ok).toBe(false);
  });
  it.each([0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid integer limits %s',
    (invalid) => {
      for (const key of ['jsonBytes', 'jsonDepth', 'eventCapacity', 'deliveryBatch'] as const) {
        const value = profile();
        value.limits[key] = invalid;
        expect(validateCapabilityProfile(value).ok).toBe(false);
      }
    },
  );
  it('rejects incompatible benchmark settings, inverted limits and unreviewed growth', () => {
    for (const mutate of [
      (p: CapabilityProfile) => {
        p.benchmark.samples = 1;
      },
      (p: CapabilityProfile) => {
        p.benchmark.lifecycleCycles = 99;
      },
      (p: CapabilityProfile) => {
        p.benchmark.create.p95Ms = 0;
      },
      (p: CapabilityProfile) => {
        p.benchmark.create.worstMs = Infinity;
      },
      (p: CapabilityProfile) => {
        p.benchmark.input.worstMs = 1;
      },
      (p: CapabilityProfile) => {
        p.benchmark.maxResourceGrowth = 1;
      },
      (p: CapabilityProfile) => {
        p.limits.deliveryBatch = 17;
      },
      (p: CapabilityProfile) => {
        p.limits.jsonDepth = 129;
      },
    ]) {
      const value = profile();
      mutate(value);
      expect(validateCapabilityProfile(value).ok).toBe(false);
    }
    expect(
      validateCapabilityProfile({
        ...profile(),
        benchmark: { ...profile().benchmark, datasets: [10, 100] },
      }).ok,
    ).toBe(false);
  });
  it('rejects profile mismatch and escaped scenario modules', () => {
    const wrong = profile();
    wrong.version = '1.0.1';
    expect(validateCertificationDescriptor(descriptor(), undefined, wrong).ok).toBe(false);
    for (const scenarioModule of [
      '../escape.ts',
      '/absolute.ts',
      'C:/file.ts',
      'scenarios/../../x.ts',
      'https://example.test/code.js',
    ])
      expect(validateCertificationDescriptor({ ...descriptor(), scenarioModule }).ok).toBe(false);
  });
});
