import { describe, expect, it } from 'vitest';
import { canonicalJson, validateJsonSchema } from '@osai/contract-schemas';
import { componentManifest } from '../../../components/command-palette/src/index.js';
import {
  generateAdapter,
  generateIntegrationGuide,
  generateMentorRecipe,
  recipeSchema,
  validateAdapter,
} from './index.js';

describe('target adapter generation', () => {
  it('produces independently identified targets with equal contracts and no mutable aliases', () => {
    const odc = generateAdapter(componentManifest, 'odc', 'OSAI.Components.v1');
    const o11 = generateAdapter(componentManifest, 'o11-reactive', 'OSAI.Components.v1');
    expect(odc.target).not.toBe(o11.target);
    expect(canonicalJson(odc.publicContract)).toBe(canonicalJson(o11.publicContract));
    expect(validateAdapter(odc, componentManifest, 'odc', 'OSAI.Components.v1')).toEqual([]);
    expect(validateAdapter(o11, componentManifest, 'o11-reactive', 'OSAI.Components.v1')).toEqual(
      [],
    );
    odc.publicContract.properties.title!.default = 'Changed';
    expect(componentManifest.properties.title?.default).toBe('Command palette');
    expect(o11.publicContract.properties.title?.default).toBe('Command palette');
  });

  it('rejects wrong assets, contracts, lifecycle, serialization and target mappings', () => {
    const original = generateAdapter(componentManifest, 'odc', 'OSAI.Components.v1');
    for (const mutated of [
      { ...original, assets: { ...original.assets, script: 'other.js' } },
      { ...original, publicContract: { ...original.publicContract, events: {} } },
      { ...original, lifecycle: { ...original.lifecycle, destroy: 'nothing' } },
      { ...original, serialization: { ...original.serialization, update: 'merge' } },
      { ...original, target: 'o11-reactive' },
      { ...original, namespace: 'Different.Components.v1' },
    ])
      expect(
        validateAdapter(mutated, componentManifest, 'odc', 'OSAI.Components.v1').length,
      ).toBeGreaterThan(0);
  });

  it('returns scrubbed diagnostics for malformed metadata or invalid source and rejects unsafe namespaces', () => {
    for (const value of [undefined, null, [], {}, { target: 'odc' }]) {
      expect(() =>
        validateAdapter(value, componentManifest, 'odc', 'OSAI.Components.v1'),
      ).not.toThrow();
      expect(
        validateAdapter(value, componentManifest, 'odc', 'OSAI.Components.v1').length,
      ).toBeGreaterThan(0);
    }
    const original = generateAdapter(componentManifest, 'odc', 'OSAI.Components.v1');
    expect(
      validateAdapter(
        original,
        { ...componentManifest, targets: ['o11-reactive'] },
        'odc',
        'OSAI.Components.v1',
      ),
    ).toEqual([
      {
        code: 'invalid-adapter-source',
        path: '/target',
        message: 'A valid normalized manifest, supported target, and safe namespace are required.',
      },
    ]);
    for (const namespace of ['window bad', 'OSAI.__proto__.v1', 'OSAI.constructor.v1'])
      expect(() => generateAdapter(componentManifest, 'odc', namespace)).toThrow(
        'Invalid bridge namespace',
      );
  });

  it('generates complete integration references and a recipe with unresolved user inputs and no publication', () => {
    for (const target of componentManifest.targets) {
      const adapter = generateAdapter(componentManifest, target, 'OSAI.Components.v1');
      const guide = generateIntegrationGuide(adapter);
      for (const reference of [
        adapter.assets.script,
        adapter.assets.style,
        'schemas/config.schema.json',
        'Required Script',
        'On Ready',
        'On Parameters Changed',
        'On Render',
        'On Destroy',
        'recreation-required',
        'Client Actions',
        'unregisterCallback',
      ])
        expect(guide).toContain(reference);
      for (const name of [
        ...Object.keys(adapter.publicContract.commands),
        ...Object.keys(adapter.publicContract.events),
      ])
        expect(guide).toContain(`\`${name}\``);
      const recipe = generateMentorRecipe(adapter);
      expect(validateJsonSchema(recipeSchema, recipe)).toEqual([]);
      expect(recipe.publish).toBe(false);
      expect(recipe.requiredInputs).toEqual(['assetKey', 'environmentKey']);
      expect(JSON.stringify(recipe)).not.toMatch(
        /[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/i,
      );
    }
  });
});
