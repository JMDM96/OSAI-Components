import type { JsonObject, JsonSchema } from '@osai/contract-schemas';
import type { PreviewMetadata } from './preview.js';
interface CatalogItem {
  componentId: string;
  version: string;
  targets: string[];
  fixture: boolean;
}
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const select = element<HTMLSelectElement>('component');
const target = element<HTMLSelectElement>('target');
const version = element<HTMLInputElement>('version');
const configuration = element<HTMLTextAreaElement>('configuration');
const args = element<HTMLTextAreaElement>('arguments');
const command = element<HTMLSelectElement>('command');
let frame: HTMLIFrameElement | undefined;
let metadata: PreviewMetadata | undefined;
let generation = 0;
let sequence = 0;
let dropped = 0;
const activity: {
  sequence: number;
  componentId: string;
  instanceId: string;
  kind: string;
  code: string;
  ok?: boolean;
  redacted: true;
}[] = [];
const capacity = 100;
function record(kind: string, result: Record<string, unknown> = {}) {
  const code =
    typeof result.code === 'string' && /^[a-z][a-z0-9-]{0,60}$/.test(result.code)
      ? result.code
      : typeof result.eventName === 'string' && metadata?.manifest.events[result.eventName]
        ? `event:${result.eventName}`
        : 'redacted';
  activity.push({
    sequence: ++sequence,
    componentId: metadata?.manifest.componentId ?? select.value,
    instanceId:
      typeof result.instanceId === 'string' && /^[\w-]{1,50}$/.test(result.instanceId)
        ? result.instanceId
        : 'preview',
    kind,
    code,
    ...(typeof result.ok === 'boolean' ? { ok: result.ok } : {}),
    redacted: true,
  });
  if (activity.length > capacity) {
    activity.shift();
    dropped++;
  }
  renderActivity();
}
function renderActivity() {
  const list = element('activity-list');
  list.replaceChildren();
  for (const item of activity) {
    const row = document.createElement('li');
    row.textContent = `${item.sequence} · ${item.componentId} / ${item.instanceId} · ${item.kind} · ${item.code}${item.ok === undefined ? '' : item.ok ? ' · OK' : ' · Failed'}`;
    list.append(row);
  }
  element('truncation').textContent = dropped
    ? `${dropped} earlier entries removed. Showing the latest ${capacity}.`
    : 'No earlier entries removed.';
}
function navigation() {
  const view = ['workspace', 'library', 'activity'].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : 'workspace';
  for (const id of ['workspace', 'library', 'activity']) element(id).hidden = id !== view;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('nav a')) {
    if (link.hash === `#${view}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange', navigation);
navigation();
function fields(
  container: HTMLElement,
  schemas: Record<string, JsonSchema>,
  data: JsonObject,
  text: HTMLTextAreaElement,
) {
  container.replaceChildren();
  for (const [name, schema] of Object.entries(schemas)) {
    const label = document.createElement('label');
    label.textContent = name;
    const primitive = ['string', 'number', 'integer', 'boolean'].includes(String(schema.type));
    const input = primitive ? document.createElement('input') : document.createElement('textarea');
    if (input instanceof HTMLInputElement)
      input.type =
        schema.type === 'boolean'
          ? 'checkbox'
          : schema.type === 'number' || schema.type === 'integer'
            ? 'number'
            : 'text';
    if (input instanceof HTMLInputElement && input.type === 'checkbox')
      input.checked = data[name] === true;
    else
      input.value =
        typeof data[name] === 'string'
          ? data[name]
          : data[name] === undefined
            ? ''
            : JSON.stringify(data[name]);
    input.addEventListener('change', () => {
      try {
        const next = JSON.parse(text.value) as JsonObject;
        next[name] =
          input instanceof HTMLInputElement && input.type === 'checkbox'
            ? input.checked
            : primitive && schema.type === 'string'
              ? input.value
              : JSON.parse(input.value);
        text.value = JSON.stringify(next, null, 2);
      } catch {
        element('message').textContent =
          'Field input is not valid JSON. The preview was preserved.';
      }
    });
    label.append(input);
    container.append(label);
  }
}
function commandFields() {
  if (!metadata) return;
  const schema = metadata.manifest.commands[command.value]?.arguments;
  args.value = '{}';
  fields(element('argument-fields'), schema?.properties ?? {}, {}, args);
}
let disposing: Promise<void> | undefined;
async function disposePrior() {
  if (disposing) return disposing;
  if (!frame) return;
  const previous = frame;
  frame = undefined;
  disposing = new Promise<void>((resolve) => {
    const finish = (ok: boolean) => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', acknowledge);
      record('dispose', { ok, code: ok ? 'disposed' : 'dispose-failed' });
      previous.remove();
      resolve();
    };
    const acknowledge = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === previous.contentWindow &&
        event.data?.source === 'osai-preview' &&
        event.data.kind === 'operation' &&
        event.data.result?.operation === 'reset'
      )
        finish(event.data.result.ok === true);
    };
    const timeout = window.setTimeout(() => finish(false), 2000);
    window.addEventListener('message', acknowledge);
    // Cleanup executes in the preview realm before its document is detached.
    previous.contentWindow?.postMessage(
      { source: 'osai-workbench', operation: 'reset' },
      location.origin,
    );
  });
  await disposing;
  disposing = undefined;
}
async function load() {
  const current = ++generation;
  await disposePrior();
  if (current !== generation) return;
  metadata = undefined;
  element('readiness').textContent = 'Loading';
  const query = new URLSearchParams({
    component: select.value,
    version: version.value,
    target: target.value,
  });
  history.replaceState(null, '', `/?${query}${location.hash || '#workspace'}`);
  try {
    const response = await fetch(`/metadata?${query}`);
    if (!response.ok) throw new Error('build-required');
    const result = (await response.json()) as PreviewMetadata;
    if (current !== generation) return;
    metadata = result;
    element('readiness').textContent =
      result.status === 'browser-verified'
        ? 'Browser verified'
        : result.status === 'OutSystems-verified'
          ? 'OutSystems verified'
          : result.status === 'stale'
            ? 'Stale evidence'
            : result.status === 'generated'
              ? 'Generated · unverified'
              : 'Missing evidence';
    configuration.value = JSON.stringify(
      result.certification.descriptor.validConfiguration,
      null,
      2,
    );
    fields(
      element('fields'),
      Object.fromEntries(
        Object.entries(result.manifest.properties)
          .filter(([, property]) => property.access !== 'read')
          .map(([name, property]) => [name, property.schema]),
      ),
      result.certification.descriptor.validConfiguration,
      configuration,
    );
    command.replaceChildren();
    for (const name of Object.keys(result.manifest.commands)) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      command.append(option);
    }
    if (result.manifest.commands.open) command.value = 'open';
    commandFields();
    frame = document.createElement('iframe');
    frame.title = `${result.manifest.componentId} ${result.manifest.version} ${result.target}`;
    frame.src = `/preview?${query}`;
    frame.addEventListener('load', () => {
      if (current !== generation) return;
      if (frame?.contentDocument?.documentElement.dataset.ready !== 'true') {
        element('message').textContent =
          'Preview initialization failed. Reload the package after checking its resources.';
        record('load', { ok: false, code: 'initialization-failed' });
      }
    });
    element('frame-container').append(frame);
  } catch {
    if (current === generation) {
      element('message').textContent = 'Build required: the selected package is missing or stale.';
      element('readiness').textContent = 'Unavailable';
      record('load', { ok: false, code: 'build-required' });
    }
  }
}
for (const operation of ['create', 'update', 'dispose', 'invoke'])
  element(operation).addEventListener('click', () => {
    if (!frame || !metadata) return;
    try {
      const config =
        operation === 'create' || operation === 'update'
          ? JSON.parse(configuration.value)
          : undefined;
      const argumentsValue = operation === 'invoke' ? JSON.parse(args.value) : undefined;
      frame.contentWindow!.postMessage(
        {
          source: 'osai-workbench',
          operation,
          config,
          command: command.value,
          args: argumentsValue,
        },
        location.origin,
      );
    } catch {
      element('message').textContent = 'Invalid JSON. The last valid preview state was preserved.';
      record(operation, { ok: false, code: 'invalid-json' });
    }
  });
window.addEventListener('message', (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== frame?.contentWindow ||
    event.data?.source !== 'osai-preview'
  )
    return;
  const data = event.data as { kind: string; result: Record<string, unknown> };
  if (data.kind === 'ready') {
    element('message').textContent = metadata?.manifest.commands.open
      ? 'Package loaded. Click Create, then Invoke the open command to show the component.'
      : 'Package loaded. Create an instance to begin.';
    record('load', { ok: true, code: 'loaded' });
    return;
  }
  if (!['result', 'event', 'operation'].includes(data.kind)) return;
  record(data.kind, data.result);
  if (data.kind === 'operation') {
    let message = 'Operation completed.';
    if (data.result.operation === 'create')
      message = metadata?.manifest.commands.open
        ? 'Instance created. Select open and click Invoke to show the component.'
        : 'Instance created. Use the configuration and commands to interact with it.';
    else if (data.result.operation === 'dispose')
      message = 'Instance disposed. Click Create to preview it again.';
    element('message').textContent = data.result.ok
      ? message
      : `Operation rejected: ${activity.at(-1)!.code}. Preview preserved where recovery succeeded.`;
  }
});
element('load').addEventListener('click', () => void load());
command.addEventListener('change', commandFields);
element('reset').addEventListener('click', async () => {
  await disposePrior();
  activity.length = 0;
  sequence = 0;
  dropped = 0;
  renderActivity();
  void load();
});
element('export').addEventListener('click', () => {
  const blob = new Blob(
    [JSON.stringify({ schemaVersion: '1.0', redacted: true, dropped, activity }, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'osai-diagnostics.json';
  link.click();
  URL.revokeObjectURL(url);
});
void (async () => {
  const catalog = (await (await fetch('/catalog')).json()) as CatalogItem[];
  const query = new URLSearchParams(location.search);
  for (const item of catalog) {
    const option = document.createElement('option');
    option.value = item.componentId;
    option.textContent = item.componentId + (item.fixture ? ' (fixture)' : '');
    select.append(option);
    const card = document.createElement('article');
    const heading = document.createElement('h2');
    heading.textContent = item.componentId;
    const detail = document.createElement('p');
    detail.textContent = `${item.version} · ${item.fixture ? 'Test fixture' : 'Production component'}`;
    const button = document.createElement('button');
    button.textContent = 'Preview';
    button.addEventListener('click', () => {
      select.value = item.componentId;
      version.value = item.version;
      location.hash = 'workspace';
      void load();
    });
    card.append(heading, detail, button);
    element('catalog').append(card);
  }
  select.value = query.get('component') ?? catalog[0]?.componentId ?? '';
  version.value =
    query.get('version') ??
    catalog.find((item) => item.componentId === select.value)?.version ??
    '';
  target.value = query.get('target') ?? 'odc';
  select.addEventListener('change', () => {
    version.value = catalog.find((item) => item.componentId === select.value)?.version ?? '';
  });
  await load();
  document.documentElement.dataset.workbenchReady = 'true';
})();
