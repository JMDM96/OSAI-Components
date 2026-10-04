import type {
  BridgeApi,
  Envelope,
  RuntimeSnapshot,
} from '../../packages/runtime-bridge/src/index.js';
import type { JsonObject, JsonValue } from '@osai/contract-schemas';

export const sampleCommands: JsonObject[] = [
  {
    id: 'new-project',
    label: 'Create a new project',
    description: 'Start something from a blank canvas',
    keywords: ['new', 'create'],
    group: 'Workspace',
    metadata: { hint: 'N' },
  },
  {
    id: 'find-project',
    label: 'Find a project',
    description: 'Pick up where you left off',
    keywords: ['search', 'workspace'],
    group: 'Workspace',
  },
  {
    id: 'team',
    label: 'Invite a teammate',
    description: 'Better work starts together',
    keywords: ['people', 'member'],
    group: 'People',
  },
  {
    id: 'billing',
    label: 'Manage billing',
    description: 'Available to workspace administrators',
    disabled: true,
    group: 'Settings',
  },
  {
    id: 'settings',
    label: 'Workspace settings',
    keywords: ['preferences', 'configuration'],
    group: 'Settings',
  },
];
export interface Harness {
  api: BridgeApi;
  config: JsonObject;
  events: Envelope[];
  results: Envelope[];
  violations: string[];
  ready(id?: string, config?: JsonObject): Envelope;
  render(id: string, config: JsonObject): Envelope;
  destroy(id?: string, removeHost?: boolean): Envelope;
  command(id: string, command: string): Envelope;
  reset(): void;
  info(): RuntimeSnapshot;
}
declare global {
  interface Window {
    OSAI: { Components: { v1: BridgeApi } };
    harness: Harness;
  }
}
const api = window.OSAI.Components.v1;
const events: Envelope[] = [];
const results: Envelope[] = [];
const violations: string[] = [];
const live = new Map<string, string>();
const config: JsonObject = { commands: sampleCommands, shortcut: 'Control+K' };
const parse = (json: string): Envelope => {
  const result = JSON.parse(json) as Envelope;
  results.push(result);
  return result;
};
document.addEventListener('securitypolicyviolation', (event) => {
  violations.push(event.violatedDirective);
});
function ready(id = 'demo', next = config): Envelope {
  let host = document.getElementById(`host-${id}`);
  if (!host) {
    host = document.createElement('div');
    host.id = `host-${id}`;
    host.tabIndex = -1;
    document.getElementById('harness-hosts')?.append(host);
  }
  const result = parse(api.create('command-palette', id, host.id, JSON.stringify(next)));
  if (result.ok) {
    live.set(id, JSON.stringify(next));
    for (const eventName of ['opened', 'closed', 'queryChanged', 'commandSelected', 'error'])
      parse(
        api.registerCallback(id, eventName, (eventJson) => {
          const event = JSON.parse(eventJson) as Envelope;
          events.push(event);
          const eventValue = event.value as JsonObject;
          const status = document.getElementById('host-status');
          if (eventValue.eventName === 'commandSelected' && status)
            status.textContent = `Host received command: ${String((eventValue.payload as JsonObject).commandId)}`;
        }),
      );
  }
  return result;
}
const harness: Harness = {
  api,
  config,
  events,
  results,
  violations,
  ready,
  render(id, next) {
    const serialized = JSON.stringify(next);
    if (!live.has(id)) return ready(id, next);
    if (live.get(id) === serialized)
      return {
        contractVersion: '1.0',
        ok: true,
        code: 'unchanged',
        message: 'Render already applied.',
      };
    const result = parse(api.update(id, serialized));
    if (result.ok) live.set(id, serialized);
    return result;
  },
  destroy(id = 'demo', removeHost = false) {
    if (removeHost) document.getElementById(`host-${id}`)?.remove();
    live.delete(id);
    return parse(api.dispose(id));
  },
  command(id, command) {
    return parse(api.invoke(id, command, '{}'));
  },
  reset() {
    for (const id of [...live.keys()]) harness.destroy(id, true);
    events.length = 0;
    results.length = 0;
  },
  info() {
    return JSON.parse(api.getInfo()).value as RuntimeSnapshot;
  },
};
window.harness = harness;
document
  .getElementById('open-palette')
  ?.addEventListener('click', () => harness.command('demo', 'open'));
document.getElementById('destroy-palette')?.addEventListener('click', () => harness.destroy());
document.getElementById('recreate-palette')?.addEventListener('click', () => ready());
document.getElementById('update-palette')?.addEventListener('click', () =>
  harness.render('demo', {
    ...config,
    commands: [...sampleCommands, { id: 'recent', label: 'Open recent activity' }],
  }),
);
ready();
document.documentElement.dataset.ready = 'true';
export type { JsonValue };
