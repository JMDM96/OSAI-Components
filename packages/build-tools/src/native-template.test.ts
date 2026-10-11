import { beforeAll, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { BridgeApi } from '@osai/runtime-bridge';
import type { ComponentManifest } from '@osai/contract-schemas';
import { canonicalJson } from '@osai/contract-schemas';
import { buildRelease } from './build.js';
import { generateNativePlan, inspectNativePlan } from './native-plan.js';
import type { NativePlan, OdcNativePlan } from './native-plan.js';
import { generateOdcImplementation, validateNativeImplementation } from './native-template.js';
import { checksum } from './release.js';

const releases: Record<string, { root: string; plan: OdcNativePlan; manifest: ComponentManifest }> =
  {};
beforeAll(async () => {
  for (const [id, manifestFile] of [
    ['palette', undefined],
    ['minimal', 'tests/fixtures/minimal/component.manifest.json'],
    ['resources', 'tests/fixtures/resources/component.manifest.json'],
    ['recreate', 'tests/fixtures/recreation/component.manifest.json'],
  ] as const) {
    const built = await buildRelease(process.cwd(), {
      outputRoot: await mkdtemp(join(tmpdir(), 'osai-native-glue-')),
      manifestFile,
    });
    const plan = await generateNativePlan(built.root, 'odc');
    if (plan.schemaVersion !== '3.0') throw new Error('Expected ODC plan');
    releases[id] = { root: built.root, plan, manifest: built.manifest };
  }
}, 30000);

async function harness(id = 'palette') {
  const release = releases[id]!;
  const dom = new JSDOM(
    '<section id="a"><div id="one"></div></section><section id="b"><div id="two"></div></section>',
    { url: 'https://example.test/sample', runScripts: 'outside-only', pretendToBeVisual: true },
  );
  const w = dom.window;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.eval(await readFile(join(release.root, 'odc', `${release.plan.componentId}.js`), 'utf8'));
  const api = (w as unknown as { OSAI: { Components: { v1: BridgeApi } } }).OSAI.Components.v1;
  const events: { name: string; payload: unknown }[] = [];
  const actions = Object.fromEntries(
    [
      ...Object.keys(release.manifest.events).map((name) => `Forward_${name}`),
      'NativeDiagnostic',
    ].map((name) => [
      name,
      (payload: unknown) => {
        expect(typeof payload).toBe('string');
        events.push({ name, payload: JSON.parse(payload as string) });
      },
    ]),
  );
  const run = (name: string, parameters: Record<string, unknown>) => {
    const node = release.plan.implementation.nodes.find((item) => item.name === name)!;
    expect(node).toBeDefined();
    // Model a host that supplies only explicitly named action dependencies.
    // This exercises the boundary; the live ODC graph must still verify native references.
    const referenced = [...node.source.matchAll(/\$actions\.([A-Za-z][A-Za-z0-9_]*)/g)].map(
      (match) => match[1]!,
    );
    const scopedActions = Object.fromEntries(referenced.map((name) => [name, actions[name]]));
    new w.Function('$parameters', '$actions', node.source)(parameters, scopedActions);
    return parameters;
  };
  const mapped = run(
    'BuildResources',
    Object.fromEntries(
      release.plan.resources.assets.map((asset, index) => [
        `Asset_${index}`,
        `/assets/${asset.path}`,
      ]),
    ),
  );
  const ready = (instance: string, container: string, config: unknown) =>
    run('Ready', {
      ...mapped,
      InstanceId: instance,
      ContainerId: container,
      ConfigJson: JSON.stringify(config),
    });
  const load = () =>
    w.document.querySelectorAll('link').forEach((link) => link.dispatchEvent(new w.Event('load')));
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
  return { dom, w, api, events, actions, run, ready, load, tick, mapped, release };
}

it('separates ODC format 3 from legacy/O11 and rejects unknown or incompatible formats', async () => {
  const plan = releases.palette!.plan;
  expect(plan.actions.map((a) => a.name)).not.toContain('RegisterCallback');
  expect(plan.implementation.nodes.filter((a) => a.visibility === 'public')).toHaveLength(8);
  const o11 = await generateNativePlan(releases.palette!.root, 'o11-reactive');
  expect(o11.schemaVersion).toBe('2.0');
  expect(o11.actions.find((a) => a.name === 'RegisterCallback')!.inputs).toContain(
    'ForwardToBlockEvent:ClientAction',
  );
  const legacy = { ...o11, target: 'odc' as const };
  const { planDigest: _, ...unsigned } = legacy;
  legacy.planDigest = checksum(canonicalJson(unsigned));
  expect(inspectNativePlan(legacy).execution).toBe('historical-only');
  expect(() =>
    inspectNativePlan({ ...plan, schemaVersion: '99' } as unknown as NativePlan),
  ).toThrow('Unknown');
  expect(() =>
    inspectNativePlan({ ...plan, target: 'o11-reactive' } as unknown as NativePlan),
  ).toThrow('mismatch');
});

it('describes the native stylesheet wait before component creation', async () => {
  const h = await harness();
  expect(h.release.plan.implementation.loadOrder).toEqual([
    'command-palette.js',
    'registerResources',
    'command-palette.css',
    'create',
  ]);
  expect(JSON.parse(h.ready('ordered', 'one', { commands: [] }).EnvelopeJson as string).code).toBe(
    'loading',
  );
  expect(h.w.document.querySelector('link')?.getAttribute('href')).toBe(
    '/assets/command-palette.css',
  );
  expect(JSON.parse(h.api.getInfo()).value.instances).toBe(0);
  h.load();
  expect(JSON.parse(h.api.getInfo()).value.instances).toBe(1);
  h.run('Dispose', { InstanceId: 'ordered' });
  h.dom.window.close();
});

it('runs create, positional events, full update rejection and cleanup against the packaged palette', async () => {
  const h = await harness();
  const config = { commands: [{ id: 'one', label: 'One' }], title: 'Initial' };
  expect(JSON.parse(h.ready('first', 'one', config).EnvelopeJson as string).code).toBe('loading');
  h.load();
  expect(
    JSON.parse(
      h.run('Command_open', { InstanceId: 'first', ArgumentsJson: '{}' }).EnvelopeJson as string,
    ).ok,
  ).toBe(true);
  await h.tick();
  expect(h.events.filter((e) => e.name === 'Forward_opened')).toHaveLength(1);
  const next = JSON.stringify({ ...config, title: 'Changed' });
  expect(
    JSON.parse(
      h.run('ApplyConfiguration', { InstanceId: 'first', ConfigJson: next }).EnvelopeJson as string,
    ).ok,
  ).toBe(true);
  const bad = h.run('ApplyConfiguration', { InstanceId: 'first', ConfigJson: '{"commands":null}' });
  expect(JSON.parse(bad.EnvelopeJson as string).ok).toBe(false);
  expect(bad.AcceptedConfigJson).toBe(next);
  expect(h.events.some((e) => e.name === 'Forward_error')).toBe(true);
  const labelId = h.w.document.querySelector('[role="dialog"]')!.getAttribute('aria-labelledby')!;
  expect(h.w.document.getElementById(labelId)!.textContent).toBe('Changed');
  const unchanged = h.run('ApplyConfiguration', { InstanceId: 'first', ConfigJson: next });
  expect(JSON.parse(unchanged.EnvelopeJson as string).code).toBe('unchanged');
  h.w.document.getElementById('one')!.remove();
  expect(JSON.parse(h.run('Dispose', { InstanceId: 'first' }).EnvelopeJson as string).ok).toBe(
    true,
  );
  expect(JSON.parse(h.run('Dispose', { InstanceId: 'first' }).EnvelopeJson as string).ok).toBe(
    true,
  );
  expect(h.w.document.querySelectorAll('link')).toHaveLength(0);
  expect(JSON.parse(h.api.getInfo()).value.instances).toBe(0);
  expect(JSON.parse(h.api.getInfo()).value.subscriptions).toBe(0);
  h.dom.window.close();
});

it('shares CSS while loading and suppresses disposed listeners and duplicate instances', async () => {
  const h = await harness('minimal');
  h.ready('first', 'one', { label: 'First' });
  h.ready('second', 'two', { label: 'Second' });
  expect(h.w.document.querySelectorAll('link')).toHaveLength(1);
  expect(JSON.parse(h.ready('first', 'one', {}).EnvelopeJson as string).code).toBe(
    'duplicate-instance',
  );
  h.run('Dispose', { InstanceId: 'first' });
  h.load();
  expect(JSON.parse(h.api.invoke('first', 'read', '{}')).code).toBe('unknown-instance');
  expect(
    JSON.parse(
      h.run('Command_read', { InstanceId: 'second', ArgumentsJson: '{}' }).EnvelopeJson as string,
    ).value,
  ).toBe('Second');
  await h.tick();
  expect(h.events).toHaveLength(1);
  expect(h.run('ResolveInstance', { RootId: 'b' }).InstanceId).toBe('second');
  expect(h.run('ResolveInstance', { RootId: 'missing' }).InstanceId).toBe('');
  h.w.document
    .getElementById('b')!
    .appendChild(h.w.document.createElement('span'))
    .setAttribute('data-osai-instance-id', 'other');
  expect(h.run('ResolveInstance', { RootId: 'b' }).InstanceId).toBe('');
  h.run('Dispose', { InstanceId: 'second' });
  expect(h.w.document.querySelectorAll('link')).toHaveLength(0);
  h.dom.window.close();
});

it('reports CSS failure, cleans failed creation and uses the latest pending configuration', async () => {
  const h = await harness('minimal');
  h.ready('failed', 'one', { label: 'No' });
  h.w.document.querySelector('link')!.dispatchEvent(new h.w.Event('error'));
  expect(h.events[0]!.name).toBe('NativeDiagnostic');
  expect(h.w.document.querySelectorAll('link')).toHaveLength(0);
  h.ready('latest', 'one', { label: 'Old' });
  h.run('ApplyConfiguration', { InstanceId: 'latest', ConfigJson: '{"label":"Latest"}' });
  h.load();
  expect(JSON.parse(h.api.invoke('latest', 'read', '{}')).value).toBe('Latest');
  h.run('Dispose', { InstanceId: 'latest' });
  h.ready('invalid', 'one', { label: 9 });
  h.load();
  expect(JSON.parse(h.api.getInfo()).value.instances).toBe(0);
  expect(h.w.document.querySelectorAll('link')).toHaveLength(0);
  h.dom.window.close();
});

it('builds complete auxiliary mappings without palette-specific identities', async () => {
  const h = await harness('resources');
  const registration = JSON.parse(h.mapped.RegistrationJson as string);
  expect(Object.keys(registration.mappings).sort()).toEqual(
    h.release.plan.resources.registration.assets.map((a) => a.id).sort(),
  );
  expect(
    JSON.parse(h.api.registerResources('resources', h.mapped.RegistrationJson as string)).ok,
  ).toBe(true);
  expect(h.release.plan.implementation.nodes.map((n) => n.source).join('\n')).not.toContain(
    'command-palette',
  );
  h.ready('resource', 'one', { label: 'Native resource' });
  h.load();
  expect(JSON.parse(h.api.invoke('resource', 'read', '{}')).value).toBe('Native resource');
  h.run('Dispose', { InstanceId: 'resource' });
  expect(h.w.document.querySelectorAll('[data-osai-resource-portal]')).toHaveLength(0);
  h.dom.window.close();
});

it('rejects collisions and independently rejects bad boundary/security snippets', () => {
  const release = releases.minimal!;
  const collision = structuredClone(release.manifest);
  collision.commands.Read = collision.commands.read!;
  expect(() =>
    generateOdcImplementation(collision, release.plan.resources, 'OSAI.Components.v1'),
  ).toThrow('colliding');
  const malformed = structuredClone(release.manifest);
  malformed.properties['not-native'] = malformed.properties.label!;
  expect(() =>
    generateOdcImplementation(malformed, release.plan.resources, 'OSAI.Components.v1'),
  ).toThrow('Unsupported');
  const unsupported = structuredClone(release.manifest);
  unsupported.properties.label!.schema.type = 'date';
  expect(() =>
    generateOdcImplementation(unsupported, release.plan.resources, 'OSAI.Components.v1'),
  ).toThrow('Unsupported native schema');
  for (const source of [
    'bridge.update("component","instance","{}");',
    'bridge.update("instance",{});',
    'state.actions.Forward_read({PayloadJson:"{}"});',
    'eval("unsafe");',
    'fetch("https://unexpected.invalid");',
  ]) {
    const implementation = structuredClone(release.plan.implementation);
    implementation.nodes[0]!.source = source;
    expect(() => validateNativeImplementation(implementation)).toThrow();
  }
});

it('assigns recreation output and recreates with subscriptions using a variant fixture', async () => {
  const h = await harness('recreate');
  h.ready('first', 'one', { label: 'Before' });
  h.load();
  const result = h.run('ApplyConfiguration', {
    InstanceId: 'first',
    ConfigJson: '{"label":"After"}',
  });
  expect(result.RequiresRecreation).toBe(true);
  expect(JSON.parse(result.EnvelopeJson as string).ok).toBe(true);
  expect(JSON.parse(h.api.invoke('first', 'read', '{}')).value).toBe('After');
  await h.tick();
  expect(h.events).toHaveLength(1);
  h.run('Dispose', { InstanceId: 'first' });
  h.dom.window.close();
}, 30000);

it('rejects missing native action dependencies even when comments name the missing action', () => {
  for (const id of ['palette', 'minimal']) {
    const implementation = structuredClone(releases[id]!.plan.implementation);
    const ready = implementation.nodes.find((node) => node.name === 'Ready')!;
    for (const flow of implementation.forwarders) {
      const changed = structuredClone(implementation);
      changed.nodes.find((node) => node.name === 'Ready')!.source = ready.source.replaceAll(
        `$actions.${flow.name}`,
        `undefined /* $actions.${flow.name} */`,
      );
      expect(() => validateNativeImplementation(changed)).toThrow(
        `Missing native action reference: ${flow.name}`,
      );
    }
    ready.source += '\nvar captured = $actions;';
    expect(() => validateNativeImplementation(implementation)).toThrow(
      'Native actions require explicit named references',
    );
  }
});

it('executes prearranged native Close and Toggle sequences after the opened event', async () => {
  for (const command of ['close', 'toggle']) {
    const h = await harness();
    const original = h.actions.Forward_opened!;
    h.actions.Forward_opened = (payload) => {
      original(payload);
      expect(
        JSON.parse(
          h.run(`Command_${command}`, { InstanceId: 'modal', ArgumentsJson: '{}' })
            .EnvelopeJson as string,
        ).ok,
      ).toBe(true);
    };
    h.ready('modal', 'one', { commands: [] });
    h.load();
    h.run('Command_open', { InstanceId: 'modal', ArgumentsJson: '{}' });
    await h.tick();
    expect(h.events.map((e) => e.name)).toEqual(['Forward_opened', 'Forward_closed']);
    expect(h.w.document.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).not.toBe(
      'false',
    );
    h.run('Dispose', { InstanceId: 'modal' });
    h.dom.window.close();
  }
});
it('binds guide and Mentor recipe references to every generated node', async () => {
  for (const release of Object.values(releases)) {
    const guide = await readFile(join(release.root, 'odc/integration.md'), 'utf8');
    const recipe = await readFile(join(release.root, 'odc/mentor-recipe.json'), 'utf8');
    for (const node of [
      ...release.plan.implementation.nodes,
      ...release.plan.implementation.forwarders,
    ]) {
      expect(guide).toContain(node.name);
      expect(recipe).toContain(node.name);
    }
    expect(guide).toContain('Local glue execution does not prove native wiring');
  }
});

it('never disposes another owner when creation encounters an existing bridge instance', async () => {
  const h = await harness('minimal');
  expect(
    JSON.parse(h.api.create('minimal', 'shared', 'two', '{"label":"Existing owner"}')).ok,
  ).toBe(true);
  h.ready('shared', 'one', { label: 'Rejected duplicate' });
  h.load();
  expect(JSON.parse(h.api.invoke('shared', 'read', '{}')).value).toBe('Existing owner');
  expect(h.w.document.querySelectorAll('link')).toHaveLength(0);
  h.api.dispose('shared');
  h.dom.window.close();
});
