import { readFile } from 'node:fs/promises';
import { validateJsonSchema } from '@osai/contract-schemas';
import type { JsonSchema, Target } from '@osai/contract-schemas';

export interface ReleasePolicy {
  schemaVersion: '1.0';
  policyVersion: string;
  targets: Target[];
  browsers: string[];
  accessibility: {
    standard: string;
    axeTags: string[];
    maxViolations: number;
    minViewportWidth: number;
    zoomPercent: number;
    behaviors: string[];
  };
  lifecycle: { minCycles: number; maxRetainedResources: number };
  budgets: { javascriptGzipBytes: number; cssGzipBytes: number };
  visual: { maxDiffPixels: number; threshold: number };
  security: {
    maxFindings: number;
    allowEval: false;
    allowInlineHandlers: false;
    allowUndeclaredOrigins: false;
  };
  dependencies: { allowedLicenses: string[]; requireExactVersions: true };
  mandatoryGates: string[];
}

const strings: JsonSchema = {
  type: 'array',
  minItems: 1,
  uniqueItems: true,
  items: { type: 'string', minLength: 1 },
};
const integer: JsonSchema = { type: 'integer', minimum: 0 };
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  required: Object.keys(properties),
  additionalProperties: false,
  properties,
});
export const releasePolicySchema = object({
  schemaVersion: { const: '1.0' },
  policyVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
  targets: { ...strings, minItems: 2, maxItems: 2, items: { enum: ['odc', 'o11-reactive'] } },
  browsers: {
    ...strings,
    minItems: 3,
    maxItems: 3,
    items: { enum: ['chromium', 'firefox', 'webkit'] },
  },
  accessibility: object({
    standard: { const: 'WCAG-2.2-AA' },
    axeTags: strings,
    maxViolations: { const: 0 },
    minViewportWidth: { const: 320 },
    zoomPercent: { const: 200 },
    behaviors: strings,
  }),
  lifecycle: object({
    minCycles: { type: 'integer', minimum: 100 },
    maxRetainedResources: { const: 0 },
  }),
  budgets: object({
    javascriptGzipBytes: { type: 'integer', minimum: 1, maximum: 61440 },
    cssGzipBytes: { type: 'integer', minimum: 1, maximum: 12288 },
  }),
  visual: object({ maxDiffPixels: integer, threshold: { type: 'number', minimum: 0, maximum: 1 } }),
  security: object({
    maxFindings: { const: 0 },
    allowEval: { const: false },
    allowInlineHandlers: { const: false },
    allowUndeclaredOrigins: { const: false },
  }),
  dependencies: object({ allowedLicenses: strings, requireExactVersions: { const: true } }),
  mandatoryGates: strings,
});

export function validatePolicy(input: unknown): ReleasePolicy {
  const errors = validateJsonSchema(releasePolicySchema, input);
  if (errors.length) throw new Error(`Invalid release policy: ${JSON.stringify(errors)}`);
  return input as ReleasePolicy;
}
export async function loadPolicy(path: string): Promise<ReleasePolicy> {
  return validatePolicy(JSON.parse(await readFile(path, 'utf8')));
}
