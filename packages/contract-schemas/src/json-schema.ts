import type { Diagnostic, JsonObject, JsonSchema, JsonValue } from './types.js';

export const pointer = (key: string): string => key.replace(/~/g, '~0').replace(/\//g, '~1');
export const diagnostic = (code: string, path: string, message: string): Diagnostic => ({
  code,
  path,
  message,
});
export const orderDiagnostics = (items: Diagnostic[]): Diagnostic[] =>
  items.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
  );
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
export function isJsonValue(value: unknown, ancestors = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (
    typeof value !== 'object' ||
    ancestors.has(value) ||
    (!Array.isArray(value) && !isPlainObject(value))
  )
    return false;
  if (Object.getOwnPropertySymbols(value).length) return false;
  if (Array.isArray(value) && Object.keys(value).length !== value.length) return false;
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ok = Object.keys(descriptors).every((key) => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      'value' in descriptor &&
      (descriptor.enumerable || (Array.isArray(value) && key === 'length')) &&
      isJsonValue(descriptor.value, ancestors)
    );
  });
  ancestors.delete(value);
  return ok;
}
export function canonicalJson(value: unknown): string {
  if (!isJsonValue(value)) throw new TypeError('Value is not JSON serializable.');
  const normalize = (item: JsonValue): JsonValue => {
    if (Array.isArray(item)) return item.map(normalize);
    if (!isPlainObject(item)) return item;
    const output: JsonObject = {};
    for (const key of Object.keys(item).sort())
      Object.defineProperty(output, key, {
        enumerable: true,
        value: normalize(item[key] as JsonValue),
      });
    return output;
  };
  return JSON.stringify(normalize(value), null, 2) + '\n';
}

const keywords = new Set([
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'title',
  'description',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'enum',
  'const',
  'anyOf',
  'oneOf',
  'allOf',
  'not',
  'minLength',
  'maxLength',
  'pattern',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'default',
]);
const types = new Set(['null', 'boolean', 'number', 'integer', 'string', 'array', 'object']);
export function validateSchemaDefinition(schema: unknown, path = ''): Diagnostic[] {
  const result: Diagnostic[] = [];
  if (!isPlainObject(schema) || !isJsonValue(schema))
    return [diagnostic('invalid-schema', path, 'Expected a JSON Schema object.')];
  for (const key of Object.keys(schema).sort()) {
    const value = schema[key];
    const at = `${path}/${pointer(key)}`;
    if (!keywords.has(key))
      result.push(
        diagnostic(
          'unsupported-schema-keyword',
          at,
          'This schema keyword is not supported by contract version 1.',
        ),
      );
    else if (
      key === 'type' &&
      !(typeof value === 'string'
        ? types.has(value)
        : Array.isArray(value) &&
          value.length > 0 &&
          value.every((t) => typeof t === 'string' && types.has(t)))
    )
      result.push(
        diagnostic(
          'invalid-schema-type',
          at,
          'Expected a JSON type or non-empty array of JSON types.',
        ),
      );
    else if (['properties', '$defs', 'definitions'].includes(key)) {
      if (!isPlainObject(value))
        result.push(diagnostic('invalid-schema', at, 'Expected a map of schemas.'));
      else
        for (const name of Object.keys(value).sort())
          result.push(...validateSchemaDefinition(value[name], `${at}/${pointer(name)}`));
    } else if (
      ['items', 'not'].includes(key) ||
      (key === 'additionalProperties' && typeof value !== 'boolean')
    )
      result.push(...validateSchemaDefinition(value, at));
    else if (['anyOf', 'oneOf', 'allOf'].includes(key)) {
      if (!Array.isArray(value) || !value.length)
        result.push(diagnostic('invalid-schema', at, 'Expected a non-empty schema array.'));
      else
        value.forEach((item, index) =>
          result.push(...validateSchemaDefinition(item, `${at}/${index}`)),
        );
    } else if (
      key === 'required' &&
      (!Array.isArray(value) ||
        !value.every((v) => typeof v === 'string') ||
        new Set(value).size !== value.length)
    )
      result.push(diagnostic('invalid-schema', at, 'Expected unique property names.'));
    else if (key === 'enum' && (!Array.isArray(value) || !value.length))
      result.push(diagnostic('invalid-schema', at, 'Expected a non-empty JSON value array.'));
    else if (
      ['$ref', '$schema', '$id', 'title', 'description', 'pattern'].includes(key) &&
      typeof value !== 'string'
    )
      result.push(diagnostic('invalid-schema', at, 'Expected a string.'));
    else if (key === 'uniqueItems' && typeof value !== 'boolean')
      result.push(diagnostic('invalid-schema', at, 'Expected a boolean.'));
    else if (
      ['minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties', 'maxProperties'].includes(
        key,
      ) &&
      !(typeof value === 'number' && Number.isInteger(value) && value >= 0)
    )
      result.push(diagnostic('invalid-schema', at, 'Expected a non-negative integer.'));
    else if (
      ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'].includes(key) &&
      !(typeof value === 'number' && Number.isFinite(value) && (key !== 'multipleOf' || value > 0))
    )
      result.push(diagnostic('invalid-schema', at, 'Expected a finite number with a valid bound.'));
    if (key === 'pattern' && typeof value === 'string') {
      try {
        new RegExp(value, 'u');
      } catch {
        result.push(
          diagnostic('invalid-schema-pattern', at, 'Expected a valid regular expression.'),
        );
      }
    }
  }
  return orderDiagnostics(result);
}

