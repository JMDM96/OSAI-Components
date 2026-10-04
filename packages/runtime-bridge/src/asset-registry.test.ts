// @vitest-environment node
import { JSDOM } from 'jsdom';
import { expect, it } from 'vitest';
import { createBridge } from './index.js';
import { componentDefinition } from '../../../tests/fixtures/minimal/src/index.js';
import type { Bindings } from '../../../tests/fixtures/minimal/src/generated.js';
import type { ReleaseResources } from '@osai/contract-schemas';
import type { ComponentContext } from '@osai/component-sdk';

it('binds explicit nested host mappings, snapshots aliases and refuses live remapping', () => {
  const dom = new JSDOM('<div id="host"></div>', { url: 'https://host.invalid/screens/deep/page' });
  const manifest = {
    ...componentDefinition.manifest,
    assets: [{ path: 'workers/search.js', type: 'worker' as const }],
    capabilities: { ...componentDefinition.manifest.capabilities, workers: ['workers/search.js'] },
  };
  const contract: ReleaseResources = {
    schemaVersion: '2.0',
    componentId: 'minimal',
    version: manifest.version,
    target: 'odc',
    releaseId: 'a'.repeat(64),
    assets: [{ id: 'workers/search.js', type: 'worker', integrity: 'sha256-YWJj' }],
  };
  let context!: ComponentContext<Bindings>;
  const definition = {
    ...componentDefinition,
    manifest,
    create(current: ComponentContext<Bindings>, config: Bindings['configuration']) {
      context = current;
      return componentDefinition.create(current, config);
    },
  };
  const runtime = createBridge({ document: dom.window.document });
  const read = (value: string) => JSON.parse(value) as { ok: boolean; code: string };
  try {
    expect(read(runtime.registerComponent(definition, contract)).ok).toBe(true);
    expect(read(runtime.api.create('minimal', 'x', 'host', '{}')).code).toBe(
      'resources-not-registered',
    );
    const registration = {
      schemaVersion: '2.0',
      releaseId: contract.releaseId,
      mappings: {
        'workers/search.js': {
          url: '/resources/another/version/search.js',
          integrity: 'sha256-YWJj',
        },
      },
    };
    contract.assets[0]!.integrity = 'sha256-YmFk';
    expect(read(runtime.api.registerResources('minimal', JSON.stringify(registration))).ok).toBe(
      true,
    );
    expect(read(runtime.api.create('minimal', 'x', 'host', '{}')).ok).toBe(true);
    expect(context.resolveAsset('workers/search.js')).toBe(
      'https://host.invalid/resources/another/version/search.js',
    );
    expect(() => context.resolveAsset('unlisted')).toThrow();
    expect(read(runtime.api.registerResources('minimal', JSON.stringify(registration))).ok).toBe(
      true,
    );
    registration.mappings['workers/search.js'].url = '/resources/new/search.js';
    expect(read(runtime.api.registerResources('minimal', JSON.stringify(registration))).code).toBe(
      'resources-in-use',
    );
    expect(context.resolveAsset('workers/search.js')).toContain('/another/');
    expect(read(runtime.registerComponent(definition, contract)).code).toBe(
      'incompatible-resources',
    );
    runtime.api.dispose('x');
    expect(() => context.resolveAsset('workers/search.js')).toThrow();
    expect(read(runtime.api.registerResources('minimal', JSON.stringify(registration))).ok).toBe(
      true,
    );
    for (const url of [
      'https://other.invalid/x',
      'data:application/javascript,1',
      'https://name:secret@host.invalid/x',
      '/x#fragment',
    ]) {
      registration.mappings['workers/search.js'].url = url;
      expect(
        read(runtime.api.registerResources('minimal', JSON.stringify(registration))).code,
      ).toBe('disallowed-resource-origin');
    }
    registration.mappings['workers/search.js'].integrity = 'sha256-ZA==';
    expect(read(runtime.api.registerResources('minimal', JSON.stringify(registration))).code).toBe(
      'invalid-resource-mapping',
    );
  } finally {
    dom.window.close();
  }
});
