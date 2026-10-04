import { canonicalJson, validateJsonSchema } from '@osai/contract-schemas';
import type { JsonSchema, Target } from '@osai/contract-schemas';

export type HostLane = 'reactive-web' | 'mobile-webview';
export interface GateResult {
  gate: string;
  passed: boolean;
  measured: number;
  threshold: number;
  operator: 'at-most' | 'at-least';
  evidence: string;
}
export interface HostEvidence {
  target: Target;
  environmentIdentity: string;
  assetIdentity: string;
  platformVersion: string;
  lane: HostLane;
  suiteVersion: string;
  artifactChecksums: Record<string, string>;
  results: Record<string, boolean>;
}
export interface CompatibilityEvidence {
  schemaVersion: '1.0';
  componentId: string;
  version: string;
  target: Target;
  status: 'generated' | 'browser-verified' | 'OutSystems-verified';
  policyVersion: string;
  suiteVersion: string;
  artifactChecksums: Record<string, string>;
  browserResults: {
    browser: string;
    revision: string;
    version: string;
    passed: number;
    failed: number;
    skipped: number;
  }[];
  gates: GateResult[];
  hostEvidence: HostEvidence[];
  verifiedHostLanes?: HostLane[];
}
export interface EvidenceExpectations {
  componentId: string;
  version: string;
  target: Target;
  policyVersion: string;
  suiteVersion: string;
  artifactChecksums: Record<string, string>;
  browserRevisions: Record<string, string>;
  gates: Record<string, { operator: 'at-most' | 'at-least'; threshold: number }>;
}

const identifier: JsonSchema = { type: 'string', minLength: 1, pattern: '^\\S(?:[\\s\\S]*\\S)?$' };
const version: JsonSchema = {
  type: 'string',
  pattern:
    '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$',
};
const counts: JsonSchema = { type: 'integer', minimum: 0 };
const hashes: JsonSchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: { type: 'string', pattern: '^[a-f0-9]{64}$' },
};
const target: JsonSchema = { enum: ['odc', 'o11-reactive'] };
const lane: JsonSchema = { enum: ['reactive-web', 'mobile-webview'] };

export const compatibilityEvidenceSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'componentId',
    'version',
    'target',
    'status',
    'policyVersion',
    'suiteVersion',
    'artifactChecksums',
    'browserResults',
    'gates',
    'hostEvidence',
  ],
  properties: {
    schemaVersion: { const: '1.0' },
    componentId: identifier,
    version,
    target,
    status: { enum: ['generated', 'browser-verified', 'OutSystems-verified'] },
    policyVersion: version,
    suiteVersion: identifier,
    artifactChecksums: hashes,
    browserResults: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['browser', 'revision', 'version', 'passed', 'failed', 'skipped'],
        properties: {
          browser: identifier,
          revision: identifier,
          version: identifier,
          passed: counts,
          failed: counts,
          skipped: counts,
        },
      },
    },
    gates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['gate', 'passed', 'measured', 'threshold', 'operator', 'evidence'],
        properties: {
          gate: identifier,
          passed: { type: 'boolean' },
          measured: { type: 'number', minimum: 0 },
          threshold: { type: 'number', minimum: 0 },
          operator: { enum: ['at-most', 'at-least'] },
          evidence: identifier,
        },
      },
    },
    hostEvidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'target',
          'environmentIdentity',
          'assetIdentity',
          'platformVersion',
          'lane',
          'suiteVersion',
          'artifactChecksums',
          'results',
        ],
        properties: {
          target,
          environmentIdentity: identifier,
          assetIdentity: identifier,
          platformVersion: identifier,
          lane,
          suiteVersion: identifier,
          artifactChecksums: hashes,
          results: { type: 'object', additionalProperties: { type: 'boolean' } },
        },
      },
    },
    verifiedHostLanes: { type: 'array', uniqueItems: true, items: lane },
  },
};