/** Interprets the explicitly supported JSON Schema subset without generated code. */
export function validateJsonSchema(schema: JsonSchema, value: unknown, path = ''): Diagnostic[] {
  const schemaErrors = validateSchemaDefinition(schema, path);
  if (schemaErrors.length) return schemaErrors;
  if (!isJsonValue(value))
    return [diagnostic('non-json-value', path, 'Public values must contain only JSON data.')];
  const walk = (rule: JsonSchema, item: JsonValue, at: string): Diagnostic[] => {
    const errors: Diagnostic[] = [];
    const fail = (code: string, message: string): void => {
      errors.push(diagnostic(code, at, message));
    };
    if (rule.$ref) {
      fail(
        'unresolved-schema-reference',
        'Schema references must be resolved before runtime validation.',
      );
      return errors;
    }
    const matchesType = (type: string): boolean =>
      type === 'null'
        ? item === null
        : type === 'array'
          ? Array.isArray(item)
          : type === 'object'
            ? isPlainObject(item)
            : type === 'integer'
              ? typeof item === 'number' && Number.isInteger(item)
              : typeof item === type;
    if (
      rule.type &&
      !(Array.isArray(rule.type) ? rule.type.some(matchesType) : matchesType(rule.type))
    ) {
      fail('invalid-type', 'Value has an incompatible JSON type.');
      return errors;
    }
    if ('const' in rule && canonicalJson(item) !== canonicalJson(rule.const))
      fail('invalid-const', 'Value must equal the declared constant.');
    if (rule.enum && !rule.enum.some((option) => canonicalJson(option) === canonicalJson(item)))
      fail('invalid-enum', 'Value must be one of the declared choices.');
    if (rule.allOf) for (const member of rule.allOf) errors.push(...walk(member, item, at));
    if (rule.anyOf && !rule.anyOf.some((member) => walk(member, item, at).length === 0))
      fail('invalid-any-of', 'Value must match at least one declared schema.');
    if (
      rule.oneOf &&
      rule.oneOf.filter((member) => walk(member, item, at).length === 0).length !== 1
    )
      fail('invalid-one-of', 'Value must match exactly one declared schema.');
    if (rule.not && walk(rule.not, item, at).length === 0)
      fail('invalid-not', 'Value matches a prohibited schema.');
    if (typeof item === 'string') {
      const length = Array.from(item).length;
      if (typeof rule.minLength === 'number' && length < rule.minLength)
        fail('min-length', 'Text is shorter than its minimum length.');
      if (typeof rule.maxLength === 'number' && length > rule.maxLength)
        fail('max-length', 'Text exceeds its maximum length.');
      if (typeof rule.pattern === 'string' && !new RegExp(rule.pattern, 'u').test(item))
        fail('invalid-pattern', 'Text does not match its declared pattern.');
    }
    if (typeof item === 'number') {
      if (typeof rule.minimum === 'number' && item < rule.minimum)
        fail('minimum', 'Number is below its minimum.');
      if (typeof rule.maximum === 'number' && item > rule.maximum)
        fail('maximum', 'Number exceeds its maximum.');
      if (typeof rule.exclusiveMinimum === 'number' && item <= rule.exclusiveMinimum)
        fail('exclusive-minimum', 'Number must exceed its exclusive minimum.');
      if (typeof rule.exclusiveMaximum === 'number' && item >= rule.exclusiveMaximum)
        fail('exclusive-maximum', 'Number must be below its exclusive maximum.');
      if (
        typeof rule.multipleOf === 'number' &&
        Math.abs(item / rule.multipleOf - Math.round(item / rule.multipleOf)) > 1e-10
      )
        fail('multiple-of', 'Number must be a multiple of the declared value.');
    }
    if (Array.isArray(item)) {
      if (typeof rule.minItems === 'number' && item.length < rule.minItems)
        fail('min-items', 'Array has too few items.');
      if (typeof rule.maxItems === 'number' && item.length > rule.maxItems)
        fail('max-items', 'Array has too many items.');
      if (rule.uniqueItems === true && new Set(item.map(canonicalJson)).size !== item.length)
        fail('duplicate-items', 'Array items must be unique.');
      if (rule.items)
        item.forEach((entry, index) =>
          errors.push(...walk(rule.items as JsonSchema, entry, `${at}/${index}`)),
        );
    }
    if (isPlainObject(item)) {
      const keys = Object.keys(item);
      if (typeof rule.minProperties === 'number' && keys.length < rule.minProperties)
        fail('min-properties', 'Object has too few properties.');
      if (typeof rule.maxProperties === 'number' && keys.length > rule.maxProperties)
        fail('max-properties', 'Object has too many properties.');
      for (const key of rule.required ?? [])
        if (!Object.prototype.hasOwnProperty.call(item, key))
          errors.push(
            diagnostic(
              'required-property',
              `${at}/${pointer(key)}`,
              'Required property is missing.',
            ),
          );
      for (const key of keys.sort()) {
        const subrule =
          rule.properties && Object.prototype.hasOwnProperty.call(rule.properties, key)
            ? rule.properties[key]
            : undefined;
        if (subrule) errors.push(...walk(subrule, item[key] as JsonValue, `${at}/${pointer(key)}`));
        else if (rule.additionalProperties === false)
          errors.push(
            diagnostic('unknown-property', `${at}/${pointer(key)}`, 'Property is not declared.'),
          );
        else if (typeof rule.additionalProperties === 'object')
          errors.push(
            ...walk(rule.additionalProperties, item[key] as JsonValue, `${at}/${pointer(key)}`),
          );
      }
    }
    return errors;
  };
  return orderDiagnostics(walk(schema, value, path));
}
