// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { implementationContractFromManifest } from '@osai/component-sdk';
import type {
  ComponentContext,
  ComponentDefinition,
  ComponentManifest,
  JsonObject,
  JsonValue,
} from '@osai/component-sdk';
import { createBridge, installBridge, normalizeShortcut } from './index.js';
import type { Envelope, RuntimeBridge } from './index.js';

const decode = <T = Record<string, unknown>>(json: string): Envelope<T> =>
  JSON.parse(json) as Envelope<T>;
const baseConfig = { required: 'initial', count: 1, identity: 'stable' };

function fixture(
  options: {
    throwCreate?: boolean;
    throwCommit?: boolean;
    throwDispose?: boolean;
    allResources?: boolean;
  } = {},
) {
  const manifest: ComponentManifest = {
    schemaVersion: '1.0',
    componentId: 'test-component',
    version: '1.0.0',
    contractVersion: '1.0',
    targets: ['odc', 'o11-reactive'],
    entry: 'src/index.ts',
    styles: ['src/styles.css'],
    assets: [],
    dependencies: [],
    themeTokens: {},
    capabilities: {
      browserApis: [],
      networkOrigins: [],
      workers: [],
      portals: [
        {
          name: 'test',
          selector: '.fixture-portal',
          owner: 'instance',
          accessibility: 'Named region',
          cleanup: 'Remove on dispose',
        },
      ],
      globalStyles: [],
      keyframes: [],
      fonts: [],
    },
    properties: {
      required: {
        schema: { type: 'string' },
        required: true,
        access: 'readwrite',
        updateMode: 'live',
      },
      count: {
        schema: { type: 'integer' },
        required: false,
        default: 0,
        access: 'readwrite',
        updateMode: 'live',
      },
      identity: {
        schema: { type: 'string' },
        required: false,
        default: 'stable',
        access: 'readwrite',
        updateMode: 'recreate',
      },
      nullable: {
        schema: { type: ['string', 'null'] },
        required: false,
        default: null,
        access: 'readwrite',
        updateMode: 'live',
      },
    },
    commands: {
      read: {
        execution: 'sync',
        arguments: { type: 'object', additionalProperties: false },
        result: { type: 'object' },
      },
      special: { execution: 'sync', arguments: { type: 'string' }, result: { type: 'string' } },
    },
    events: { changed: { schema: { type: 'integer' } } },
  };
  const contexts = new Map<string, ComponentContext>();
  const states = new Map<string, JsonObject>();
  const disconnected = vi.fn();
  const terminated = vi.fn();
  const clicked = vi.fn();
  const definition: ComponentDefinition = {
    manifest,
    contract: implementationContractFromManifest(manifest),
    create(context, config) {
      contexts.set(context.instanceId, context);
      states.set(context.instanceId, config);
      context.root.textContent = String(config.required);
      if (options.allResources) {
        context.resources.listen(document, 'fixture', clicked);
        context.resources.interval(clicked, 1000);
        context.resources.timeout(clicked, 1000);
        context.resources.animationFrame(clicked);
        context.resources.observer({ disconnect: disconnected });
        context.resources.worker({ terminate: terminated });
        const portal = document.createElement('div');
        portal.className = 'fixture-portal';
        context.resources.portal(portal);
        context.resources.lockBackground(context.root);
        context.registerShortcut('Ctrl+K', clicked);
        context.resources.add(() => {});
      }
      if (options.throwCreate) throw new Error('secret source path C:/private/file.ts');
      return {
        prepareUpdate(next) {
          const previous = states.get(context.instanceId)!;
          return {
            commit() {
              states.set(context.instanceId, next);
              context.root.textContent = String(next.required);
              if (options.throwCommit) {
                context.emit('changed', 99);
                throw new Error('secret commit failure');
              }
            },
            rollback() {
              states.set(context.instanceId, previous);
              context.root.textContent = String(previous.required);
            },
          };
        },
        commands: {
          read: () => states.get(context.instanceId)!,
          special(args) {
            if (args === 'throw') throw new Error('provider secret');
            if (args === 'promise') return Promise.resolve('invalid') as unknown as JsonValue;
            if (args === 'rejected-promise')
              return Promise.reject(new Error('private')) as unknown as JsonValue;
            if (args === 'thenable') return { then: () => {} } as unknown as JsonValue;
            if (args === 'invalid') return 42;
            if (args === 'non-json') return document.body as unknown as JsonValue;
            return 'ok';
          },
        },
        dispose() {
          if (options.throwDispose) throw new Error('private dispose');
        },
      };
    },
  };
  return { definition, contexts, states, disconnected, terminated, clicked, options };
}

