// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { implementationContractFromManifest } from '@osai/component-sdk';
import type { ComponentContext, ComponentDefinition, JsonObject } from '@osai/component-sdk';
import { componentDefinition } from '../../../tests/fixtures/minimal/src/index.js';
import { rawListenerFixture } from '../../../tests/fixtures/negative/raw-listener.js';
import { createBridge } from './index.js';
import type { Envelope, RuntimeBridge } from './index.js';

const decode = (json: string): Envelope => JSON.parse(json) as Envelope;
const bridges: RuntimeBridge[] = [];
const copy = (): ComponentDefinition => {
  const manifest = structuredClone(componentDefinition.manifest);
  return {
    ...(componentDefinition as unknown as ComponentDefinition),
    manifest,
    contract: implementationContractFromManifest(manifest),
  };
};
function start(definition: ComponentDefinition) {
  const bridge = createBridge({ document });
  bridges.push(bridge);
  expect(decode(bridge.registerComponent(definition)).ok).toBe(true);
  expect(decode(bridge.api.create('minimal', 'a', 'a', '{}')).ok).toBe(true);
  return bridge;
}
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
});
afterEach(() => {
  for (const bridge of bridges.splice(0)) {
    bridge.api.dispose('a');
    bridge.api.dispose('b');
  }
  vi.useRealTimers();
});

describe('audited regressions', () => {
  it('registration owns the original normalized manifest', () => {
    const definition = copy();
    const bridge = start(definition);
    definition.manifest.properties.label!.default = 'mutated';
    definition.manifest.properties.label!.schema = { type: 'number' };
    expect(decode(bridge.api.create('minimal', 'b', 'b', '{}')).ok).toBe(true);
    expect(decode(bridge.api.invoke('b', 'read', '{}')).value).toBe('Hello');
    expect(decode(bridge.api.update('a', '{"label":"valid"}')).ok).toBe(true);
  });
  it('suppresses preparation events on failure while retaining older queued events', () => {
    const definition = copy();
    const create = definition.create;
    definition.create = (context, config) => ({
      ...create(context, config),
      prepareUpdate() {
        context.emit('read', { label: 'uncommitted' });
        throw new Error('preparation failed');
      },
    });
    const bridge = start(definition);
    const seen: string[] = [];
    bridge.api.registerCallback('a', 'read', (json) => seen.push(json));
    bridge.api.invoke('a', 'read', '{}');
    expect(decode(bridge.api.update('a', '{}')).ok).toBe(false);
    vi.runAllTimers();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('Hello');
    expect(seen.join('')).not.toContain('uncommitted');
  });
  it('negative raw-listener fixture has an observable effect despite zero SDK counters', () => {
    const effect = vi.fn();
    const fixture = rawListenerFixture(effect);
    const bridge = start(fixture.definition);
    try {
      bridge.api.dispose('a');
      expect(Object.values(bridge.inspect().resources).every((count) => count === 0)).toBe(true);
      document.dispatchEvent(new Event('negative-leak-probe'));
      expect(effect).toHaveBeenCalledOnce();
    } finally {
      fixture.releaseProbe();
    }
  });
});

describe('registration and value ownership', () => {
  it('captures definition and controller entry points', () => {
    const definition = copy();
    let commands: Record<string, (args: unknown) => string> | undefined;
    const create = definition.create;
    definition.create = (context, config) => {
      const controller = create(context, config);
      commands = controller.commands as typeof commands;
      return controller;
    };
    const bridge = start(definition);
    definition.create = () => {
      throw new Error('replacement');
    };
    definition.validateConfig = () => [{ code: 'replacement', path: '', message: 'replacement' }];
    commands!.read = () => 'replacement';
    expect(decode(bridge.api.invoke('a', 'read', '{}')).value).toBe('Hello');
    expect(decode(bridge.api.create('minimal', 'b', 'b', '{}')).ok).toBe(true);
  });
  it('freezes deeply independent configuration and snapshots event payloads', () => {
    const definition = copy();
    let retained: JsonObject | undefined;
    let context: ComponentContext | undefined;
    const create = definition.create;
    definition.create = (ctx, config) => {
      context = ctx;
      retained = config;
      return create(ctx, config);
    };
    const bridge = start(definition);
    const seen: string[] = [];
    bridge.api.registerCallback('a', 'read', (json) => seen.push(json));
    expect(() => {
      retained!.label = 'mutated';
    }).toThrow();
    const payload = { label: 'original' };
    context!.emit('read', payload);
    payload.label = 'mutated';
    vi.runAllTimers();
    expect(seen[0]).toContain('original');
    expect(decode(bridge.api.invoke('a', 'read', '{}')).value).toBe('Hello');
  });
});

