import { BASE_SCENARIOS, CAPABILITY_SCENARIOS } from './certification.js';
import type { CapabilityProfile, CertifiedCapability } from './certification.js';

const supported: Record<string, CertifiedCapability[]> = {
  'base-ui': [],
  'managed-async': ['managed-async'],
  workers: ['workers'],
  portals: ['portals'],
  'imperative-provider': ['imperative-provider'],
  combined: ['managed-async', 'workers', 'portals', 'imperative-provider'],
};

/** Fixed policy inputs. Qualification must never derive these from candidate measurements. */
export function capabilityProfile(id = 'base-ui'): CapabilityProfile {
  const capabilities = supported[id];
  if (!capabilities) throw new Error('Unsupported capability profile.');
  return {
    schemaVersion: '1.0',
    profileId: id,
    version: '1.0.0',
    capabilities: [...capabilities],
    requiredScenarios: [
      ...BASE_SCENARIOS,
      ...capabilities.flatMap((capability) => [...CAPABILITY_SCENARIOS[capability]]),
    ],
    limits: { jsonBytes: 8 * 1024 * 1024, jsonDepth: 64, eventCapacity: 1024, deliveryBatch: 64 },
    budgets: { javascriptGzipBytes: 61440, cssGzipBytes: 12288 },
    benchmark: {
      protocolVersion: '1.0',
      datasets: [1000, 10000],
      warmup: 5,
      samples: 30,
      lifecycleCycles: 100,
      create: { p95Ms: 1000, worstMs: 3000 },
      update: { p95Ms: 1000, worstMs: 3000 },
      input: { p95Ms: 250, worstMs: 1000 },
      maxResourceGrowth: 0,
    },
  };
}