const runtimes: RuntimeBridge[] = [];
function runtime(definition = fixture().definition): RuntimeBridge {
  const result = createBridge({ document });
  const registration = decode(result.registerComponent(definition));
  expect(registration.ok, JSON.stringify(registration)).toBe(true);
  runtimes.push(result);
  return result;
}

function mount(
  bridge: RuntimeBridge,
  instance = 'a',
  host = 'host-a',
  config: unknown = baseConfig,
) {
  return decode(bridge.api.create('test-component', instance, host, JSON.stringify(config)));
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML =
    '<button id="outside">Outside</button><div id="host-a"><span id="retained">Host child</span></div><div id="host-b"></div><div id="host-c"></div>';
});
afterEach(() => {
  for (const bridge of runtimes.splice(0))
    for (const id of ['a', 'b', 'c', 'new']) bridge.api.dispose(id);
  vi.useRealTimers();
});

describe('serialized bridge boundary', () => {
  it('serializes success and malformed JSON without exposing parser internals', () => {
    const bridge = runtime();
    expect(decode(bridge.api.create('test-component', 'a', 'host-a', '{bad'))).toEqual({
      contractVersion: '1.0',
      ok: false,
      code: 'invalid-json',
      message: 'Malformed JSON input.',
      path: '/configuration',
    });
    expect(bridge.inspect().instances).toBe(0);
    expect(mount(bridge).code).toBe('created');
    expect(decode(bridge.api.getInfo('test-component')).value).toMatchObject({
      componentId: 'test-component',
    });
  });

  it('rejects non-string identifiers and serialized boundary arguments', () => {
    const bridge = runtime();
    expect(
      decode(bridge.api.create('test-component', 1 as unknown as string, 'host-a', '{}')).code,
    ).toBe('invalid-identifier');
    expect(decode(bridge.api.create('test-component', 'a', 'host-a', {} as string)).code).toBe(
      'invalid-json',
    );
    expect(decode(bridge.api.dispose('')).code).toBe('invalid-identifier');
  });

  it('validates required, nullable, unknown and typed configuration before mutation', () => {
    const bridge = runtime();
    expect(mount(bridge, 'a', 'host-a', {}).path).toBe('/properties/required');
    expect(mount(bridge, 'a', 'host-a', { ...baseConfig, count: null }).path).toBe(
      '/properties/count',
    );
    expect(mount(bridge, 'a', 'host-a', { ...baseConfig, extra: 1 }).path).toBe(
      '/properties/extra',
    );
    expect(mount(bridge, 'a', 'host-a', { ...baseConfig, nullable: null }).ok).toBe(true);
    expect(document.querySelector('#retained')).not.toBeNull();
  });

  it('rejects duplicate instance/container claims and routes independent instances', () => {
    const bridge = runtime();
    expect(mount(bridge).ok).toBe(true);
    expect(mount(bridge, 'a', 'host-b').code).toBe('duplicate-instance');
    expect(mount(bridge, 'b', 'host-a').code).toBe('container-claimed');
    expect(mount(bridge, 'b', 'missing').code).toBe('missing-container');
    expect(mount(bridge, 'b', 'host-b', { required: 'sibling' }).ok).toBe(true);
    expect(decode(bridge.api.update('a', JSON.stringify({ required: 'updated' }))).ok).toBe(true);
    expect(decode(bridge.api.invoke('b', 'read', '{}')).value).toMatchObject({
      required: 'sibling',
    });
    expect(decode(bridge.api.update('missing', '{}')).code).toBe('unknown-instance');
    expect(decode(bridge.api.create('missing', 'c', 'host-c', '{}')).code).toBe(
      'unknown-component',
    );
  });

  it('detects registration drift in both directions and exact duplicate compatibility', () => {
    const { definition } = fixture();
    const bridge = runtime(definition);
    expect(decode(bridge.registerComponent(definition)).ok).toBe(true);
    const conflicting = { ...definition, manifest: { ...definition.manifest, version: '2.0.0' } };
    expect(decode(bridge.registerComponent(conflicting)).code).toBe('incompatible-component');
    const other = fixture().definition;
    other.manifest.componentId = 'missing-command';
    delete other.contract.commands.read;
    // Copying shared command records would modify the manifest too; construct independent metadata.
    other.contract = implementationContractFromManifest(other.manifest);
    other.contract.commands = {
      ...other.manifest.commands,
      rogue: other.manifest.commands.special!,
    };
    expect(decode(bridge.registerComponent(other))).toMatchObject({
      code: 'implementation-contract-error',
      path: '/commands/rogue',
    });
  });
});

