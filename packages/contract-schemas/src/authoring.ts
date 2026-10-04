import { readFile, realpath } from 'node:fs/promises';
export { generateAuthoringBindings, BINDING_GENERATOR_VERSION } from './bindings.js';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {
  canonicalJson,
  diagnostic,
  isPlainObject,
  orderDiagnostics,
  pointer,
  validateJsonSchema,
} from './json-schema.js';
import { parseJson, validateManifest } from './manifest.js';
import type { ComponentManifest, Diagnostic, JsonSchema, ValidationResult } from './types.js';

/** Resolves only local JSON files contained by the component directory. */
export async function loadManifest(
  manifestPath: string,
): Promise<ValidationResult<ComponentManifest>> {
  const diagnostics: Diagnostic[] = [];
  const documents = new Map<string, unknown>();
  let rootDirectory: string;
  let absolutePath: string;
  try {
    absolutePath = await realpath(manifestPath);
    rootDirectory = dirname(absolutePath);
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic('manifest-not-found', '', 'The component manifest could not be read.'),
      ],
    };
  }
  async function document(path: string, at: string): Promise<unknown> {
    if (documents.has(path)) return documents.get(path);
    try {
      const resolved = await realpath(path);
      const rel = relative(rootDirectory, resolved);
      if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
        diagnostics.push(
          diagnostic(
            'unsafe-schema-reference',
            at,
            'Schema references must stay inside the component directory.',
          ),
        );
        return {};
      }
      const parsed = parseJson(await readFile(resolved, 'utf8'));
      if (!parsed.ok) {
        diagnostics.push(...parsed.diagnostics.map((item) => ({ ...item, path: at })));
        return {};
      }
      documents.set(path, parsed.value);
      return parsed.value;
    } catch {
      diagnostics.push(
        diagnostic('schema-not-found', at, 'A referenced JSON document could not be read.'),
      );
      return {};
    }
  }
  async function walk(node: unknown, file: string, at: string, chain: string[]): Promise<unknown> {
    if (!isPlainObject(node)) return node;
    if (typeof node.$ref === 'string') {
      if (Object.keys(node).some((key) => key !== '$ref')) {
        diagnostics.push(
          diagnostic(
            'schema-ref-siblings',
            at,
            'Schema references must be the only field in a reference object.',
          ),
        );
        return {};
      }
      const [filename = '', fragment = ''] = node.$ref.split('#');
      if (
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(filename) ||
        isAbsolute(filename) ||
        filename.includes('\\')
      ) {
        diagnostics.push(
          diagnostic(
            'unsafe-schema-reference',
            `${at}/$ref`,
            'Only component-local forward-slash JSON references are allowed.',
          ),
        );
        return {};
      }
      const referenced = filename ? resolve(dirname(file), filename) : file;
      const identity = `${referenced}#${fragment}`;
      if (chain.includes(identity)) {
        diagnostics.push(
          diagnostic(
            'cyclic-schema-reference',
            `${at}/$ref`,
            'Recursive references are unsupported in contract version 1.',
          ),
        );
        return {};
      }
      let target = await document(referenced, `${at}/$ref`);
      if (fragment && !fragment.startsWith('/')) {
        diagnostics.push(
          diagnostic(
            'invalid-schema-pointer',
            `${at}/$ref`,
            'Reference fragments must be JSON Pointers.',
          ),
        );
        return {};
      }
      for (const encoded of fragment.split('/').slice(1)) {
        const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
        target =
          isPlainObject(target) && Object.prototype.hasOwnProperty.call(target, key)
            ? target[key]
            : undefined;
      }
      if (!isPlainObject(target)) {
        diagnostics.push(
          diagnostic(
            'unresolved-schema-reference',
            `${at}/$ref`,
            'Reference does not identify a schema object.',
          ),
        );
        return {};
      }
      return walk(target, referenced, at, [...chain, identity]);
    }
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(node).sort()) {
      let value = node[key];
      if (['properties', '$defs', 'definitions'].includes(key) && isPlainObject(value)) {
        const map: Record<string, unknown> = {};
        for (const name of Object.keys(value).sort())
          Object.defineProperty(map, name, {
            enumerable: true,
            value: await walk(value[name], file, `${at}/${key}/${pointer(name)}`, chain),
          });
        value = map;
      } else if (['items', 'not', 'additionalProperties'].includes(key))
        value = await walk(value, file, `${at}/${key}`, chain);
      else if (['allOf', 'anyOf', 'oneOf'].includes(key) && Array.isArray(value))
        value = await Promise.all(
          value.map((member, index) => walk(member, file, `${at}/${key}/${index}`, chain)),
        );
      Object.defineProperty(output, key, {
        enumerable: true,
        value,
      });
    }
    return output;
  }
  const input = await document(absolutePath, '');
  if (isPlainObject(input) && input.schemaVersion !== '1.0') return validateManifest(input);
  const resolved = JSON.parse(canonicalJson(input)) as unknown;
  if (isPlainObject(resolved))
    for (const section of ['properties', 'commands', 'events', 'themeTokens']) {
      const members = resolved[section];
      if (!isPlainObject(members)) continue;
      for (const name of Object.keys(members)) {
        const contract = members[name];
        if (!isPlainObject(contract)) continue;
        for (const field of section === 'commands' ? ['arguments', 'result'] : ['schema'])
          if (Object.prototype.hasOwnProperty.call(contract, field))
            contract[field] = await walk(
              contract[field],
              absolutePath,
              `/${section}/${pointer(name)}/${field}`,
              [],
            );
      }
    }
  if (diagnostics.length) return { ok: false, diagnostics: orderDiagnostics(diagnostics) };
  return validateManifest(resolved);
}

