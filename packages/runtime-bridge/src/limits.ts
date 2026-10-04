import type { RuntimeLimits } from '@osai/contract-schemas';
import { isJsonValue } from '@osai/contract-schemas';

export class JsonLimitError extends Error {
  constructor(readonly limit: keyof RuntimeLimits) {
    super('JSON exceeds its declared profile limit.');
  }
}
export function checkJsonText(text: string, limits: RuntimeLimits): void {
  if (new TextEncoder().encode(text).byteLength > limits.jsonBytes)
    throw new JsonLimitError('jsonBytes');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (++depth > limits.jsonDepth) throw new JsonLimitError('jsonDepth');
    } else if (char === '}' || char === ']') depth--;
  }
}
export function checkJsonValue(value: unknown, limits: RuntimeLimits): void {
  const stack: { value: unknown; depth: number; leaving?: boolean }[] = [{ value, depth: 0 }];
  const ancestors = new Set<object>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current.value === null || typeof current.value !== 'object') continue;
    if (current.leaving) {
      ancestors.delete(current.value);
      continue;
    }
    if (ancestors.has(current.value)) throw new TypeError('Cyclic JSON is unsupported.');
    if (current.depth + 1 > limits.jsonDepth) throw new JsonLimitError('jsonDepth');
    ancestors.add(current.value);
    stack.push({ ...current, leaving: true });
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(current.value))) {
      if (!descriptor.enumerable) continue;
      if (!('value' in descriptor)) throw new TypeError('Accessor values are unsupported.');
      stack.push({ value: descriptor.value, depth: current.depth + 1 });
    }
  }
  if (!isJsonValue(value)) throw new TypeError('Value must contain only JSON data.');
  const serialized = JSON.stringify(value);
  if (serialized !== undefined) checkJsonText(serialized, limits);
}