describe('transaction event delivery', () => {
  it.each(['prepare', 'commit', 'success'])('isolates %s emissions and preserves FIFO', (phase) => {
    const definition = copy();
    const create = definition.create;
    definition.create = (context, config) => {
      const controller = create(context, config);
      return {
        ...controller,
        prepareUpdate(next) {
          context.emit('read', { label: 'prepare' });
          if (phase === 'prepare') throw new Error('prepare');
          const transaction = controller.prepareUpdate(next);
          return {
            commit() {
              transaction.commit();
              context.emit('read', { label: 'commit' });
              if (phase === 'commit') throw new Error('commit');
            },
            rollback() {
              transaction.rollback();
              context.emit('read', { label: 'rollback' });
            },
          };
        },
      };
    };
    const bridge = start(definition);
    const seen: string[] = [];
    const views: string[] = [];
    bridge.api.registerCallback('a', 'read', (json) => {
      seen.push(json);
      views.push(document.getElementById('a')!.textContent!);
    });
    bridge.api.invoke('a', 'read', '{}');
    expect(decode(bridge.api.update('a', '{"label":"updated"}')).ok).toBe(phase === 'success');
    expect(seen).toEqual([]);
    vi.runAllTimers();
    expect(
      seen.map(
        (json) =>
          (JSON.parse(json) as { value: { payload: { label: string } } }).value.payload.label,
      ),
    ).toEqual(phase === 'success' ? ['Hello', 'prepare', 'commit'] : ['Hello']);
    expect(views.every((value) => value === (phase === 'success' ? 'updated' : 'Hello'))).toBe(
      true,
    );
  });
});

describe('provisional resource ownership', () => {
  it.each(['prepare', 'commit', 'success'])(
    'releases only appropriate resources after %s',
    (phase) => {
      const oldEffect = vi.fn();
      const newEffect = vi.fn();
      const oldCleanup = vi.fn();
      const newCleanup = vi.fn();
      const definition = copy();
      const create = definition.create;
      definition.create = (context, config) => {
        const releaseOld = context.resources.listen(document, 'old', oldEffect);
        context.resources.add(oldCleanup);
        const controller = create(context, config);
        return {
          ...controller,
          prepareUpdate(next) {
            context.resources.listen(document, 'new', newEffect);
            context.resources.timeout(newEffect, 1000);
            context.resources.add(newCleanup);
            releaseOld();
            if (phase === 'prepare') throw new Error('prepare');
            const transaction = controller.prepareUpdate(next);
            return {
              commit() {
                transaction.commit();
                if (phase === 'commit') throw new Error('commit');
              },
              rollback() {
                transaction.rollback();
                context.resources.listen(document, 'new', newEffect);
              },
            };
          },
        };
      };
      const bridge = start(definition);
      expect(decode(bridge.api.update('a', '{"label":"updated"}')).ok).toBe(phase === 'success');
      document.dispatchEvent(new Event('old'));
      document.dispatchEvent(new Event('new'));
      expect(oldEffect).toHaveBeenCalledTimes(phase === 'success' ? 0 : 1);
      expect(newEffect).toHaveBeenCalledTimes(phase === 'success' ? 1 : 0);
      expect(newCleanup).toHaveBeenCalledTimes(phase === 'success' ? 0 : 1);
      expect(oldCleanup).not.toHaveBeenCalled();
      bridge.api.dispose('a');
      expect(oldCleanup).toHaveBeenCalledOnce();
      expect(newCleanup).toHaveBeenCalledOnce();
      expect(Object.values(bridge.inspect().resources).every((count) => count === 0)).toBe(true);
    },
  );
});

