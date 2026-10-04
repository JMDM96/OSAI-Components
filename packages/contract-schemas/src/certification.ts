import { canonicalJson, diagnostic, isPlainObject, validateJsonSchema } from './json-schema.js';
import type { ComponentManifest, JsonObject, JsonSchema, ValidationResult } from './types.js';

export const CERTIFICATION_FORMAT = '1.0';
export const BASE_SCENARIOS = [
  'lifecycle',
  'isolation',
  'contract',
  'accessibility',
  'security',
  'cleanup',
] as const;
export const CAPABILITY_SCENARIOS = {
  'managed-async': ['async-supersession', 'async-disposal'],
  workers: ['worker-lifecycle'],
  portals: ['portal-lifecycle'],
  'imperative-provider': ['provider-partial-failure', 'provider-lifecycle'],
} as const;
export type CertifiedCapability = keyof typeof CAPABILITY_SCENARIOS;

export interface RuntimeLimits {
  jsonBytes: number;
  jsonDepth: number;
  eventCapacity: number;
  deliveryBatch: number;
}
export interface CapabilityProfile {
  schemaVersion: typeof CERTIFICATION_FORMAT;
  profileId: string;
  version: string;
  capabilities: CertifiedCapability[];
  requiredScenarios: string[];
  limits: RuntimeLimits;
  budgets: { javascriptGzipBytes: number; cssGzipBytes: number };
  benchmark: {
    protocolVersion: '1.0';
    datasets: [1000, 10000];
    warmup: number;
    samples: number;
    lifecycleCycles: number;
    create: { p95Ms: number; worstMs: number };
    update: { p95Ms: number; worstMs: number };
    input: { p95Ms: number; worstMs: number };
    maxResourceGrowth: number;
  };
}
export interface CertificationDescriptor {
  schemaVersion: typeof CERTIFICATION_FORMAT;
  componentId: string;
  profile: { id: string; version: string };
  scenarioModule: string;
  validConfiguration: JsonObject;
  invalidConfigurations: JsonObject[];
  scenarios: {
    id: string;
    kind: 'command' | 'event' | 'accessibility' | 'visual' | 'capability';
    member: string;
  }[];
}

const text: JsonSchema = { type: 'string', minLength: 1, pattern: '^\\S+$' };
const id: JsonSchema = { type: 'string', pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' };
const version: JsonSchema = {
  type: 'string',
  pattern: '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$',
};
const count = (minimum = 1, maximum = Number.MAX_SAFE_INTEGER): JsonSchema => ({
  type: 'integer',
  minimum,
  maximum,
});
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const latency = object({
  p95Ms: { type: 'number', exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER },
  worstMs: { type: 'number', exclusiveMinimum: 0, maximum: Number.MAX_SAFE_INTEGER },
});
export const capabilityProfileSchema = object({
  schemaVersion: { const: CERTIFICATION_FORMAT },
  profileId: id,
  version,
  capabilities: {
    type: 'array',
    uniqueItems: true,
    items: { enum: Object.keys(CAPABILITY_SCENARIOS) },
  },
  requiredScenarios: {
    type: 'array',
    minItems: BASE_SCENARIOS.length,
    uniqueItems: true,
    items: text,
  },
  limits: object({
    jsonBytes: count(),
    jsonDepth: count(1, 128),
    eventCapacity: count(),
    deliveryBatch: count(),
  }),
  budgets: object({ javascriptGzipBytes: count(), cssGzipBytes: count() }),
  benchmark: object({
    protocolVersion: { const: '1.0' },
    datasets: { const: [1000, 10000] },
    warmup: count(),
    samples: count(2),
    lifecycleCycles: count(100),
    create: latency,
    update: latency,
    input: latency,
    maxResourceGrowth: { const: 0 },
  }),
});
export const certificationDescriptorSchema = object({
  schemaVersion: { const: CERTIFICATION_FORMAT },
  componentId: id,
  profile: object({ id, version }),
  scenarioModule: text,
  validConfiguration: { type: 'object' },
  invalidConfigurations: { type: 'array', minItems: 1, items: { type: 'object' } },
  scenarios: {
    type: 'array',
    minItems: 2,
    items: object({
      id: text,
      kind: { enum: ['command', 'event', 'accessibility', 'visual', 'capability'] },
      member: text,
    }),
  },
});

function validateFormat<T>(schema: JsonSchema, input: unknown): ValidationResult<T> {
  if (
    isPlainObject(input) &&
    'schemaVersion' in input &&
    input.schemaVersion !== CERTIFICATION_FORMAT
  )
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'unsupported-schema-version',
          '/schemaVersion',
          'Supported certification format is 1.0.',
        ),
      ],
    };
  const diagnostics = validateJsonSchema(schema, input);
  return diagnostics.length
    ? { ok: false, diagnostics }
    : {
        ok: true,
        diagnostics,
        value: JSON.parse(canonicalJson(input)) as T,
      };
}

