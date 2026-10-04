// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BackgroundLocks, ManagedResources } from './resources.js';
import type { ComponentContext, ComponentDefinition, ManagedOperation } from '@osai/component-sdk';
import { componentDefinition } from '../../../tests/fixtures/minimal/src/index.js';
import { createBridge } from './index.js';
import { capabilityProfile } from '@osai/contract-schemas';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="host"></div>';
});
afterEach(() => vi.useRealTimers());
it('cancels superseded work, isolates keys/scopes and consumes late rejection', async () => {
  const report = vi.fn();
  const scope = new ManagedResources(window, new BackgroundLocks(document), report);
  const older = deferred<string>();
  const newer = deferred<string>();
  const other = deferred<string>();
  const completed = vi.fn();
  const old = scope.operation('search', () => older.promise, completed);
  const current = scope.operation('search', () => newer.promise, completed);
  const independent = scope.operation('other', () => other.promise, completed);
  expect(old.signal.aborted).toBe(true);
  expect(old.isCurrent()).toBe(false);
  expect(current.generation).toBeGreaterThan(old.generation);
  expect(independent.isCurrent()).toBe(true);
  older.reject(new Error('private stale rejection'));
  newer.resolve('new');
  other.resolve('other');
  await Promise.resolve();
  await Promise.resolve();
  expect(completed.mock.calls.flat()).toEqual(['new', 'other']);
  expect(report).not.toHaveBeenCalled();
  const child = scope.child();
  const effect = vi.fn();
  child.listen(document, 'child', effect);
  child.interval(effect, 1);
  child.dispose();
  document.dispatchEvent(new Event('child'));
  vi.runAllTimers();
  expect(effect).not.toHaveBeenCalled();
  const pending = deferred<string>();
  const operation = scope.operation('disposed', () => pending.promise, completed);
  scope.dispose();
  expect(operation.signal.aborted).toBe(true);
  pending.resolve('late');
  await Promise.resolve();
  await Promise.resolve();
  expect(completed.mock.calls.flat()).toEqual(['new', 'other']);
  expect(Object.values(scope.counts).every((value) => value === 0)).toBe(true);
});
it('reports only current failures and cleans partial work even when handlers throw', async () => {
  const report = vi.fn();
  const scope = new ManagedResources(window, new BackgroundLocks(document), report);
  const released = vi.fn();
  scope.operation(
    'failure',
    async (context) => {
      context.resources.add(released);
      throw new Error('private');
    },
    () => {},
    () => {
      throw new Error('private callback');
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  expect(report.mock.calls.map((call) => call[0])).toEqual(['operation-error', 'operation-error']);
  expect(released).toHaveBeenCalledOnce();
  expect(Object.values(scope.counts).every((value) => value === 0)).toBe(true);
  scope.dispose();
});
it.each(['prepare', 'commit', 'success'])(
  'handles provisional replacements across %s',
  async (phase) => {
    const oldResult = deferred<string>();
    const newResult = deferred<string>();
    const seen: string[] = [];
    let old!: ManagedOperation;
    let replacement!: ManagedOperation;
    let context!: ComponentContext;
    const definition = componentDefinition as unknown as ComponentDefinition;
    const runtime = createBridge({ document });
    runtime.registerComponent({
      ...definition,
      profile: capabilityProfile('managed-async'),
      create(ctx, config) {
        context = ctx;
        const controller = definition.create(ctx, config);
        old = ctx.resources.operation(
          'load',
          () => oldResult.promise,
          (value) => ctx.emit('read', { label: value }),
        );
        return {
          ...controller,
          prepareUpdate(next) {
            replacement = ctx.resources.operation(
              'load',
              () => newResult.promise,
              (value) => ctx.emit('read', { label: value }),
            );
            if (phase === 'prepare') throw new Error('prepare');
            const tx = controller.prepareUpdate(next);
            return {
              commit() {
                tx.commit();
                if (phase === 'commit') throw new Error('commit');
              },
              rollback: tx.rollback,
            };
          },
        };
      },
    });
    runtime.api.create('minimal', 'a', 'host', '{}');
    runtime.api.registerCallback('a', 'read', (json) =>
      seen.push(
        (JSON.parse(json) as { value: { payload: { label: string } } }).value.payload.label,
      ),
    );
    expect(JSON.parse(runtime.api.update('a', '{}')).ok).toBe(phase === 'success');
    expect(old.signal.aborted).toBe(phase === 'success');
    expect(replacement.signal.aborted).toBe(phase !== 'success');
    newResult.resolve('new');
    oldResult.resolve('old');
    await Promise.resolve();
    await Promise.resolve();
    vi.runAllTimers();
    expect(seen).toEqual([phase === 'success' ? 'new' : 'old']);
    runtime.api.dispose('a');
    expect(Object.values(runtime.inspect().resources).every((value) => value === 0)).toBe(true);
    expect(context.resources).toBeDefined();
  },
);
it('retains an existing child scope when its disposal is rolled back', () => {
  const scope = new ManagedResources(window, new BackgroundLocks(document), () => {});
  const child = scope.child();
  const effect = vi.fn();
  child.listen(document, 'probe', effect);
  const transaction = scope.beginTransaction();
  child.dispose();
  transaction.rollback();
  document.dispatchEvent(new Event('probe'));
  expect(effect).toHaveBeenCalledOnce();
  scope.dispose();
  expect(Object.values(scope.counts).every((value) => value === 0)).toBe(true);
});
it('rejects managed operations under an unrelated base profile before starting work', () => {
  const runtime = createBridge({ document });
  const start = vi.fn(() => Promise.resolve('unused'));
  const definition = componentDefinition as unknown as ComponentDefinition;
  runtime.registerComponent({
    ...definition,
    create(context, config) {
      context.resources.child().operation('unauthorized', start, () => {});
      return definition.create(context, config);
    },
  });
  expect(JSON.parse(runtime.api.create('minimal', 'a', 'host', '{}')).ok).toBe(false);
  expect(start).not.toHaveBeenCalled();
  expect(JSON.parse(runtime.api.getInfo()).value.instances).toBe(0);
});

it('cleans provider partial initialization and successful disposal through declared ownership', () => {
  const definition = componentDefinition as unknown as ComponentDefinition;
  const runtime = createBridge({ document });
  const effect = vi.fn();
  let fail = true;
  runtime.registerComponent({
    ...definition,
    profile: capabilityProfile('imperative-provider'),
    create(context, config) {
      context.resources.adoptProvider(
        {
          id: 'test',
          capabilities: ['listeners', 'timers'],
          partialInitialization: 'register-cleanup-before-allocation',
          update: 'transactional',
          disposal: 'scope',
        },
        (scope) => {
          const pending: { timer?: number } = {};
          scope.add(() => {
            document.removeEventListener('provider', effect);
            if (pending.timer !== undefined) window.clearInterval(pending.timer);
            context.root.replaceChildren();
          });
          document.addEventListener('provider', effect);
          pending.timer = window.setInterval(effect, 10);
          context.root.textContent = 'provider';
          if (fail) throw new Error('partial initialization');
          return { ready: true };
        },
      );
      return definition.create(context, config);
    },
  });
  expect(JSON.parse(runtime.api.create('minimal', 'a', 'host', '{}')).ok).toBe(false);
  document.dispatchEvent(new Event('provider'));
  vi.advanceTimersByTime(20);
  expect(effect).not.toHaveBeenCalled();
  expect(Object.values(runtime.inspect().resources).every((value) => value === 0)).toBe(true);
  fail = false;
  expect(JSON.parse(runtime.api.create('minimal', 'a', 'host', '{}')).ok).toBe(true);
  runtime.api.dispose('a');
  document.dispatchEvent(new Event('provider'));
  vi.advanceTimersByTime(20);
  expect(effect).not.toHaveBeenCalled();
  const unsupported = new ManagedResources(window, new BackgroundLocks(document), () => {});
  expect(() =>
    unsupported.adoptProvider(
      {
        id: 'test',
        capabilities: [],
        partialInitialization: 'register-cleanup-before-allocation',
        update: 'transactional',
        disposal: 'scope',
      },
      () => null,
    ),
  ).toThrow('supported profile');
  unsupported.dispose();
});