describe('fault quarantine and reentrancy', () => {
  it('quarantines rollback failure until explicit disposal, retaining cleanup findings', () => {
    const definition = copy();
    const create = definition.create;
    const cleaned = vi.fn();
    definition.create = (context, config) => {
      const controller = create(context, config);
      if (context.instanceId === 'a') {
        context.resources.add(() => {
          throw new Error('secret cleanup');
        });
        context.resources.add(cleaned);
        return {
          ...controller,
          prepareUpdate() {
            return {
              commit() {
                context.emit('read', { label: 'secret data' });
                throw new Error('secret commit');
              },
              rollback() {
                throw new Error('secret rollback');
              },
            };
          },
        };
      }
      return controller;
    };
    const bridge = start(definition);
    const callback = vi.fn();
    expect(decode(bridge.api.create('minimal', 'b', 'b', '{}')).ok).toBe(true);
    bridge.api.registerCallback('a', 'read', callback);
    bridge.api.invoke('a', 'read', '{}');
    const result = bridge.api.update('a', '{}');
    expect(decode(result).code).toBe('instance-faulted');
    expect(result).not.toMatch(/secret|stack/);
    expect(bridge.inspect().faultedInstances).toEqual([
      { instanceId: 'a', code: 'instance-faulted' },
    ]);
    expect(bridge.api.getInfo()).not.toMatch(/secret|stack/);
    expect(decode(bridge.api.invoke('a', 'read', '{}')).code).toBe('instance-faulted');
    expect(decode(bridge.api.update('a', '{}')).code).toBe('instance-faulted');
    expect(decode(bridge.api.invoke('b', 'read', '{}')).value).toBe('Hello');
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();
    expect(cleaned).toHaveBeenCalledOnce();
    expect(document.querySelector('#a [data-osai-component]')).toBeNull();
    expect(decode(bridge.api.create('minimal', 'a', 'a', '{}')).code).toBe('duplicate-instance');
    expect(decode(bridge.api.dispose('a')).ok).toBe(true);
    expect(decode(bridge.api.dispose('a')).ok).toBe(true);
    expect(bridge.inspect().faultedInstances).toEqual([]);
    expect(bridge.inspect().resources.disposables).toBe(1);
    expect(decode(bridge.api.create('minimal', 'a', 'a', '{}')).ok).toBe(true);
  });
  it.each(['prepare', 'commit', 'rollback', 'dispose'])(
    'rejects same-instance lifecycle calls during %s without affecting siblings',
    (phase) => {
      const definition = copy();
      const create = definition.create;
      const codes: string[] = [];
      const reenter = () => {
        codes.push(
          decode(bridge.api.update('a', '{}')).code,
          decode(bridge.api.dispose('a')).code,
          decode(bridge.api.invoke('a', 'read', '{}')).code,
        );
        expect(decode(bridge.api.invoke('b', 'read', '{}')).ok).toBe(true);
      };
      definition.create = (context, config) => {
        const controller = create(context, config);
        if (context.instanceId !== 'a') return controller;
        return {
          ...controller,
          prepareUpdate(next) {
            if (phase === 'prepare') reenter();
            const transaction = controller.prepareUpdate(next);
            return {
              commit() {
                if (phase === 'commit') reenter();
                transaction.commit();
                if (phase === 'rollback') throw new Error('commit');
              },
              rollback() {
                reenter();
                transaction.rollback();
              },
            };
          },
          dispose() {
            if (phase === 'dispose') reenter();
            controller.dispose();
          },
        };
      };
      const bridge = start(definition);
      bridge.api.create('minimal', 'b', 'b', '{}');
      if (phase === 'dispose') bridge.api.dispose('a');
      else bridge.api.update('a', '{}');
      expect(codes).toEqual([
        'operation-in-progress',
        'operation-in-progress',
        'operation-in-progress',
      ]);
    },
  );
  it('reserves creation before validation and releases the guard after failure', () => {
    const definition = copy();
    const bridge = createBridge({ document });
    bridges.push(bridge);
    definition.validateConfig = () => {
      expect(decode(bridge.api.dispose('a')).code).toBe('operation-in-progress');
      return [];
    };
    bridge.registerComponent(definition);
    expect(decode(bridge.api.create('minimal', 'a', 'a', '{}')).ok).toBe(true);
    expect(decode(bridge.api.dispose('a')).ok).toBe(true);
  });
  it('permits callback-driven updates only after the transition finishes', () => {
    const definition = copy();
    const create = definition.create;
    definition.create = (context, config) => {
      const controller = create(context, config);
      return {
        ...controller,
        prepareUpdate(next) {
          const tx = controller.prepareUpdate(next);
          return {
            commit() {
              tx.commit();
              context.emit('read', { label: 'committed' });
            },
            rollback: tx.rollback,
          };
        },
      };
    };
    const bridge = start(definition);
    let result: Envelope | undefined;
    bridge.api.registerCallback('a', 'read', () => {
      result = decode(bridge.api.dispose('a'));
    });
    bridge.api.update('a', '{}');
    vi.runAllTimers();
    expect(result?.ok).toBe(true);
  });
});