export function validateCapabilityProfile(input: unknown): ValidationResult<CapabilityProfile> {
  const result = validateFormat<CapabilityProfile>(capabilityProfileSchema, input);
  if (!result.value) return result;
  const profile = result.value;
  const required = [
    ...BASE_SCENARIOS,
    ...profile.capabilities.flatMap((capability) => [...CAPABILITY_SCENARIOS[capability]]),
  ];
  for (const scenario of required)
    if (!profile.requiredScenarios.includes(scenario))
      result.diagnostics.push(
        diagnostic('missing-scenario', '/requiredScenarios', `Required scenario: ${scenario}.`),
      );
  for (const scenario of profile.requiredScenarios)
    if (!required.includes(scenario as (typeof required)[number]))
      result.diagnostics.push(
        diagnostic(
          'unknown-scenario',
          '/requiredScenarios',
          'Scenario is not defined by this suite/profile.',
        ),
      );
  if (profile.limits.deliveryBatch > profile.limits.eventCapacity)
    result.diagnostics.push(
      diagnostic(
        'invalid-limit',
        '/limits/deliveryBatch',
        'Delivery batch must not exceed queue capacity.',
      ),
    );
  for (const operation of ['create', 'update', 'input'] as const)
    if (profile.benchmark[operation].p95Ms > profile.benchmark[operation].worstMs)
      result.diagnostics.push(
        diagnostic(
          'invalid-limit',
          `/benchmark/${operation}`,
          'Worst latency limit must be at least the p95 limit.',
        ),
      );
  return result.diagnostics.length ? { ok: false, diagnostics: result.diagnostics } : result;
}

export function validateCertificationDescriptor(
  input: unknown,
  manifest?: ComponentManifest,
  profile?: CapabilityProfile,
): ValidationResult<CertificationDescriptor> {
  const result = validateFormat<CertificationDescriptor>(certificationDescriptorSchema, input);
  if (!result.value) return result;
  const descriptor = result.value;
  if (!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:ts|js)$/.test(descriptor.scenarioModule))
    result.diagnostics.push(
      diagnostic(
        'unsafe-path',
        '/scenarioModule',
        'Use a component-relative scenario module path.',
      ),
    );
  const ids = descriptor.scenarios.map((scenario) => scenario.id);
  if (new Set(ids).size !== ids.length)
    result.diagnostics.push(
      diagnostic('duplicate-scenario', '/scenarios', 'Scenario identifiers must be unique.'),
    );
  for (const kind of ['accessibility', 'visual'] as const)
    if (!descriptor.scenarios.some((scenario) => scenario.kind === kind))
      result.diagnostics.push(
        diagnostic('missing-scenario', '/scenarios', `Required ${kind} scenario is missing.`),
      );
  if (manifest) {
    if (descriptor.componentId !== manifest.componentId)
      result.diagnostics.push(
        diagnostic(
          'component-mismatch',
          '/componentId',
          'Descriptor must belong to the selected component.',
        ),
      );
    for (const [kind, members] of [
      ['command', manifest.commands],
      ['event', manifest.events],
    ] as const) {
      for (const member of Object.keys(members))
        if (
          !descriptor.scenarios.some(
            (scenario) => scenario.kind === kind && scenario.member === member,
          )
        )
          result.diagnostics.push(
            diagnostic('missing-scenario', '/scenarios', `Missing ${kind} scenario: ${member}.`),
          );
      for (const scenario of descriptor.scenarios.filter((item) => item.kind === kind))
        if (!Object.prototype.hasOwnProperty.call(members, scenario.member))
          result.diagnostics.push(
            diagnostic(
              'unknown-member',
              '/scenarios',
              'Scenario names an undeclared public member.',
            ),
          );
    }
  }
  if (profile) {
    result.diagnostics.push(...validateCapabilityProfile(profile).diagnostics);
    const required = profile.capabilities.flatMap((capability) => [
      ...CAPABILITY_SCENARIOS[capability],
    ]);
    for (const member of required)
      if (
        descriptor.scenarios.filter(
          (scenario) => scenario.kind === 'capability' && scenario.member === member,
        ).length !== 1
      )
        result.diagnostics.push(
          diagnostic(
            'missing-scenario',
            '/scenarios',
            `Exactly one capability setup required: ${member}.`,
          ),
        );
    if (
      descriptor.scenarios.some(
        (scenario) =>
          scenario.kind === 'capability' &&
          !required.includes(scenario.member as (typeof required)[number]),
      )
    )
      result.diagnostics.push(
        diagnostic(
          'unknown-scenario',
          '/scenarios',
          'Capability setup is outside the selected profile.',
        ),
      );
    if (
      descriptor.profile.id !== profile.profileId ||
      descriptor.profile.version !== profile.version
    )
      result.diagnostics.push(
        diagnostic(
          'profile-mismatch',
          '/profile',
          'Descriptor must select the exact profile identity and version.',
        ),
      );
    for (const [capability, used] of [
      ['workers', manifest?.capabilities.workers.length],
      ['portals', manifest?.capabilities.portals.length],
    ] as const)
      if (used && !profile.capabilities.includes(capability))
        result.diagnostics.push(
          diagnostic('unsupported-capability', '/profile', `Profile does not cover ${capability}.`),
        );
  }
  return result.diagnostics.length ? { ok: false, diagnostics: result.diagnostics } : result;
}
