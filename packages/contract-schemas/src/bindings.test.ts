import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { loadManifest } from './authoring.js';
import { generateAuthoringBindings } from './bindings.js';

export async function compileBindings(source: string): Promise<ts.Diagnostic[]> {
  await mkdir('.build/binding-tests', { recursive: true });
  const directory = await mkdtemp(resolve('.build/binding-tests/case-'));
  const path = join(directory, 'fixture.ts');
  await writeFile(path, source);
  const program = ts.createProgram([path], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  return [...ts.getPreEmitDiagnostics(program)];
}

it('generates deterministic required, optional, nullable and deeply readonly types', async () => {
  const loaded = await loadManifest('tests/fixtures/minimal/component.manifest.json');
  const manifest = loaded.value!;
  manifest.properties.required = {
    schema: { type: 'string' },
    required: true,
    access: 'readwrite',
    updateMode: 'live',
  };
  manifest.properties.status = {
    schema: { type: 'string' },
    required: false,
    default: 'ready',
    access: 'read',
    updateMode: 'live',
  };
  manifest.properties.nested = {
    schema: {
      type: ['object', 'null'],
      properties: {
        rows: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['rows'],
      additionalProperties: false,
    },
    required: false,
    default: null,
    access: 'readwrite',
    updateMode: 'live',
  };
  const bindings = generateAuthoringBindings(manifest);
  expect(generateAuthoringBindings(manifest)).toBe(bindings);
  manifest.properties = Object.fromEntries(Object.entries(manifest.properties).reverse());
  expect(generateAuthoringBindings(manifest)).toBe(bindings);
  const diagnostics = await compileBindings(`${bindings}
const valid: HostInput = { required: 'value' };
const nullable: HostInput = { required: 'value', nested: null };
// @ts-expect-error Required host input must be supplied.
const missing: HostInput = {};
// @ts-expect-error Read-only values are absent from host inputs.
const readonlyInput: HostInput = { required: 'value', status: 'other' };
// @ts-expect-error Nested required members remain required.
const missingNested: HostInput = { required: 'value', nested: {} };
declare const config: Configuration;
const label: string = config.label;
const status: string = config.status;
// @ts-expect-error Normalized configuration cannot be mutated.
config.label = 'other';
if (config.nested) {
  // @ts-expect-error Nested arrays cannot be mutated.
  config.nested.rows.push({name: 'new'});
  // @ts-expect-error Nested object properties cannot be mutated.
  config.nested.rows[0].name = 'other';
}
void [valid, nullable, missing, readonlyInput, missingNested, label, status];
`);
  expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});

it('binds SDK members to generated command/event types and rejects non-JSON outcomes', async () => {
  const loaded = await loadManifest('tests/fixtures/minimal/component.manifest.json');
  const diagnostics = await compileBindings(`${generateAuthoringBindings(loaded.value!)}
import type { ComponentContext, ComponentController } from '@osai/component-sdk';
import { defineComponent } from '@osai/component-sdk';
declare const context: ComponentContext<Bindings>;
declare const controller: ComponentController<Bindings>;
context.emit('read', { label: 'ok' });
// @ts-expect-error Unknown event name.
context.emit('missing', { label: 'ok' });
// @ts-expect-error Wrong event payload.
context.emit('read', { label: 42 });
// @ts-expect-error Extra event payload property.
context.emit('read', { label: 'ok', extra: true });
// @ts-expect-error Wrong command arguments.
controller.commands.read('wrong');
// @ts-expect-error Missing declared command.
const missing: ComponentController<Bindings>['commands'] = {};
const extra: ComponentController<Bindings>['commands'] = {
  read: () => 'ok',
  // @ts-expect-error Unknown command.
  extra: () => 'extra',
};
// @ts-expect-error Wrong synchronous result.
const wrong: ComponentController<Bindings>['commands'] = { read: () => 1 };
// @ts-expect-error Promise results are forbidden.
const asynchronous: ComponentController<Bindings>['commands'] = { read: async () => 'wrong' };
// @ts-expect-error DOM results are not JSON.
const dom: ComponentController<Bindings>['commands'] = { read: () => document.body };
declare const metadata: Pick<import('@osai/component-sdk').ComponentDefinition, 'manifest' | 'contract'>;
defineComponent<Bindings>({ ...metadata, create(ctx, config) {
  ctx.emit('read', { label: config.label });
  return { prepareUpdate(next) { return {commit(){void next.label;}, rollback(){}}; },
    commands: { read: () => config.label }, dispose() {} };
} });
void [missing, extra, wrong, asynchronous, dom];
`);
  expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});

it('compiles the documented typed minimal implementation', async () => {
  const guide = await readFile('docs/authoring.md', 'utf8');
  const example = /<!-- executable: typed-minimal -->\s*```typescript\r?\n([\s\S]*?)```/.exec(
    guide,
  )?.[1];
  expect(example).toBeTruthy();
  const diagnostics = await compileBindings(example!);
  expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
});
