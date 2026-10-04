// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { capabilityProfile } from '@osai/contract-schemas';
import type { ComponentContext, ComponentDefinition } from '@osai/component-sdk';
import { componentDefinition } from '../../../tests/fixtures/minimal/src/index.js';
import { createBridge } from './index.js';
import { checkJsonText, checkJsonValue } from './limits.js';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="host"></div>';
});
afterEach(() => vi.useRealTimers());
it('enforces byte/depth limits before input normalization, including UTF-8 and quoted braces', () => {
  const profile = capabilityProfile();
  profile.limits = { jsonBytes: 64, jsonDepth: 2, eventCapacity: 4, deliveryBatch: 2 };
  const runtime = createBridge({ document, profile });
  runtime.registerComponent(componentDefinition);
  const decode = (json: string) => JSON.parse(json) as { ok: boolean; code: string; path?: string };
  expect(
    decode(runtime.api.create('minimal', 'a', 'host', JSON.stringify({ label: 'é'.repeat(40) }))),
  ).toMatchObject({ code: 'json-limit-exceeded', path: '/limits/jsonBytes' });
  expect(decode(runtime.api.create('minimal', 'a', 'host', '{"x":[{}]}'))).toMatchObject({
    code: 'json-limit-exceeded',
    path: '/limits/jsonDepth',
  });
  expect(
    decode(runtime.api.create('minimal', 'a', 'host', JSON.stringify({ label: '{[["' }))).ok,
  ).toBe(true);
  expect(decode(runtime.api.update('a', JSON.stringify({ label: 'x'.repeat(80) }))).code).toBe(
    'json-limit-exceeded',
  );
  expect(JSON.parse(runtime.api.invoke('a', 'read', '{}')).value).toBe('{[["');
  runtime.api.dispose('a');
  expect(() => checkJsonValue({ one: { two: { three: true } } }, profile.limits)).toThrow('limit');
  expect(() => checkJsonText('[[]]', profile.limits)).not.toThrow();
});
it('bounds events/results, rejects newest overflow and yields batches without FIFO loss', () => {
  const profile = capabilityProfile();
  profile.limits = { jsonBytes: 64, jsonDepth: 4, eventCapacity: 4, deliveryBatch: 2 };
  let context: ComponentContext | undefined;
  const definition = componentDefinition as unknown as ComponentDefinition;
  const runtime = createBridge({ document, profile });
  runtime.registerComponent({
    ...definition,
    create(ctx, config) {
      context = ctx;
      const controller = definition.create(ctx, config);
      return { ...controller, commands: { read: () => 'x'.repeat(80) } };
    },
  });
  runtime.api.create('minimal', 'a', 'host', '{}');
  const seen: string[] = [];
  runtime.api.registerCallback('a', 'read', (json) =>
    seen.push((JSON.parse(json) as { value: { payload: { label: string } } }).value.payload.label),
  );
  context!.emit('read', { label: 'x'.repeat(80) });
  for (const label of ['one', 'two', 'three', 'four', 'rejected']) context!.emit('read', { label });
  expect(runtime.inspect().pendingEvents).toBe(4);
  expect(JSON.parse(runtime.api.invoke('a', 'read', '{}')).code).toBe('json-limit-exceeded');
  vi.advanceTimersToNextTimer();
  expect(seen).toEqual(['one', 'two']);
  expect(runtime.inspect().pendingEvents).toBe(2);
  vi.runAllTimers();
  expect(seen).toEqual(['one', 'two', 'three', 'four']);
  expect(runtime.inspect().diagnostics.map((item) => item.code)).toEqual([
    'json-limit-exceeded',
    'event-queue-full',
  ]);
  runtime.api.dispose('a');
});
it('rejects invalid profile versions and incompatible re-registration without replacing live limits', () => {
  const runtime = createBridge({ document });
  const profile = capabilityProfile();
  profile.limits.eventCapacity = 4;
  profile.limits.deliveryBatch = 2;
  expect(JSON.parse(runtime.registerComponent({ ...componentDefinition, profile })).ok).toBe(true);
  profile.limits.eventCapacity = 8;
  expect(JSON.parse(runtime.registerComponent({ ...componentDefinition, profile })).code).toBe(
    'incompatible-component',
  );
  const invalid = { ...profile, schemaVersion: '9.0' } as unknown as typeof profile;
  expect(
    JSON.parse(
      createBridge({ document }).registerComponent({ ...componentDefinition, profile: invalid }),
    ).ok,
  ).toBe(false);
});
