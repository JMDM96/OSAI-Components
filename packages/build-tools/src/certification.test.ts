import { describe, expect, it } from 'vitest';
import { loadManifest } from '@osai/contract-schemas/authoring';
import { validateObservations, validateScenarioInventory } from './certification.js';
import { previewResources } from '../../../tests/browser-harness/resource-document.js';
import type { ResourceMetadata } from '@osai/adapter-schema';
import { normalizeConfig } from '@osai/contract-schemas';

describe('independent capability admission', () => {
  it('rejects workloads beyond the reviewed fixed 10000-record ceiling', async () => {
    const { value } = await loadManifest('tests/fixtures/resources/component.manifest.json');
    expect(normalizeConfig(value!, { records: Array(10000).fill('item') }).ok).toBe(true);
    expect(normalizeConfig(value!, { records: Array(10001).fill('item') }).ok).toBe(false);
  });
  it.each(['workers', 'origins', 'portals', 'apis'] as const)(
    'rejects undeclared %s despite managed counters',
    async (key) => {
      const { value } = await loadManifest('tests/fixtures/minimal/component.manifest.json');
      const observation = {
        workers: [],
        origins: [],
        portals: [],
        apis: [],
        [key]: ['https://undeclared.invalid/asset'],
      };
      expect(() => validateObservations(value!, observation, {})).toThrow('not declared');
    },
  );
  it('rejects missing, duplicate and invented coverage', () => {
    for (const actual of [[], ['one', 'one'], ['one', 'invented']])
      expect(() => validateScenarioInventory(['one'], actual)).toThrow();
  });
  it('loads only declared ordered scripts/styles with integrity and directive-specific origins', () => {
    const resources = {
      assets: [
        {
          id: 'lib.js',
          path: 'lib.js',
          type: 'script',
          origin: 'https://cdn.invalid',
          integrity: 'sha256-test',
        },
        { id: 'aux.css', path: 'aux.css', type: 'style', integrity: 'sha256-css' },
        { id: 'main.js', path: 'main.js', type: 'script', integrity: 'sha256-main' },
      ],
      dependencies: [
        {
          name: 'lib',
          origin: 'https://cdn.invalid',
          integrity: 'sha256-test',
          csp: { 'script-src': ['https://cdn.invalid'] },
        },
      ],
      loadOrder: ['external:lib', 'lib.js', 'aux.css', 'main.js', 'registerResources', 'create'],
      csp: { scriptSrc: ["'self'", 'https://cdn.invalid'], connectSrc: ['https://api.invalid'] },
    } as unknown as ResourceMetadata;
    const document = previewResources(resources, '/nested/host/');
    expect(document.tags.match(/lib.js/g)).toHaveLength(1);
    expect(document.tags.indexOf('lib.js')).toBeLessThan(document.tags.indexOf('aux.css'));
    expect(document.tags).toContain('integrity="sha256-main"');
    expect(document.csp).toContain("connect-src 'self' https://api.invalid");
    expect(document.csp).toContain("worker-src 'self';");
    resources.dependencies[0]!.integrity = 'sha256-unknown';
    expect(() => previewResources(resources, '/')).toThrow('needs one declared');
  });
});
