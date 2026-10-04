// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { createBridge } from './index.js';
import { componentDefinition } from '../../../tests/fixtures/minimal/src/index.js';
import type { Bindings } from '../../../tests/fixtures/minimal/src/generated.js';
import { BackgroundLocks, ManagedResources } from './resources.js';

it('runs the documented host lifecycle against the bundled bridge and reference component', async () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const markdown = readFileSync(new URL('../../../docs/runtime.md', import.meta.url), 'utf8');
  const code = /```javascript\r?\n([\s\S]*?)```/.exec(markdown)?.[1];
  expect(code).toBeTruthy();
  const bundle = await build({
    stdin: {
      contents:
        "import { installBridge } from '@osai/runtime-bridge'; import { commandPaletteDefinition } from '@osai/command-palette'; const runtime = installBridge({document, globalObject:globalThis}); const result = JSON.parse(runtime.registerComponent(commandPaletteDefinition)); if (!result.ok) throw new Error(JSON.stringify(result));",
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2017',
    platform: 'browser',
  });
  const dom = new JSDOM('<button>Prior focus</button><div id="palette-host"></div>', {
    pretendToBeVisual: true,
  });
  const { document, HTMLElement, Element, Node, Event, KeyboardEvent } = dom.window;
  const context = createContext({
    document,
    HTMLElement,
    Element,
    Node,
    Event,
    KeyboardEvent,
    TextEncoder,
    AbortController,
  });
  runInContext(bundle.outputFiles[0]!.text, context);
  runInContext(code!, context);
  const snapshot = JSON.parse(
    runInContext('OSAI.Components.v1.getInfo()', context) as string,
  ).value;
  expect(snapshot.instances).toBe(0);
  expect(snapshot.subscriptions).toBe(0);
  expect(Object.values(snapshot.resources).every((value) => value === 0)).toBe(true);
  expect(document.querySelector('[data-osai-component]')).toBeNull();
  dom.window.close();
});

it('runs the local operation and provider examples with real managed ownership', async () => {
  const markdown = readFileSync(new URL('../../../docs/runtime.md', import.meta.url), 'utf8');
  const dom = new JSDOM('<div></div>');
  const delivered: string[] = [];
  const errors: string[] = [];
  const resources = new ManagedResources(
    dom.window as unknown as Window,
    new BackgroundLocks(dom.window.document),
    (code) => errors.push(code),
    () => false,
    undefined,
    true,
  );
  const context = createContext({
    Promise,
    resources,
    scope: resources.child(),
    deliver: (value: string) => delivered.push(value),
    document: dom.window.document,
    Event: dom.window.Event,
  });
  try {
    for (const example of ['managed-operations', 'provider-ownership']) {
      const code = new RegExp(
        `<!-- executable: ${example} -->\\s*\x60\x60\x60javascript\\r?\\n([\\s\\S]*?)\x60\x60\x60`,
      ).exec(markdown)?.[1];
      expect(code).toBeTruthy();
      await runInContext(`(async () => {${code}})()`, context);
    }
    expect(delivered).toEqual(['current', 'provider']);
    expect(errors).toEqual([]);
    resources.dispose();
    expect(Object.values(resources.counts).every((count) => count === 0)).toBe(true);
  } finally {
    dom.window.close();
  }
});

it('runs the documented fault recovery and preserves ordinary validation errors', () => {
  const markdown = readFileSync(new URL('../../../docs/runtime.md', import.meta.url), 'utf8');
  const code = /<!-- executable: fault-recovery -->\s*```javascript\r?\n([\s\S]*?)```/.exec(
    markdown,
  )?.[1];
  expect(code).toBeTruthy();
  const dom = new JSDOM('<div id="host"></div>');
  try {
    const runtime = createBridge({ document: dom.window.document });
    runtime.registerComponent<Bindings>({
      ...componentDefinition,
      create(context, initial) {
        const controller = componentDefinition.create(context, initial);
        return {
          ...controller,
          prepareUpdate(next) {
            if (next.label !== 'fault') return controller.prepareUpdate(next);
            return {
              commit() {
                throw new Error('private');
              },
              rollback() {
                throw new Error('private');
              },
            };
          },
        };
      },
    });
    runtime.api.create('minimal', 'example', 'host', '{"label":"accepted"}');
    const context = createContext({ api: runtime.api });
    runInContext(code!, context);
    const result = runInContext(
      `updateWithRecovery(api, 'minimal', 'example', 'host', '{"label":"fault"}', '{"label":"accepted"}')`,
      context,
    ) as { ok: boolean; code: string };
    expect(result).toMatchObject({ ok: true, code: 'created' });
    expect(JSON.parse(runtime.api.invoke('example', 'read', '{}')).value).toBe('accepted');
    const invalid = runInContext(
      `updateWithRecovery(api, 'minimal', 'example', 'host', '{"label":42}', '{}')`,
      context,
    ) as { code: string };
    expect(invalid.code).toBe('validation-error');
    expect(JSON.parse(runtime.api.invoke('example', 'read', '{}')).value).toBe('accepted');
    runtime.api.dispose('example');
    expect(runtime.inspect().instances).toBe(0);
  } finally {
    dom.window.close();
  }
});