/** CSS syntax and isolation checks; the browser suite verifies computed styles. */
export function validateCssContract(manifest: ComponentManifest, css: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let stylesheet;
  try {
    stylesheet = postcss.parse(css);
  } catch {
    return [diagnostic('malformed-css', '/styles', 'Stylesheet could not be parsed.')];
  }
  const declaredPortals = manifest.capabilities.portals.map((portal) => portal.selector);
  const selectorIsScoped = (selector: string): boolean => {
    try {
      const parsed = selectorParser().astSync(selector);
      return parsed.nodes.every((branch) => {
        const firstCombinator = branch.nodes.findIndex((node) => node.type === 'combinator');
        const first = firstCombinator < 0 ? branch.nodes : branch.nodes.slice(0, firstCombinator);
        const combinator = firstCombinator < 0 ? undefined : branch.nodes[firstCombinator];
        if (combinator && ['+', '~', '||'].includes(combinator.value?.trim() ?? '')) return false;
        return (
          first.some(
            (node) =>
              (node.type === 'attribute' &&
                node.attribute === 'data-osai-component' &&
                node.operator === '=' &&
                node.value === manifest.componentId) ||
              (node.type === 'pseudo' &&
                [':where', ':is'].includes(node.value) &&
                node.nodes.length > 0 &&
                node.nodes.every((nested) => selectorIsScoped(nested.toString()))),
          ) ||
          declaredPortals.some((portal) => first.map((node) => node.toString()).join('') === portal)
        );
      });
    } catch {
      return false;
    }
  };
  stylesheet.walkRules((rule) => {
    const keyframes =
      rule.parent?.type === 'atrule' && /^(?:-webkit-)?keyframes$/.test(rule.parent.name);
    if (keyframes) return;
    for (const selector of rule.selectors) {
      if (
        !selectorIsScoped(selector.trim()) &&
        !manifest.capabilities.globalStyles.includes(selector.trim())
      )
        diagnostics.push(
          diagnostic(
            'unscoped-selector',
            `/styles/${rule.source?.start?.line ?? 0}`,
            'Ordinary selectors must begin at the owned component root or a declared portal.',
          ),
        );
    }
  });
  stylesheet.walkAtRules((rule) => {
    if (
      /^(?:-webkit-)?keyframes$/.test(rule.name) &&
      !manifest.capabilities.keyframes.includes(rule.params)
    )
      diagnostics.push(
        diagnostic(
          'undeclared-keyframes',
          `/styles/${rule.source?.start?.line ?? 0}`,
          'Keyframes must be declared.',
        ),
      );
    if (rule.name === 'font-face') {
      let family = '';
      rule.walkDecls('font-family', (declaration) => {
        family = declaration.value.replace(/^['"]|['"]$/g, '');
      });
      if (!manifest.capabilities.fonts.includes(family))
        diagnostics.push(
          diagnostic(
            'undeclared-font',
            `/styles/${rule.source?.start?.line ?? 0}`,
            'Font faces must be declared.',
          ),
        );
    }
    if (rule.name === 'import' || rule.name === 'namespace')
      diagnostics.push(
        diagnostic(
          'unsupported-css-import',
          `/styles/${rule.source?.start?.line ?? 0}`,
          'Resolve CSS imports before packaging.',
        ),
      );
    if (
      ![
        'media',
        'supports',
        'container',
        'layer',
        'starting-style',
        'keyframes',
        '-webkit-keyframes',
        'font-face',
        'import',
        'namespace',
      ].includes(rule.name) &&
      !manifest.capabilities.globalStyles.includes(`@${rule.name} ${rule.params}`.trim())
    )
      diagnostics.push(
        diagnostic(
          'undeclared-global-rule',
          `/styles/${rule.source?.start?.line ?? 0}`,
          'Global at-rules require an explicit style exception.',
        ),
      );
  });
  stylesheet.walkDecls((declaration) => {
    if (
      declaration.prop.startsWith('--') &&
      (!declaration.prop.startsWith(`--osai-${manifest.componentId}-`) ||
        !Object.prototype.hasOwnProperty.call(manifest.themeTokens, declaration.prop))
    )
      diagnostics.push(
        diagnostic(
          'undeclared-theme-token',
          `/styles/${declaration.source?.start?.line ?? 0}`,
          'Custom properties must be declared component-prefixed public tokens.',
        ),
      );
    const token = manifest.themeTokens[declaration.prop];
    if (token)
      diagnostics.push(
        ...validateJsonSchema(
          token.schema,
          declaration.value,
          `/themeTokens/${pointer(declaration.prop)}/default`,
        ),
      );
    if (/expression\s*\(|javascript\s*:/i.test(declaration.value))
      diagnostics.push(
        diagnostic(
          'unsafe-css-value',
          `/styles/${declaration.source?.start?.line ?? 0}`,
          'Executable CSS values are not permitted.',
        ),
      );
  });
  return orderDiagnostics(diagnostics);
}

function schemaType(schema: JsonSchema): string {
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.anyOf || schema.oneOf)
    return (schema.anyOf ?? schema.oneOf ?? []).map(schemaType).join(' | ');
  if (schema.allOf) return schema.allOf.map(schemaType).join(' & ');
  if (Array.isArray(schema.type))
    return schema.type.map((type) => schemaType({ ...schema, type })).join(' | ');
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `Array<${schema.items ? schemaType(schema.items) : 'JsonValue'}>`;
    case 'object': {
      const members = Object.entries(schema.properties ?? {})
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(
          ([name, member]) =>
            `${JSON.stringify(name)}${schema.required?.includes(name) ? '' : '?'}: ${schemaType(member)};`,
        );
      if (schema.additionalProperties !== false)
        members.push('[key: string]: JsonValue | undefined;');
      return `{ ${members.join(' ')} }`;
    }
    default:
      return 'JsonValue';
  }
}
export function generateTypeDeclarations(manifest: ComponentManifest): string {
  const properties = Object.entries(manifest.properties)
    .map(([name, member]) => `  ${JSON.stringify(name)}: ${schemaType(member.schema)};`)
    .join('\n');
  const commands = Object.entries(manifest.commands)
    .map(
      ([name, member]) =>
        `  ${JSON.stringify(name)}: { arguments: ${schemaType(member.arguments)}; result: ${schemaType(member.result)} };`,
    )
    .join('\n');
  const events = Object.entries(manifest.events)
    .map(([name, member]) => `  ${JSON.stringify(name)}: ${schemaType(member.schema)};`)
    .join('\n');
  return `// Generated from ${manifest.componentId} ${manifest.version}; do not edit.\nexport type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };\nexport interface Configuration {\n${properties}\n}\nexport interface Commands {\n${commands}\n}\nexport interface Events {\n${events}\n}\n`;
}
export function normalizedManifestJson(manifest: ComponentManifest): string {
  return canonicalJson(manifest);
}
