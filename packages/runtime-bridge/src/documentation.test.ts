// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';

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
  const context = createContext({ document, HTMLElement, Element, Node, Event, KeyboardEvent });
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
