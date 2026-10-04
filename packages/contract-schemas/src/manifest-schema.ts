import type { JsonSchema } from './types.js';
const string: JsonSchema = { type: 'string', minLength: 1 };
const strings: JsonSchema = { type: 'array', items: string, uniqueItems: true };
const schema: JsonSchema = { type: 'object' };
const object = (
  properties: Record<string, JsonSchema>,
  required = Object.keys(properties),
): JsonSchema => ({ type: 'object', properties, required, additionalProperties: false });
const map = (item: JsonSchema): JsonSchema => ({ type: 'object', additionalProperties: item });
export const manifestSchema: JsonSchema = object({
  schemaVersion: { const: '1.0' },
  componentId: { type: 'string', pattern: '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$' },
  version: {
    type: 'string',
    pattern:
      '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$',
  },
  contractVersion: { const: '1.0' },
  targets: {
    type: 'array',
    minItems: 1,
    uniqueItems: true,
    items: { enum: ['odc', 'o11-reactive'] },
  },
  entry: string,
  styles: { ...strings, minItems: 1 },
  properties: map(
    object(
      {
        schema,
        required: { type: 'boolean' },
        default: {},
        access: { enum: ['read', 'write', 'readwrite'] },
        updateMode: { enum: ['live', 'recreate'] },
      },
      ['schema', 'required', 'access', 'updateMode'],
    ),
  ),
  commands: map(object({ arguments: schema, result: schema, execution: { const: 'sync' } })),
  events: map(object({ schema })),
  themeTokens: map(object({ schema, default: string })),
  capabilities: object({
    browserApis: strings,
    networkOrigins: strings,
    workers: strings,
    portals: {
      type: 'array',
      items: object({
        name: string,
        selector: string,
        owner: { const: 'instance' },
        accessibility: string,
        cleanup: string,
      }),
    },
    globalStyles: strings,
    keyframes: strings,
    fonts: strings,
  }),
  dependencies: {
    type: 'array',
    items: object(
      {
        name: string,
        version: string,
        license: string,
        bundled: { type: 'boolean' },
        global: string,
        origin: string,
        loadOrder: { type: 'integer', minimum: 0 },
        integrity: string,
        csp: map(strings),
      },
      ['name', 'version', 'license', 'bundled'],
    ),
  },
  assets: {
    type: 'array',
    items: object(
      {
        path: string,
        type: { enum: ['script', 'style', 'image', 'font', 'worker', 'data'] },
        origin: string,
        integrity: string,
      },
      ['path', 'type'],
    ),
  },
});
