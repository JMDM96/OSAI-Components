import { describe, expect, test } from 'vitest';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson } from '@osai/contract-schemas';
import { loadManifest } from '@osai/contract-schemas/authoring';
import { componentManifest } from '@osai/command-palette';
import { validatePolicy, loadPolicy } from './policy.js';
import { scanJavaScript, scanCssResources } from './security.js';
import { checkRegistration, checksum, registerRelease, breakingChanges } from './release.js';
import {
  buildRelease,
  inspectRelease,
  proveReproducibility,
  dependencyInventory,
} from './build.js';

const root = process.cwd();
describe('release policy', () => {
  test('validates the versioned policy and rejects weaker or malformed gates', async () => {
    const policy = await loadPolicy(join(root, 'release-policy.json'));
    expect(policy.lifecycle.minCycles).toBeGreaterThanOrEqual(100);
    expect(() =>
      validatePolicy({ ...policy, budgets: { ...policy.budgets, javascriptGzipBytes: 61441 } }),
    ).toThrow('Invalid release policy');
    expect(() =>
      validatePolicy({ ...policy, lifecycle: { minCycles: 99, maxRetainedResources: 0 } }),
    ).toThrow();
    expect(() =>
      validatePolicy({ ...policy, security: { ...policy.security, allowEval: true } }),
    ).toThrow();
    expect(() => validatePolicy({ ...policy, browsers: ['unknown'] })).toThrow();
    expect(() => validatePolicy({ ...policy, browsers: ['chromium', 'webkit'] })).toThrow();
    expect(() => validatePolicy({ ...policy, targets: ['odc'] })).toThrow();
  });
});

describe('production scanner', () => {
  test.each([
    ['eval("bad")', 'dynamic-evaluation'],
    ['new Function("bad")', 'dynamic-evaluation'],
    ['setTimeout("bad", 1)', 'inline-execution'],
    ['import("thing")', 'unresolved-module'],
    ['require("node:fs")', 'unresolved-module'],
    ['fetch("https://example.invalid")', 'undeclared-origin'],
    ['fetch(url)', 'unverifiable-resource'],
    ['new Worker("worker.js")', 'undeclared-asset'],
    ['window.surprise = 1', 'undeclared-global'],
    ['process.env.SECRET', 'node-runtime'],
    ['node.onclick = "bad"', 'inline-handler'],
    ['isODC() ? odc() : o11()', 'runtime-target-branch'],
  ])('rejects %s', (source, code) =>
    expect(scanJavaScript(source, componentManifest).map((item) => item.code)).toContain(code),
  );
  test('allows a static component and reports unlisted CSS resources', () => {
    expect(
      scanJavaScript('(() => { const name = "label"; return name; })()', componentManifest),
    ).toEqual([]);
    expect(
      scanCssResources(
        '.root { background: url(https://example.invalid/a.png) }',
        componentManifest,
      ),
    ).toHaveLength(1);
  });
});

describe('release registration', () => {
  const first = {
    componentId: componentManifest.componentId,
    version: '1.0.0',
    payloadDigest: checksum('first'),
    manifest: componentManifest,
  };
  test('versions are immutable and exact retries are idempotent', () => {
    expect(checkRegistration([], first)).toBe('new');
    expect(checkRegistration([first], first)).toBe('existing');
    expect(() =>
      checkRegistration([first], { ...first, payloadDigest: checksum('other') }),
    ).toThrow('immutable');
  });
  test('contract removal requires a major version increase', () => {
    const next = structuredClone(componentManifest);
    delete next.commands.open;
    expect(breakingChanges(componentManifest, next)).toContain('/commands/open');
    expect(() =>
      checkRegistration([first], {
        ...first,
        version: '1.1.0',
        manifest: { ...next, version: '1.1.0' },
      }),
    ).toThrow('major');
    expect(
      checkRegistration([first], {
        ...first,
        version: '2.0.0',
        manifest: { ...next, version: '2.0.0' },
      }),
    ).toBe('new');
  });
  test('catalog is append-only and rejects failed registrations before writing', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'osai-catalog-')), 'catalog.json');
    await registerRelease(path, first);
    const initial = await readFile(path, 'utf8');
    await expect(
      registerRelease(path, { ...first, payloadDigest: checksum('bad') }),
    ).rejects.toThrow();
    expect(await readFile(path, 'utf8')).toBe(initial);
  });
});

describe('build graph', () => {
  test('normalizes manifest references and emits isolated matching target contracts and importable ESM', async () => {
    const output = await mkdtemp(join(tmpdir(), 'osai-build-test-'));
    const result = await buildRelease(root, { outputRoot: output });
    expect(result.measurements.odc.javascriptGzipBytes).toBeLessThanOrEqual(61440);
    expect(result.checksums['odc/command-palette.js']).toBe(
      result.checksums['o11-reactive/command-palette.js'],
    );
    expect(await readFile(join(output, 'odc/manifest.json'), 'utf8')).toBe(
      await readFile(join(output, 'o11-reactive/manifest.json'), 'utf8'),
    );
    expect(await readFile(join(output, 'odc/command-palette.js'), 'utf8')).not.toContain(
      (await readFile(join(root, 'tests/fixtures/unrelated/src/index.ts'), 'utf8')).match(
        /return '([^']+)'/,
      )![1]!,
    );
    const normalized = await loadManifest(
      join(root, 'components/command-palette/component.manifest.json'),
    );
    expect(canonicalJson(normalized.value)).toBe(canonicalJson(componentManifest));
    await inspectRelease(output);
    expect(JSON.parse(await readFile(join(output, 'evidence/odc.json'), 'utf8')).status).toBe(
      'generated',
    );
    const development = await readFile(join(output, 'shared/component.mjs'), 'utf8');
    const module = (await import(
      `data:text/javascript;base64,${Buffer.from(development).toString('base64')}`
    )) as { componentDefinition: { manifest: { componentId: string } } };
    expect(module.componentDefinition.manifest.componentId).toBe('command-palette');
    await writeFile(join(output, 'odc/command-palette.js'), 'corrupted');
    await expect(inspectRelease(output)).rejects.toThrow('checksums');
  }, 30000);
  test('rejects undeclared and unlicensed runtime dependencies', async () => {
    const policy = await loadPolicy(join(root, 'release-policy.json'));
    await expect(
      dependencyInventory(
        root,
        { inputs: { 'node_modules/unknown/index.js': { bytes: 1, imports: [] } }, outputs: {} },
        componentManifest,
        policy,
      ),
    ).rejects.toThrow('incomplete');
  });
  test('produces identical unsigned payloads in two clean output directories', async () => {
    const result = await proveReproducibility(root);
    expect(result.first.checksums).toEqual(result.second.checksums);
  }, 30000);
});
