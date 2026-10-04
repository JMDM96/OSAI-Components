import { canonicalJson } from './json-schema.js';
import { createHash } from 'node:crypto';
import { validateManifest } from './manifest.js';
import type { ComponentManifest, JsonSchema } from './types.js';

export const BINDING_GENERATOR_VERSION = '1.0';
function schemaType(schema: JsonSchema): string {
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ') || 'never';
  const branches = schema.anyOf ?? schema.oneOf ?? schema.allOf;
  if (branches) {
    const { anyOf: _any, oneOf: _one, allOf: _all, ...base } = schema;
    const union = branches
      .map((branch) => `(${schemaType(branch)})`)
      .join(schema.allOf ? ' & ' : ' | ');
    return schema.type ? `(${schemaType(base)}) & (${union})` : union;
  }
  if (Array.isArray(schema.type))
    return schema.type.map((type) => `(${schemaType({ ...schema, type })})`).join(' | ');
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `Array<${schema.items ? schemaType(schema.items) : 'JsonValue'}>`;
    case 'object': {
      if (
        schema.additionalProperties === false &&
        Object.keys(schema.properties ?? {}).length === 0
      )
        return 'Record<string, never>';
      const members = Object.entries(schema.properties ?? {})
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(
          ([name, member]) =>
            `${JSON.stringify(name)}${schema.required?.includes(name) ? '' : '?'}: ${schemaType(member)};`,
        );
      if (schema.additionalProperties !== false) {
        // TS index signatures must also admit declared properties; runtime checks
        // retain stricter additionalProperties constraints for those mixed cases.
        const additional =
          typeof schema.additionalProperties === 'object' && members.length === 0
            ? schemaType(schema.additionalProperties)
            : 'JsonValue';
        members.push(`[key: string]: ${additional} | undefined;`);
      }
      return `{ ${members.join(' ')} }`;
    }
    default:
      return 'JsonValue';
  }
}

/** Separate input optionality from the complete runtime-normalized snapshot. */
export function generateAuthoringBindings(input: ComponentManifest): string {
  const validation = validateManifest(input);
  if (!validation.value) throw new Error('Bindings require a valid normalized manifest.');
  const manifest = JSON.parse(canonicalJson(validation.value)) as ComponentManifest;
  const properties = Object.entries(manifest.properties);
  const configuration = properties
    .map(([name, member]) => `  ${JSON.stringify(name)}: ${schemaType(member.schema)};`)
    .join('\n');
  const host = properties
    .filter(([, member]) => member.access !== 'read')
    .map(
      ([name, member]) =>
        `  ${JSON.stringify(name)}${member.required ? '' : '?'}: ${schemaType(member.schema)};`,
    )
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
  return (
    `// Generated authoring bindings ${BINDING_GENERATOR_VERSION}: ${manifest.componentId}@${manifest.version}. Do not edit.\n` +
    `// Contract SHA-256: ${createHash('sha256').update(canonicalJson(manifest)).digest('hex')}\n` +
    `export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };\n` +
    `export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;\n` +
    `export type HostInput = {\n${host}\n};\nexport type Configuration = DeepReadonly<{\n${configuration}\n}>;\n` +
    `export type Commands = {\n${commands}\n};\nexport type Events = {\n${events}\n};\n` +
    `export type Bindings = { configuration: Configuration; commands: Commands; events: Events };\n`
  );
}
