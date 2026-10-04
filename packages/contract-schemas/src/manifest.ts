import {
  canonicalJson,
  diagnostic,
  isJsonValue,
  isPlainObject,
  orderDiagnostics,
  pointer,
  validateJsonSchema,
  validateSchemaDefinition,
} from './json-schema.js';
import { manifestSchema } from './manifest-schema.js';
import type {
  ComponentManifest,
  Diagnostic,
  ImplementationContract,
  JsonObject,
  JsonSchema,
  JsonValue,
  ValidationResult,
} from './types.js';

const clone = <T>(value: T): T => JSON.parse(canonicalJson(value)) as T;
const has = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
export function parseJson(text: string): ValidationResult<JsonValue> {
  try {
    const value: unknown = JSON.parse(text);
    return isJsonValue(value)
      ? { ok: true, value, diagnostics: [] }
      : {
          ok: false,
          diagnostics: [diagnostic('non-json-value', '', 'Input must contain finite JSON data.')],
        };
  } catch {
    return {
      ok: false,
      diagnostics: [diagnostic('malformed-json', '', 'Input is not valid JSON.')],
    };
  }
}
export function validateManifest(input: unknown): ValidationResult<ComponentManifest> {
  if (isPlainObject(input) && has(input, 'schemaVersion') && input.schemaVersion !== '1.0')
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          'unsupported-schema-version',
          '/schemaVersion',
          'Supported manifest schema version is 1.0.',
        ),
      ],
    };
  const diagnostics = validateJsonSchema(manifestSchema, input);
  if (diagnostics.length) return { ok: false, diagnostics };
  const manifest = clone(input as ComponentManifest);
  const checkSchema = (rule: JsonSchema, path: string): void => {
    diagnostics.push(...validateSchemaDefinition(rule, path));
    const walk = (node: unknown, at: string): void => {
      if (isPlainObject(node))
        for (const key of Object.keys(node)) {
          if (key === '$ref')
            diagnostics.push(
              diagnostic(
                'unresolved-schema-reference',
                `${at}/$ref`,
                'Resolve referenced schema files before validating the manifest.',
              ),
            );
          else if (['properties', '$defs', 'definitions'].includes(key) && isPlainObject(node[key]))
            for (const name of Object.keys(node[key]))
              walk(node[key][name], `${at}/${key}/${pointer(name)}`);
          else if (
            ['items', 'not', 'additionalProperties', 'anyOf', 'allOf', 'oneOf'].includes(key)
          )
            walk(node[key], `${at}/${pointer(key)}`);
        }
      else if (Array.isArray(node)) node.forEach((value, index) => walk(value, `${at}/${index}`));
    };
    walk(rule, path);
  };
  for (const [name, property] of Object.entries(manifest.properties)) {
    const at = `/properties/${pointer(name)}`;
    checkSchema(property.schema, `${at}/schema`);
    if (has(property, 'default'))
      diagnostics.push(...validateJsonSchema(property.schema, property.default, `${at}/default`));
    if (!property.required && !has(property, 'default'))
      diagnostics.push(
        diagnostic(
          'missing-default',
          `${at}/default`,
          'Optional properties require a JSON default for complete configuration replacement.',
        ),
      );
    if (property.access === 'read' && property.required)
      diagnostics.push(
        diagnostic(
          'inconsistent-property-access',
          `${at}/required`,
          'A read-only property cannot require host input.',
        ),
      );
  }
  for (const [name, command] of Object.entries(manifest.commands)) {
    checkSchema(command.arguments, `/commands/${pointer(name)}/arguments`);
    checkSchema(command.result, `/commands/${pointer(name)}/result`);
  }
  for (const [name, event] of Object.entries(manifest.events))
    checkSchema(event.schema, `/events/${pointer(name)}/schema`);
  for (const [name, token] of Object.entries(manifest.themeTokens)) {
    const at = `/themeTokens/${pointer(name)}`;
    if (!name.startsWith(`--osai-${manifest.componentId}-`))
      diagnostics.push(
        diagnostic(
          'unprefixed-theme-token',
          at,
          'Theme tokens must use the component public prefix.',
        ),
      );
    checkSchema(token.schema, `${at}/schema`);
    diagnostics.push(...validateJsonSchema(token.schema, token.default, `${at}/default`));
    if (/[;{}]|url\s*\(|expression\s*\(/i.test(token.default))
      diagnostics.push(
        diagnostic(
          'unsafe-theme-default',
          `${at}/default`,
          'Theme defaults must be individual safe CSS values.',
        ),
      );
  }
  for (const [index, dependency] of manifest.dependencies.entries()) {
    if (manifest.dependencies.findIndex((other) => other.name === dependency.name) !== index)
      diagnostics.push(
        diagnostic(
          'duplicate-dependency',
          `/dependencies/${index}/name`,
          'Dependency names must be unique.',
        ),
      );
    if (!dependency.bundled) {
      for (const key of ['global', 'origin', 'loadOrder', 'integrity', 'csp'])
        if (!has(dependency, key))
          diagnostics.push(
            diagnostic(
              'incomplete-external-dependency',
              `/dependencies/${index}/${key}`,
              'External dependencies require global, origin, load order, integrity, and CSP declarations.',
            ),
          );
      if (dependency.origin && !manifest.capabilities.networkOrigins.includes(dependency.origin))
        diagnostics.push(
          diagnostic(
            'undeclared-origin',
            `/dependencies/${index}/origin`,
            'External dependency origin must appear in capability declarations.',
          ),
        );
      if (dependency.integrity && !/^sha(256|384|512)-[A-Za-z0-9+/]+=*$/.test(dependency.integrity))
        diagnostics.push(
          diagnostic(
            'invalid-integrity',
            `/dependencies/${index}/integrity`,
            'Expected a SHA-256, SHA-384, or SHA-512 integrity value.',
          ),
        );
    }
  }
  for (const [index, origin] of manifest.capabilities.networkOrigins.entries()) {
    try {
      const url = new URL(origin);
      if (url.protocol !== 'https:' || url.origin !== origin) throw new Error();
    } catch {
      diagnostics.push(
        diagnostic(
          'invalid-origin',
          `/capabilities/networkOrigins/${index}`,
          'Expected an HTTPS origin without a path.',
        ),
      );
    }
  }
  for (const [index, asset] of manifest.assets.entries())
    if (
      asset.origin &&
      (!manifest.capabilities.networkOrigins.includes(asset.origin) || !asset.integrity)
    )
      diagnostics.push(
        diagnostic(
          'incomplete-external-asset',
          `/assets/${index}`,
          'External assets require a declared origin and integrity.',
        ),
      );
  for (const [path, value] of [
    ['/entry', manifest.entry],
    ...manifest.styles.map((style, index) => [`/styles/${index}`, style]),
    ...manifest.assets
      .filter((asset) => !asset.origin)
      .map((asset, index) => [`/assets/${index}/path`, asset.path]),
  ] as [string, string][]) {
    if (
      value.includes('\\') ||
      value.startsWith('/') ||
      value.split('/').includes('..') ||
      /^[A-Za-z]+:/.test(value)
    )
      diagnostics.push(
        diagnostic(
          'unsafe-local-path',
          path,
          'Use a relative forward-slash path inside the component directory.',
        ),
      );
  }
  return {
    ok: diagnostics.length === 0,
    ...(diagnostics.length ? {} : { value: manifest }),
    diagnostics: orderDiagnostics(diagnostics),
  };
}
export function normalizeConfig(
  manifest: ComponentManifest,
  input: unknown,
): ValidationResult<JsonObject> {
  if (!isPlainObject(input) || !isJsonValue(input))
    return {
      ok: false,
      diagnostics: [
        diagnostic('invalid-config', '/properties', 'Configuration must be a JSON object.'),
      ],
    };
  const diagnostics: Diagnostic[] = [];
  const value: JsonObject = {};
  for (const key of Object.keys(input).sort())
    if (!has(manifest.properties, key))
      diagnostics.push(
        diagnostic('unknown-property', `/properties/${pointer(key)}`, 'Property is not declared.'),
      );
  for (const name of Object.keys(manifest.properties).sort()) {
    const property = manifest.properties[name];
    if (!property) continue;
    const at = `/properties/${pointer(name)}`;
    if (!has(input, name) && property.required) {
      diagnostics.push(diagnostic('required-property', at, 'Required property is missing.'));
      continue;
    }
    if (property.access === 'read' && has(input, name)) {
      diagnostics.push(
        diagnostic('readonly-property', at, 'This property cannot be supplied by a host.'),
      );
      continue;
    }
    const next = has(input, name) ? input[name] : property.default;
    diagnostics.push(...validateJsonSchema(property.schema, next, at));
    if (isJsonValue(next))
      Object.defineProperty(value, name, {
        enumerable: true,
        writable: true,
        configurable: true,
        value: clone(next),
      });
  }
  return {
    ok: !diagnostics.length,
    ...(!diagnostics.length ? { value } : {}),
    diagnostics: orderDiagnostics(diagnostics),
  };
}
export function implementationContractFromManifest(
  manifest: ComponentManifest,
): ImplementationContract {
  const properties: Record<string, JsonSchema> = {};
  const events: Record<string, JsonSchema> = {};
  for (const name of Object.keys(manifest.properties))
    Object.defineProperty(properties, name, {
      enumerable: true,
      value: manifest.properties[name]?.schema,
    });
  for (const name of Object.keys(manifest.events))
    Object.defineProperty(events, name, { enumerable: true, value: manifest.events[name]?.schema });
  return { properties, commands: manifest.commands, events };
}
export function validateImplementationParity(
  manifest: ComponentManifest,
  implementation: ImplementationContract,
): Diagnostic[] {
  const expected = implementationContractFromManifest(manifest);
  const diagnostics: Diagnostic[] = [];
  for (const kind of ['properties', 'commands', 'events'] as const) {
    const wanted = expected[kind];
    const actual = implementation[kind];
    if (!isPlainObject(actual)) {
      diagnostics.push(
        diagnostic(
          'missing-implementation-members',
          `/${kind}`,
          'Implementation member metadata is required.',
        ),
      );
      continue;
    }
    for (const name of Object.keys(wanted)) {
      const at = `/${kind}/${pointer(name)}`;
      if (!has(actual, name))
        diagnostics.push(
          diagnostic(
            'missing-implementation-member',
            at,
            'Declared public member is absent from the implementation.',
          ),
        );
      else if (kind === 'commands') {
        for (const member of ['arguments', 'result', 'execution']) {
          const expectedCommand = wanted[name] as unknown as Record<string, unknown>;
          const actualCommand = actual[name] as Record<string, unknown>;
          if (
            !isPlainObject(actualCommand) ||
            !isJsonValue(actualCommand[member]) ||
            canonicalJson(actualCommand[member]) !== canonicalJson(expectedCommand[member])
          )
            diagnostics.push(
              diagnostic(
                'incompatible-implementation-member',
                `${at}/${member}`,
                'Implementation metadata differs from its declared contract.',
              ),
            );
        }
      } else if (
        !isJsonValue(actual[name]) ||
        canonicalJson(actual[name]) !== canonicalJson(wanted[name])
      )
        diagnostics.push(
          diagnostic(
            'incompatible-implementation-member',
            at,
            'Implementation metadata differs from its declared contract.',
          ),
        );
    }
    for (const name of Object.keys(actual))
      if (!has(wanted, name))
        diagnostics.push(
          diagnostic(
            'undeclared-implementation-member',
            `/${kind}/${pointer(name)}`,
            'Implementation exposes an undeclared public member.',
          ),
        );
  }
  return orderDiagnostics(diagnostics);
}
export interface ObservedCapabilities {
  browserApis?: string[];
  networkOrigins?: string[];
  workers?: string[];
  portals?: string[];
  globalStyles?: string[];
  dependencies?: string[];
}
export function validateObservedCapabilities(
  manifest: ComponentManifest,
  observed: ObservedCapabilities,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const kind of Object.keys(observed).sort() as (keyof ObservedCapabilities)[]) {
    const declared =
      kind === 'dependencies'
        ? manifest.dependencies.map((item) => item.name)
        : kind === 'portals'
          ? manifest.capabilities.portals.map((item) => item.name)
          : manifest.capabilities[kind];
    for (const name of [...new Set(observed[kind] ?? [])].sort())
      if (!declared.includes(name))
        diagnostics.push(
          diagnostic(
            'undeclared-capability',
            `/${kind === 'dependencies' ? '' : 'capabilities/'}${kind}/${pointer(name)}`,
            'Observed capability is absent from the manifest.',
          ),
        );
  }
  return orderDiagnostics(diagnostics);
}