describe('create, update, and disposal transactions', () => {
  it('rejects actual missing and undeclared command handlers before committing creation', () => {
    for (const mode of ['missing', 'extra']) {
      const setup = fixture();
      const create = setup.definition.create;
      setup.definition.create = (context, config) => {
        const controller = create(context, config);
        if (mode === 'missing') delete controller.commands.read;
        else controller.commands.extra = () => null;
        return controller;
      };
      const bridge = runtime(setup.definition);
      expect(mount(bridge)).toMatchObject({
        code: 'implementation-contract-error',
        path: `/commands/${mode === 'missing' ? 'read' : 'extra'}`,
      });
      expect(bridge.inspect().instances).toBe(0);
      expect(document.querySelector('[data-osai-component]')).toBeNull();
    }
  });

  it('rolls back every managed resource after partial create and permits retry', () => {
    const setup = fixture({ throwCreate: true, allResources: true });
    const bridge = runtime(setup.definition);
    const response = mount(bridge);
    expect(response.code).toBe('internal-error');
    expect(JSON.stringify(response)).not.toMatch(/secret|private|\.ts|stack/);
    expect(document.querySelector('[data-osai-component]')).toBeNull();
    expect(document.querySelector('.fixture-portal')).toBeNull();
    expect(document.querySelector('#retained')).not.toBeNull();
    expect(document.querySelector('#outside')!.hasAttribute('inert')).toBe(false);
    expect(bridge.inspect()).toMatchObject({ instances: 0, subscriptions: 0, pendingEvents: 0 });
    expect(Object.values(bridge.inspect().resources).every((count) => count === 0)).toBe(true);
    expect(setup.disconnected).toHaveBeenCalledOnce();
    expect(setup.terminated).toHaveBeenCalledOnce();
    setup.options.throwCreate = false;
    expect(mount(bridge).ok).toBe(true);
  });

  it('replaces full configuration, restores defaults, and preserves instance/root', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const root = setup.contexts.get('a')!.root;
    expect(decode(bridge.api.update('a', JSON.stringify({ required: 'next' }))).ok).toBe(true);
    expect(setup.states.get('a')).toEqual({
      required: 'next',
      count: 0,
      identity: 'stable',
      nullable: null,
    });
    expect(setup.contexts.get('a')!.root).toBe(root);
  });

  it('preserves state after invalid or recreation-required updates', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const previous = setup.states.get('a');
    expect(decode(bridge.api.update('a', JSON.stringify({ count: 99 }))).code).toBe(
      'validation-error',
    );
    expect(
      decode(bridge.api.update('a', JSON.stringify({ ...baseConfig, identity: 'new' }))),
    ).toMatchObject({ code: 'recreation-required', path: '/properties/identity' });
    expect(setup.states.get('a')).toBe(previous);
    expect(setup.contexts.get('a')!.root.textContent).toBe('initial');
  });

  it('rolls back throwing commits and drops their events', async () => {
    const setup = fixture({ throwCommit: true });
    const bridge = runtime(setup.definition);
    mount(bridge);
    const callback = vi.fn();
    bridge.api.registerCallback('a', 'changed', callback);
    expect(decode(bridge.api.update('a', JSON.stringify({ required: 'broken' }))).code).toBe(
      'internal-error',
    );
    await vi.runAllTimersAsync();
    expect(setup.contexts.get('a')!.root.textContent).toBe('initial');
    expect(setup.states.get('a')!.required).toBe('initial');
    expect(callback).not.toHaveBeenCalled();
  });

  it('validates semantic component constraints before applying anything', () => {
    const setup = fixture();
    setup.definition.validateConfig = (value) =>
      value.required === 'forbidden'
        ? [{ code: 'forbidden', path: '/properties/required', message: 'Not permitted.' }]
        : [];
    const bridge = runtime(setup.definition);
    mount(bridge);
    expect(decode(bridge.api.update('a', '{"required":"forbidden"}'))).toMatchObject({
      code: 'validation-error',
      path: '/properties/required',
    });
    expect(setup.states.get('a')!.required).toBe('initial');
  });

  it('defensively disposes all resource classes after host removal and throwing cleanup', () => {
    const setup = fixture({ allResources: true, throwDispose: true });
    const bridge = runtime(setup.definition);
    mount(bridge);
    expect(bridge.inspect().resources).toMatchObject({
      listeners: 2,
      timers: 2,
      observers: 1,
      animationFrames: 1,
      workers: 1,
      portals: 1,
      backgroundLocks: 1,
      ownedRoots: 1,
      shortcutClaims: 1,
    });
    document.querySelector('#host-a')!.remove();
    expect(decode(bridge.api.dispose('a')).ok).toBe(true);
    expect(decode(bridge.api.dispose('a')).ok).toBe(true);
    expect(Object.values(bridge.inspect().resources).every((count) => count === 0)).toBe(true);
    expect(bridge.inspect().diagnostics.some((value) => value.code === 'cleanup-error')).toBe(true);
    document.dispatchEvent(new Event('fixture'));
    vi.runAllTimers();
    expect(setup.clicked).not.toHaveBeenCalled();
  });

  it('completes 100 create/update/invoke/dispose cycles with no resources or callbacks', () => {
    const bridge = runtime(fixture({ allResources: true }).definition);
    for (let index = 0; index < 100; index += 1) {
      expect(mount(bridge).ok).toBe(true);
      bridge.api.registerCallback('a', 'changed', () => {});
      expect(decode(bridge.api.update('a', '{"required":"cycle"}')).ok).toBe(true);
      expect(decode(bridge.api.invoke('a', 'read', '{}')).ok).toBe(true);
      bridge.api.dispose('a');
    }
    expect(bridge.inspect()).toMatchObject({ instances: 0, subscriptions: 0, pendingEvents: 0 });
    expect(Object.values(bridge.inspect().resources).every((count) => count === 0)).toBe(true);
  });

  it('keeps failed-release counts visible after removing the instance while cleaning other resources', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const context = setup.contexts.get('a')!;
    context.resources.observer({
      disconnect() {
        throw new Error('Private failure');
      },
    });
    context.resources.listen(document, 'example', () => {});
    expect(decode(bridge.api.dispose('a')).ok).toBe(true);
    expect(bridge.inspect()).toMatchObject({
      instances: 0,
      resources: { observers: 1, listeners: 0, ownedRoots: 0 },
    });
    expect(bridge.inspect().diagnostics).toContainEqual({
      code: 'cleanup-error',
      path: '',
      message: 'A managed cleanup failed.',
    });
  });
});

