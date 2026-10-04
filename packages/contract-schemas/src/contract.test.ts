import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadManifest, generateTypeDeclarations, validateCssContract } from './authoring.js';
import {
  canonicalJson,
  implementationContractFromManifest,
  isJsonValue,
  normalizeConfig,
  parseJson,
  validateImplementationParity,
  validateJsonSchema,
  validateManifest,
  validateObservedCapabilities,
  validateSchemaDefinition,
} from './index.js';
import type { ComponentManifest, JsonValue } from './index.js';

let manifest: ComponentManifest;
beforeAll(async () => {
  const result = await loadManifest(resolve('tests/fixtures/minimal/component.manifest.json'));
  expect(result.diagnostics).toEqual([]);
  manifest = result.value as ComponentManifest;
});
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
describe('mandatory versioned manifest', () => {
  it('accepts SemVer identifiers and rejects leading-zero numeric versions', () => {
    for (const version of ['1.0.0', '0.1.2-alpha.1', '1.2.3-alpha-beta+build.005'])
      expect(validateManifest({ ...manifest, version }).ok).toBe(true);
    for (const version of ['01.0.0', '1.0.0-01', '1.0', '1.0.0-alpha..beta'])
      expect(validateManifest({ ...manifest, version }).diagnostics).toContainEqual(
        expect.objectContaining({ path: '/version', code: 'invalid-pattern' }),
      );
  });
  it('distinguishes schema keywords from same-named public members and business data', async () => {
    const result = await loadManifest('tests/fixtures/schema-data/component.manifest.json');
    expect(result.diagnostics).toEqual([]);
    expect(result.value?.properties.default?.schema.type).toBe('object');
    expect(normalizeConfig(result.value!, {}).value).toEqual({
      default: { $ref: 'business-data-not-a-schema-reference' },
    });
  });
  it('loads references and normalizes deterministically', async () => {
    const second = await loadManifest(resolve('tests/fixtures/minimal/component.manifest.json'));
    expect(canonicalJson(second.value)).toBe(canonicalJson(manifest));
    expect(manifest.properties.label?.schema).toEqual({ type: 'string', minLength: 1 });
    expect(canonicalJson(manifest)).not.toContain('$ref');
  });
  it('rejects fixture changes with exact machine-readable paths and codes', async () => {
    const fixtures = JSON.parse(
      await readFile('tests/fixtures/contracts/invalid-cases.json', 'utf8'),
    ) as { remove?: string; set?: string; value?: JsonValue; path: string; code: string }[];
    for (const fixture of fixtures) {
      const input = clone(manifest) as unknown as Record<string, unknown>;
      if (fixture.remove) delete input[fixture.remove];
      if (fixture.set) input[fixture.set] = fixture.value;
      expect(validateManifest(input).diagnostics).toContainEqual(
        expect.objectContaining({ code: fixture.code, path: fixture.path }),
      );
    }
  });
  it('aggregates ordered diagnostics without raw parser details or values', () => {
    const result = validateManifest({ schemaVersion: '1.0' });
    expect(result.diagnostics.length).toBeGreaterThan(5);
    expect(result.diagnostics.map((item) => item.path)).toEqual(
      result.diagnostics.map((item) => item.path).sort(),
    );
    const malformed = parseJson('{"secret":"EXAMPLE_SECRET",');
    expect(malformed).toEqual({
      ok: false,
      diagnostics: [{ code: 'malformed-json', path: '', message: 'Input is not valid JSON.' }],
    });
    expect(JSON.stringify(malformed)).not.toContain('EXAMPLE_SECRET');
  });
  it('rejects missing, cyclic, and escaping reference documents', async () => {
    expect((await loadManifest('tests/fixtures/missing.json')).diagnostics[0]?.code).toBe(
      'manifest-not-found',
    );
    expect(
      (await loadManifest('tests/fixtures/schema-cycle/component.manifest.json')).diagnostics.some(
        (d) => d.code === 'cyclic-schema-reference',
      ),
    ).toBe(true);
    expect(
      (await loadManifest('tests/fixtures/schema-escape/component.manifest.json')).diagnostics.some(
        (d) => d.code === 'unsafe-schema-reference',
      ),
    ).toBe(true);
  });
  it('rejects unsupported execution, invalid defaults, unprefixed tokens and unsafe paths', () => {
    const input = clone(manifest);
    input.properties.label!.default = 42;
    input.themeTokens['--foreign-color'] = { schema: { type: 'string' }, default: '#fff' };
    input.entry = '../elsewhere.ts';
    const result = validateManifest(input);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ path: '/properties/label/default', code: 'invalid-type' }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        path: '/themeTokens/--foreign-color',
        code: 'unprefixed-theme-token',
      }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ path: '/entry', code: 'unsafe-local-path' }),
    );
    (input.commands.read as unknown as Record<string, unknown>).execution = 'async';
    expect(validateManifest(input).diagnostics).toContainEqual(
      expect.objectContaining({ path: '/commands/read/execution', code: 'invalid-const' }),
    );
  });
});
describe('strict CSP-safe JSON Schema interpretation', () => {
  it('validates nested objects, nullable values, limits, alternatives and exact paths', () => {
    expect(
      validateJsonSchema(
        {
          type: 'object',
          required: ['items'],
          additionalProperties: false,
          properties: {
            items: {
              type: 'array',
              items: { type: ['string', 'null'], minLength: 2 },
              uniqueItems: true,
            },
          },
        },
        { items: ['a', null, 'a'], extra: true },
        '/properties',
      ),
    ).toEqual([
      expect.objectContaining({ path: '/properties/extra', code: 'unknown-property' }),
      expect.objectContaining({ path: '/properties/items', code: 'duplicate-items' }),
      expect.objectContaining({ path: '/properties/items/0', code: 'min-length' }),
      expect.objectContaining({ path: '/properties/items/2', code: 'min-length' }),
    ]);
    expect(
      validateJsonSchema({ oneOf: [{ type: 'string' }, { type: 'number', minimum: 2 }] }, 3),
    ).toEqual([]);
    expect(
      validateJsonSchema({ type: 'integer', multipleOf: 2, maximum: 5 }, 7).map((d) => d.code),
    ).toEqual(['maximum', 'multiple-of']);
  });
  it('rejects every unsupported keyword rather than silently accepting it', () => {
    expect(validateSchemaDefinition({ type: 'string', format: 'email' })).toEqual([
      expect.objectContaining({ code: 'unsupported-schema-keyword', path: '/format' }),
    ]);
    expect(validateSchemaDefinition({ type: 'function' })).toEqual([
      expect.objectContaining({ code: 'invalid-schema-type', path: '/type' }),
    ]);
    expect(validateSchemaDefinition({ pattern: '[' })).toEqual([
      expect.objectContaining({ code: 'invalid-schema-pattern' }),
    ]);
  });
  it('rejects functions, DOM-like class values, promises, symbols, cycles, nonfinite numbers and sparse arrays', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    class Renderer {
      name = 'private';
    }
    for (const value of [
      () => 1,
      new Renderer(),
      Promise.resolve(1),
      Symbol('secret'),
      cycle,
      Infinity,
      NaN,
      undefined,
      new Array(2),
      { x: undefined },
    ]) {
      expect(isJsonValue(value)).toBe(false);
      expect(validateJsonSchema({}, value)[0]?.code).toBe('non-json-value');
    }
  });
  it('does not invoke getters while validating a public boundary', () => {
    let invoked = false;
    const input = {
      get token() {
        invoked = true;
        return 'secret';
      },
    };
    expect(isJsonValue(input)).toBe(false);
    expect(invoked).toBe(false);
  });
});
describe('configuration defaults, capabilities and implementation parity', () => {
  it('restores defaults, rejects required omissions/nulls and clones configuration', () => {
    expect(normalizeConfig(manifest, {}).value).toEqual({ label: 'Hello' });
    expect(normalizeConfig(manifest, { label: 'Next' }).value).toEqual({ label: 'Next' });
    expect(normalizeConfig(manifest, { label: null }).ok).toBe(false);
    const required = clone(manifest);
    required.properties.label!.required = true;
    expect(normalizeConfig(required, {}).diagnostics[0]?.code).toBe('required-property');
    const readOnly = clone(manifest);
    readOnly.properties.label!.access = 'read';
    expect(normalizeConfig(readOnly, { label: 'No' }).diagnostics[0]?.code).toBe(
      'readonly-property',
    );
  });
  it('rejects observed undeclared capabilities and incomplete external dependencies', () => {
    expect(
      validateObservedCapabilities(manifest, {
        browserApis: ['Worker'],
        portals: ['tooltip'],
        networkOrigins: ['https://example.com'],
      }).map((d) => d.path),
    ).toEqual([
      '/capabilities/browserApis/Worker',
      '/capabilities/networkOrigins/https:~1~1example.com',
      '/capabilities/portals/tooltip',
    ]);
    const external = clone(manifest);
    external.dependencies.push({
      name: 'provider',
      version: '1.0.0',
      license: 'MIT',
      bundled: false,
    });
    expect(
      validateManifest(external).diagnostics.filter(
        (d) => d.code === 'incomplete-external-dependency',
      ),
    ).toHaveLength(5);
    external.dependencies[0] = {
      ...external.dependencies[0]!,
      origin: 'https://example.com',
      global: 'Provider',
      loadOrder: 0,
      integrity: 'sha256-YWJj',
      csp: { script: ['https://example.com'] },
    };
    external.capabilities.networkOrigins.push('https://example.com');
    expect(validateManifest(external).ok).toBe(true);
  });
  it('checks parity in both directions and reports exact argument/result paths', () => {
    const contract = clone(implementationContractFromManifest(manifest));
    expect(validateImplementationParity(manifest, contract)).toEqual([]);
    delete contract.properties.label;
    contract.events.undeclared = { type: 'string' };
    contract.commands.read!.arguments = { type: 'number' };
    contract.commands.read!.result = { type: 'number' };
    expect(validateImplementationParity(manifest, contract).map((d) => d.path)).toEqual([
      '/commands/read/arguments',
      '/commands/read/result',
      '/events/undeclared',
      '/properties/label',
    ]);
    expect(
      validateJsonSchema(manifest.commands.read!.result, 42, '/commands/read/result')[0]?.path,
    ).toBe('/commands/read/result');
  });
  it('generates deterministic manifest-derived types', () => {
    const types = generateTypeDeclarations(manifest);
    expect(types).toContain('"label": string;');
    expect(types).toContain('"read": { arguments: {  }; result: string };');
    expect(generateTypeDeclarations(manifest)).toBe(types);
  });
});
describe('CSS contract isolation', () => {
  it('accepts scoped token fallbacks and rejects global selectors, sibling escapes, undeclared tokens and global rules', async () => {
    expect(
      validateCssContract(
        manifest,
        await readFile('tests/fixtures/minimal/src/styles.css', 'utf8'),
      ),
    ).toEqual([]);
    for (const css of [
      'body { color: red; }',
      '[data-osai-component="minimal"] + aside { color: red; }',
      '[data-osai-component="minimal"]:is(.open) + aside { color: red; }',
      '[data-osai-component="minimal"] { --foreign: 1; }',
      '@keyframes turn { to { opacity: 0; } }',
      '@font-face { font-family: Private; src: url(font.woff2); }',
      '@page { margin: 0; }',
    ])
      expect(validateCssContract(manifest, css).length).toBeGreaterThan(0);
    expect(
      validateCssContract(
        manifest,
        '[data-osai-component="minimal"] .item[data-kind] + .item { color: red; }',
      ),
    ).toEqual([]);
  });
  it('accepts only explicit portal, font, keyframe and global exceptions', () => {
    const exceptional = clone(manifest);
    exceptional.capabilities.portals.push({
      name: 'tip',
      selector: '.owned-tip',
      owner: 'instance',
      accessibility: 'Described by owner',
      cleanup: 'Removed by resource scope',
    });
    exceptional.capabilities.globalStyles.push('body');
    exceptional.capabilities.keyframes.push('turn');
    exceptional.capabilities.fonts.push('Private');
    expect(
      validateCssContract(
        exceptional,
        '.owned-tip { color: red; } body { color: blue; } @keyframes turn { to { opacity: 0; } } @font-face { font-family: Private; src: url(font.woff2); }',
      ),
    ).toEqual([]);
  });
});
