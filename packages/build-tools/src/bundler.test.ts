import { describe, expect, test } from 'vitest';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { componentManifest } from '@osai/command-palette';
import { externalGlobals, targetProfile } from './bundler.js';
import { scanJavaScript } from './security.js';

describe('explicit bundler boundaries', () => {
  test('external dependency shims bind only the declared global without a runtime module loader', async () => {
    const manifest = structuredClone(componentManifest);
    manifest.dependencies = [
      {
        name: 'fixture-renderer',
        version: '1.0.0',
        bundled: false,
        license: 'MIT',
        global: 'Approved.Renderer',
        origin: 'https://example.invalid',
        loadOrder: 0,
        integrity: 'sha256-fixture',
        csp: { 'script-src': ['https://example.invalid'] },
      },
    ];
    const result = await build({
      stdin: { contents: 'import renderer from "fixture-renderer"; renderer.render("fixture");' },
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'es2017',
      minify: true,
      metafile: true,
      plugins: [externalGlobals(manifest)],
    });
    const script = result.outputFiles![0]!.text;
    expect(Object.keys(result.metafile!.inputs)).toContain('osai-external:fixture-renderer');
    expect(scanJavaScript(script, manifest)).toEqual([]);
    const calls: string[] = [];
    runInNewContext(script, {
      Approved: { Renderer: { render: (value: string) => calls.push(value) } },
    });
    expect(calls).toEqual(['fixture']);
    expect(() => runInNewContext(script, { Approved: {} })).toThrow('Missing declared external');
    manifest.dependencies[0]!.global = '__proto__.polluted';
    expect(() => externalGlobals(manifest)).toThrow('Unsafe external global');
  });
  test('records build-time overrides and rejects unsafe constants and targets', () => {
    const override = {
      rationale: 'A recorded target capability difference.',
      defines: { OSAI_BUILD_FOCUS_FALLBACK: true },
    };
    expect(targetProfile('odc', override).overrides).toEqual([override]);
    expect(targetProfile('odc').browserApis).toContain('HTMLElement.focus');
    expect(() =>
      targetProfile('odc', { ...override, defines: { 'window.location': 'bad' } }),
    ).toThrow('Invalid explicit');
    expect(() => targetProfile('odc', { ...override, rationale: '' })).toThrow('Invalid explicit');
    // @ts-expect-error unsupported targets are also rejected at runtime
    expect(() => targetProfile('traditional')).toThrow('Unsupported target');
  });
});