describe('synchronous commands and asynchronous events', () => {
  it.each([
    ['throw', 'internal-error'],
    ['promise', 'unsupported-execution-mode'],
    ['rejected-promise', 'unsupported-execution-mode'],
    ['thenable', 'unsupported-execution-mode'],
    ['invalid', 'invalid-command-result'],
    ['non-json', 'invalid-command-result'],
  ])('rejects %s command outcomes predictably', (argument, code) => {
    const bridge = runtime();
    mount(bridge);
    expect(decode(bridge.api.invoke('a', 'special', JSON.stringify(argument))).code).toBe(code);
  });

  it('validates unknown commands, invalid arguments and result schemas', () => {
    const bridge = runtime();
    mount(bridge);
    expect(decode(bridge.api.invoke('a', 'unknown', '{}')).code).toBe('unknown-command');
    expect(decode(bridge.api.invoke('a', 'toString', '{}')).code).toBe('unknown-command');
    expect(decode(bridge.api.invoke('a', 'special', '42'))).toMatchObject({
      code: 'validation-error',
      path: '/commands/special/arguments',
    });
    expect(decode(bridge.api.invoke('a', 'special', '"valid"'))).toMatchObject({
      code: 'invoked',
      value: 'ok',
    });
  });

  it('queues events in order, isolates instances and throwing subscribers', async () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    mount(bridge, 'b', 'host-b');
    const values: unknown[] = [];
    const sibling = vi.fn();
    bridge.api.registerCallback('a', 'changed', () => {
      throw new Error('private callback');
    });
    bridge.api.registerCallback('a', 'changed', (event) => values.push(decode(event).value));
    bridge.api.registerCallback('b', 'changed', sibling);
    setup.contexts.get('a')!.emit('changed', 1);
    setup.contexts.get('a')!.emit('changed', 2);
    expect(values).toEqual([]);
    await vi.runAllTimersAsync();
    expect(values).toEqual([
      { instanceId: 'a', eventName: 'changed', payload: 1 },
      { instanceId: 'a', eventName: 'changed', payload: 2 },
    ]);
    expect(sibling).not.toHaveBeenCalled();
    expect(
      bridge.inspect().diagnostics.filter((value) => value.code === 'callback-error'),
    ).toHaveLength(2);
  });

  it('rejects undeclared or invalid events without leaking data', async () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const callback = vi.fn();
    bridge.api.registerCallback('a', 'changed', callback);
    setup.contexts.get('a')!.emit('changed', 'bad');
    setup.contexts.get('a')!.emit('unknown', 1);
    setup.contexts.get('a')!.emit('toString', 1);
    await vi.runAllTimersAsync();
    expect(callback).not.toHaveBeenCalled();
    expect(
      bridge.inspect().diagnostics.filter((value) => value.code === 'event-contract-error'),
    ).toHaveLength(3);
  });

  it('cancels queued delivery on unsubscribe, replacement registration and disposal', async () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const first = vi.fn();
    const later = vi.fn();
    const registration = decode<{ subscriptionId: string }>(
      bridge.api.registerCallback('a', 'changed', first),
    );
    setup.contexts.get('a')!.emit('changed', 1);
    bridge.api.unregisterCallback('a', registration.value!.subscriptionId);
    bridge.api.registerCallback('a', 'changed', later);
    await vi.runAllTimersAsync();
    expect(first).not.toHaveBeenCalled();
    expect(later).not.toHaveBeenCalled();
    setup.contexts.get('a')!.emit('changed', 2);
    bridge.api.dispose('a');
    setup.contexts.get('a')!.emit('changed', 3);
    await vi.runAllTimersAsync();
    expect(later).not.toHaveBeenCalled();
    expect(bridge.inspect().resources.timers).toBe(0);
  });

  it('stops sibling callbacks immediately when callback disposes its instance', async () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const second = vi.fn();
    bridge.api.registerCallback('a', 'changed', () => bridge.api.dispose('a'));
    bridge.api.registerCallback('a', 'changed', second);
    setup.contexts.get('a')!.emit('changed', 1);
    await vi.runAllTimersAsync();
    expect(second).not.toHaveBeenCalled();
  });
});

