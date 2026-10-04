import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { normalizeConfig } from '@osai/contract-schemas';
import fixture from '../../../tests/fixtures/minimal/src/index.js';
import type {
  ComponentContext,
  ComponentController,
  JsonObject,
  JsonValue,
  ResourceScope,
} from './index.js';
import { runBehavioralConformance } from './conformance.js';
import type { ConformanceDriver } from './conformance.js';

function driver(
  broken: 'none' | 'crosstalk' | 'leak' | 'callback' | 'result' | 'event' = 'none',
): ConformanceDriver {
  const document = new JSDOM('<!doctype html><body></body>').window.document;
  const instances = new Map<
    string,
    { root: HTMLElement; controller: ComponentController; disposed: boolean }
  >();
  const events = new Map<string, { name: string; payload: JsonValue }[]>();
  let disposed = false;
  return {
    create(id, config) {
      const root = document.createElement('div');
      document.body.append(root);
      events.set(id, []);
      const resources = { add: () => () => undefined } as unknown as ResourceScope;
      const context: ComponentContext = {
        instanceId: id,
        root,
        host: root,
        resources,
        emit(name, payload) {
          events.get(id)?.push({ name: broken === 'event' ? 'undeclared' : name, payload });
        },
        diagnostic() {
          /* Diagnostics are asserted by the harness. */
        },
        registerShortcut: () => () => undefined,
      };
      const normalized = normalizeConfig(fixture.manifest, config);
      if (!normalized.value) throw new Error('Fixture config did not validate.');
      instances.set(id, {
        root,
        controller: fixture.create(context, normalized.value),
        disposed: false,
      });
    },
    update(id, config) {
      const next = normalizeConfig(fixture.manifest, config).value;
      if (!next) throw new Error('Fixture config did not validate.');
      instances.get(id)?.controller.prepareUpdate(next).commit();
      if (broken === 'crosstalk')
        for (const [other, instance] of instances)
          if (other !== id) instance.controller.prepareUpdate(next).commit();
    },
    invoke(id, command, args) {
      const result = instances.get(id)?.controller.commands[command]?.(args);
      return broken === 'result' ? 42 : (result ?? null);
    },
    dispose(id) {
      const instance = instances.get(id);
      if (instance && !instance.disposed) {
        instance.controller.dispose();
        instance.disposed = true;
        if (broken !== 'leak') instance.root.remove();
      }
      disposed = true;
    },
    snapshot(id) {
      return { text: instances.get(id)?.root.textContent ?? '' };
    },
    events(id) {
      return events.get(id) ?? [];
    },
    resources(id) {
      return { roots: instances.get(id)?.root.isConnected ? 1 : 0 };
    },
    async flush() {
      if (disposed && broken === 'callback')
        events.get('conformance-a')?.push({ name: 'read', payload: { label: 'late' } });
      await Promise.resolve();
    },
  };
}
const scenario = {
  initial: {} as JsonObject,
  updated: { label: 'Next' },
  command: 'read',
  arguments: {},
};
describe('instrumented behavioral conformance', () => {
  it('runs the minimal fixture through isolated two-instance create/update/invoke/dispose', async () => {
    expect(await runBehavioralConformance(fixture.manifest, driver(), scenario)).toEqual([]);
  });
  it.each([
    ['crosstalk', 'instance-crosstalk'],
    ['leak', 'resource-leak'],
    ['callback', 'post-dispose-callback'],
    ['result', 'invalid-type'],
    ['event', 'undeclared-event'],
  ] as const)('rejects the deliberately %s fixture', async (broken, code) => {
    expect(
      (await runBehavioralConformance(fixture.manifest, driver(broken), scenario)).some(
        (item) => item.code === code,
      ),
    ).toBe(true);
  });
});
