import type { ComponentManifest, JsonObject, JsonValue } from '@osai/contract-schemas';
import type { ResourceMetadata } from '@osai/adapter-schema';
import type { Certification } from '../../packages/build-tools/src/certification.js';
import type { BridgeApi, Envelope } from '../../packages/runtime-bridge/src/index.js';
import type { ScenarioDriver, ComponentScenarios } from '@osai/component-sdk/certification';
import type { BrowserObservations } from './observations.js';
import { installSlowInput } from '../fixtures/negative/slow-input.js';
export interface PreviewMetadata {
  manifest: ComponentManifest;
  resources: ResourceMetadata;
  certification: Certification;
  artifactChecksums: Record<string, string>;
  policyHash: string;
  policyVersion: string;
  assetBase: string;
  target: string;
  status: string;
}
export interface Preview {
  api: BridgeApi;
  driver: ScenarioDriver;
  reset(): void;
  run(
    id: string,
    preserve?: boolean,
  ): Promise<{ assertions: number; commands: string[]; events: string[] }>;
  observations: BrowserObservations;
  measureSlowInput(): { rejected: boolean; measuredMs: number; thresholdMs: number };
}
declare global {
  interface Window {
    previewMetadata: PreviewMetadata;
    preview: Preview;
    componentScenarios: ComponentScenarios;
  }
}
const metadata = window.previewMetadata;
const api = window.OSAI.Components.v1;
const instances = new Set<string>();
let nextId = 0;
const observations = window.observations;
const send = (kind: string, result: unknown) =>
  window.parent !== window &&
  window.parent.postMessage(
    { source: 'osai-preview', componentId: metadata.manifest.componentId, kind, result },
    location.origin,
  );
const decode = (json: string): Envelope => JSON.parse(json) as Envelope;
function required(json: string): JsonValue | undefined {
  const result = decode(json);
  send('result', { code: result.code, ok: result.ok });
  if (!result.ok) throw new Error(result.code);
  return result.value;
}
const mappings = Object.fromEntries(
  metadata.resources.registration.assets.map((asset) => [
    asset.id,
    {
      url: asset.origin ? `${asset.origin}/${asset.id}` : metadata.assetBase + asset.id,
      integrity: asset.integrity,
    },
  ]),
);
required(
  api.registerResources(
    metadata.manifest.componentId,
    JSON.stringify({
      schemaVersion: '2.0',
      releaseId: metadata.resources.registration.releaseId,
      mappings,
    }),
  ),
);
let assertions = 0;
let commands: string[] = [];
let emitted: string[] = [];
function driver(id: string): ScenarioDriver {
  const host = document.createElement('div');
  host.id = `host-${id}`;
  document.getElementById('hosts')!.append(host);
  const events: { name: string; payload: JsonValue }[] = [];
  return {
    get root() {
      return host.querySelector<HTMLElement>('[data-osai-component]') ?? host;
    },
    create(config) {
      if (!host.isConnected) document.getElementById('hosts')!.append(host);
      required(api.create(metadata.manifest.componentId, id, host.id, JSON.stringify(config)));
      instances.add(id);
      for (const eventName of Object.keys(metadata.manifest.events))
        required(
          api.registerCallback(id, eventName, (json) => {
            const value = decode(json).value as JsonObject;
            events.push({ name: eventName, payload: value.payload! });
            emitted.push(eventName);
            send('event', { instanceId: id, eventName });
          }),
        );
    },
    update(config) {
      required(api.update(id, JSON.stringify(config)));
    },
    invoke(command, args) {
      commands.push(command);
      return required(api.invoke(id, command, JSON.stringify(args)))!;
    },
    dispose() {
      required(api.dispose(id));
      instances.delete(id);
    },
    events: () => events,
    resolveAsset(id) {
      const asset = mappings[id];
      if (!asset) throw new Error('Unregistered scenario asset.');
      return asset.url;
    },
    flush: () => observations.delay(30),
    assert(condition, message) {
      assertions++;
      if (!condition) throw new Error(message);
    },
    sibling(config) {
      const sibling = driver(`sibling-${++nextId}`);
      sibling.create(config);
      return sibling;
    },
  };
}
const main = driver('preview');
function reset() {
  for (const id of [...instances]) required(api.dispose(id));
  instances.clear();
  document.getElementById('hosts')!.replaceChildren();
}
window.preview = {
  api,
  driver: main,
  observations,
  reset,
  measureSlowInput() {
    const thresholdMs = metadata.certification.profile.benchmark.input.worstMs;
    const release = installSlowInput(main.root, thresholdMs + 10);
    try {
      const start = performance.now();
      main.root.dispatchEvent(new Event('negative-slow-input'));
      const measuredMs = performance.now() - start;
      return { rejected: measuredMs > thresholdMs, measuredMs, thresholdMs };
    } finally {
      release();
    }
  },
  async run(id, preserve = false) {
    const scenario = metadata.certification.descriptor.scenarios.find((item) => item.id === id);
    const implementation = window.componentScenarios[id];
    if (!scenario || !implementation) throw new Error('Unknown component scenario.');
    assertions = 0;
    commands = [];
    emitted = [];
    const current = driver(`scenario-${++nextId}`);
    current.create(metadata.certification.descriptor.validConfiguration);
    try {
      await implementation(current);
      await current.flush();
      if (assertions === 0) throw new Error('Scenario made no assertion.');
      if (scenario.kind === 'command' && !commands.includes(scenario.member))
        throw new Error('Command scenario did not invoke its member.');
      if (scenario.kind === 'event' && !emitted.includes(scenario.member))
        throw new Error('Event scenario did not observe its member.');
      return { assertions, commands, events: emitted };
    } finally {
      if (!preserve) reset();
    }
  },
};
// Instrumentation starts after harness ownership is installed and before component creation.
observations.untracked(() =>
  window.addEventListener('message', (event) => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      event.data?.source !== 'osai-workbench'
    )
      return;
    const { operation, config, command, args } = event.data as {
      operation: string;
      config: JsonObject;
      command: string;
      args: JsonValue;
    };
    try {
      if (operation === 'create') main.create(config);
      else if (operation === 'update') main.update(config);
      else if (operation === 'invoke') main.invoke(command, args);
      else if (operation === 'dispose') main.dispose();
      else if (operation === 'reset') reset();
      else throw new Error('Unknown operation.');
      send('operation', {
        operation,
        ok: true,
        ...(operation === 'reset'
          ? { cleanup: { info: decode(api.getInfo()).value, observed: observations.snapshot() } }
          : {}),
      });
    } catch (error) {
      send('operation', {
        operation,
        ok: false,
        code: error instanceof Error ? error.message : 'operation-failed',
      });
    }
  }),
);
document.documentElement.dataset.ready = 'true';
send('ready', { ok: true, code: 'loaded' });