describe('global bootstrap and coordinated resources', () => {
  it('reuses exact-version installations and live subscriptions', () => {
    const globalObject = {};
    const first = installBridge({ globalObject, document });
    runtimes.push(first);
    first.registerComponent(fixture().definition);
    mount(first);
    first.api.registerCallback('a', 'changed', () => {});
    const second = installBridge({ globalObject, document });
    expect(second).toBe(first);
    expect(second.inspect()).toMatchObject({ instances: 1, subscriptions: 1 });
    expect(
      Object.keys((globalObject as { OSAI: { Components: { v1: object } } }).OSAI.Components.v1),
    ).not.toContain('registerComponent');
  });

  it('fails incompatible namespaces without mutating any existing object', () => {
    const api = { occupied: true };
    const globalObject = { OSAI: { Components: { v1: api } } };
    expect(() => installBridge({ globalObject, document })).toThrow('Incompatible');
    expect(globalObject.OSAI.Components.v1).toBe(api);
    const intermediate = { OSAI: { Components: 17 } };
    expect(() => installBridge({ globalObject: intermediate, document })).toThrow('Incompatible');
    expect(intermediate).toEqual({ OSAI: { Components: 17 } });
    expect(() => installBridge({ globalObject: {}, document, namespace: '__proto__.bad' })).toThrow(
      'Invalid',
    );
  });

  it('normalizes platform modifiers and equivalent modifier orders', () => {
    expect(normalizeShortcut(' Shift + Control + P ')).toBe('ctrl+shift+p');
    expect(normalizeShortcut('Mod+K')).toBe('ctrl+k');
    expect(normalizeShortcut('Mod+K', true)).toBe('meta+k');
    expect(normalizeShortcut('Alt+Shift+P')).toBe('alt+shift+p');
    expect(normalizeShortcut('Ctrl+Ctrl+K')).toBeUndefined();
  });

  it('assigns one shortcut owner, reports contention and transfers deterministically', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    mount(bridge, 'b', 'host-b');
    mount(bridge, 'c', 'host-c');
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    const conflicts = vi.fn();
    const cancelA = setup.contexts.get('a')!.registerShortcut('Ctrl+K', a);
    setup.contexts.get('b')!.registerShortcut('Control+k', b, { onConflict: conflicts });
    setup.contexts.get('c')!.registerShortcut('Ctrl+K', c, { onConflict: conflicts });
    const press = () =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      );
    press();
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();
    expect(conflicts).toHaveBeenCalledTimes(2);
    expect(bridge.inspect().resources.listeners).toBe(1);
    cancelA();
    press();
    expect(b).toHaveBeenCalledOnce();
    bridge.api.dispose('b');
    press();
    expect(c).toHaveBeenCalledOnce();
    bridge.api.dispose('c');
    expect(bridge.inspect().resources.listeners).toBe(0);
  });

  it('ignores editable origins outside the open owned palette', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const context = setup.contexts.get('a')!;
    const handler = vi.fn();
    let open = false;
    context.registerShortcut('Ctrl+K', handler, { isOpen: () => open });
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    const inside = document.createElement('input');
    context.root.appendChild(inside);
    const press = (target: HTMLElement) =>
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      );
    press(outside);
    press(inside);
    expect(handler).not.toHaveBeenCalled();
    open = true;
    press(outside);
    press(inside);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('restores original background attributes without releasing another modal lock', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    mount(bridge, 'b', 'host-b');
    const outside = document.querySelector('#outside')!;
    outside.setAttribute('aria-hidden', 'false');
    const releaseA = setup.contexts
      .get('a')!
      .resources.lockBackground(setup.contexts.get('a')!.root);
    expect(outside.hasAttribute('inert')).toBe(true);
    const releaseB = setup.contexts
      .get('b')!
      .resources.lockBackground(setup.contexts.get('b')!.root);
    expect(document.querySelector('#host-a')!.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('#host-b')!.hasAttribute('inert')).toBe(false);
    releaseA();
    expect(outside.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('#host-a')!.hasAttribute('inert')).toBe(true);
    releaseB();
    expect(outside.hasAttribute('inert')).toBe(false);
    expect(outside.getAttribute('aria-hidden')).toBe('false');
  });

  it('counts listener once/abort, completed timers/frames, and cleanup cancellation truthfully', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    const resources = setup.contexts.get('a')!.resources;
    const once = vi.fn();
    resources.listen(document, 'once', once, { once: true });
    document.dispatchEvent(new Event('once'));
    document.dispatchEvent(new Event('once'));
    expect(once).toHaveBeenCalledOnce();
    expect(bridge.inspect().resources.listeners).toBe(0);
    const abort = new AbortController();
    resources.listen(document, 'abort', once, { signal: abort.signal });
    abort.abort();
    expect(bridge.inspect().resources.listeners).toBe(0);
    resources.timeout(once, 1);
    resources.animationFrame(once);
    vi.advanceTimersByTime(32);
    expect(bridge.inspect().resources.timers).toBe(0);
    expect(bridge.inspect().resources.animationFrames).toBe(0);
    bridge.api.dispose('a');
    const late = vi.fn();
    resources.add(late);
    expect(late).toHaveBeenCalledOnce();
  });

  it('rejects unmanaged portal capabilities before appending anything', () => {
    const setup = fixture();
    const bridge = runtime(setup.definition);
    mount(bridge);
    expect(() =>
      setup.contexts.get('a')!.resources.portal(document.createElement('section')),
    ).toThrow('Undeclared portal');
    expect(document.querySelector('section')).toBeNull();
  });
});