/** Structural validation is not attestation; trusted gate inputs must come from the verifier. */
export function validateEvidence(
  input: unknown,
  mandatoryGates: string[],
  browsers: string[],
  expectations?: EvidenceExpectations,
): string[] {
  const invalid = validateJsonSchema(compatibilityEvidenceSchema, input);
  if (invalid.length) return invalid.map((issue) => `${issue.path}: ${issue.message}`);
  const record = input as CompatibilityEvidence;
  const errors: string[] = [];
  const checkPaths = (checksums: Record<string, string>): void => {
    for (const path of Object.keys(checksums)) {
      if (
        !path ||
        path.startsWith('/') ||
        path.includes('\\') ||
        path.split('/').some((part) => !part || part === '.' || part === '..') ||
        /^[A-Za-z]+:/.test(path)
      )
        errors.push(`Invalid artifact path: ${path}`);
    }
  };
  checkPaths(record.artifactChecksums);
  for (const host of record.hostEvidence) checkPaths(host.artifactChecksums);
  for (const [name, entries] of [
    ['gate', record.gates.map((item) => item.gate)],
    ['browser', record.browserResults.map((item) => item.browser)],
  ] as const) {
    if (new Set(entries).size !== entries.length) errors.push(`Duplicate ${name} evidence.`);
  }
  if (expectations) {
    for (const key of [
      'componentId',
      'version',
      'target',
      'policyVersion',
      'suiteVersion',
    ] as const) {
      if (record[key] !== expectations[key])
        errors.push(`Evidence ${key} differs from the expected release.`);
    }
    if (canonicalJson(record.artifactChecksums) !== canonicalJson(expectations.artifactChecksums))
      errors.push('Evidence artifact checksums differ from the verified payload.');
  }
  if (record.status !== 'generated') {
    if (!expectations)
      errors.push(
        'Verified status requires authoritative release, policy, and pinned browser expectations.',
      );
    for (const gate of mandatoryGates) {
      const result = record.gates.find((item) => item.gate === gate);
      const expected = expectations?.gates[gate];
      if (
        !result ||
        !result.passed ||
        (result.operator === 'at-most'
          ? result.measured > result.threshold
          : result.measured < result.threshold)
      )
        errors.push(`Unsatisfied mandatory gate: ${gate}`);
      if (
        !expected ||
        !Number.isFinite(expected.threshold) ||
        expected.threshold < 0 ||
        !['at-most', 'at-least'].includes(expected.operator) ||
        result?.operator !== expected.operator ||
        result.threshold !== expected.threshold
      )
        errors.push(`Gate differs from authoritative policy: ${gate}`);
    }
    for (const result of record.gates) {
      const expected = expectations?.gates[result.gate];
      if (
        !expected ||
        result.operator !== expected.operator ||
        result.threshold !== expected.threshold
      )
        errors.push(`Unexpected gate or policy threshold: ${result.gate}`);
      if (
        !result.passed ||
        (result.operator === 'at-most'
          ? result.measured > result.threshold
          : result.measured < result.threshold)
      )
        errors.push(`Failed reported gate: ${result.gate}`);
    }
    for (const browser of browsers) {
      const result = record.browserResults.find((item) => item.browser === browser);
      if (!result || result.passed < 1 || result.failed !== 0 || result.skipped !== 0)
        errors.push(`Missing passing browser evidence: ${browser}`);
      if (
        !expectations?.browserRevisions[browser] ||
        result?.revision !== expectations.browserRevisions[browser]
      )
        errors.push(`Browser revision differs from the pinned toolchain: ${browser}`);
    }
    for (const result of record.browserResults) {
      if (!browsers.includes(result.browser))
        errors.push(`Unexpected browser evidence: ${result.browser}`);
    }
  }
  if (record.status === 'OutSystems-verified') {
    if (!record.hostEvidence.length) errors.push('Real OutSystems host evidence is required.');
    const measuredLanes = [...new Set(record.hostEvidence.map((host) => host.lane))].sort();
    if (
      !record.verifiedHostLanes?.length ||
      canonicalJson([...record.verifiedHostLanes].sort()) !== canonicalJson(measuredLanes)
    )
      errors.push('Verified host lanes must exactly match recorded host smoke evidence.');
    for (const host of record.hostEvidence) {
      if (host.target !== record.target)
        errors.push('Host evidence target does not match this release.');
      for (const test of ['create', 'update', 'event', 'command', 'navigation', 'dispose'])
        if (host.results[test] !== true) errors.push(`Host test has not passed: ${test}`);
      if (Object.values(host.results).some((passed) => !passed))
        errors.push('A reported host smoke test has failed.');
      if (canonicalJson(host.artifactChecksums) !== canonicalJson(record.artifactChecksums))
        errors.push('Host artifact checksums differ from this release.');
    }
  } else if (record.verifiedHostLanes?.length)
    errors.push('Host lanes cannot be claimed before OutSystems verification.');
  return [...new Set(errors)].sort();
}
