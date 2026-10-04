// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBridge } from '@osai/runtime-bridge';
import type { RuntimeBridge } from '@osai/runtime-bridge';
import {
  commandPaletteDefinition,
  filterCommands,
  normalizeQuery,
  validateConfiguration,
} from './src/index.js';
import type { CommandItem } from './src/index.js';
import type { JsonObject } from '@osai/component-sdk';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { normalizeConfig, validateJsonSchema } from '@osai/contract-schemas';
import { componentManifest } from './src/index.js';
import configSchema from './schemas/config.schema.json';

const commands: CommandItem[] = [
  {
    id: 'create',
    label: 'Create project',
    keywords: ['new', 'add'],
    description: 'Start a new workspace',
    group: 'Projects',
  },
  { id: 'locked', label: 'Create invoice', disabled: true },
  { id: 'search', label: 'Search projects', keywords: ['find'] },
  { id: 'profile', label: 'Open profile' },
];

interface Result {
  ok: boolean;
  code: string;
  path?: string;
  value?: Record<string, unknown>;
}
const result = (json: string): Result => JSON.parse(json) as Result;
let runtime: RuntimeBridge;
const instances: string[] = [];
let deliveries: Array<{ eventName: string; payload: JsonObject }>;

function mount(id = 'palette', extra: JsonObject = {}): HTMLElement {
  const host = document.createElement('div');
  host.id = `host-${id}`;
  document.body.append(host);
  const outcome = result(
    runtime.api.create('command-palette', id, host.id, JSON.stringify({ commands, ...extra })),
  );
  expect(outcome).toMatchObject({ ok: true, code: 'created' });
  instances.push(id);
  for (const name of ['opened', 'closed', 'queryChanged', 'commandSelected', 'error']) {
    expect(
      result(
        runtime.api.registerCallback(id, name, (json) => {
          const envelope = result(json);
          deliveries.push(envelope.value as unknown as { eventName: string; payload: JsonObject });
        }),
      ).ok,
    ).toBe(true);
  }
  return host;
}

function invoke(command: string, id = 'palette'): Result {
  return result(runtime.api.invoke(id, command, '{}'));
}

function input(host: ParentNode = document): HTMLInputElement {
  return host.querySelector<HTMLInputElement>('[role="combobox"]')!;
}

function type(query: string, host: ParentNode = document): void {
  input(host).value = query;
  input(host).dispatchEvent(new Event('input', { bubbles: true }));
}

function key(
  name: string,
  target: EventTarget = input(),
  extra: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: name,
    bubbles: true,
    cancelable: true,
    ...extra,
  });
  target.dispatchEvent(event);
  return event;
}

function active(host: ParentNode = document): string | null {
  const optionId = input(host).getAttribute('aria-activedescendant');
  return optionId
    ? (document.getElementById(optionId)?.getAttribute('data-command-id') ?? null)
    : null;
}

function selected(): Array<{ eventName: string; payload: JsonObject }> {
  return deliveries.filter((event) => event.eventName === 'commandSelected');
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
  deliveries = [];
  runtime = createBridge({ document });
  expect(result(runtime.registerComponent(commandPaletteDefinition))).toMatchObject({ ok: true });
});

afterEach(() => {
  for (const id of instances.splice(0)) runtime.api.dispose(id);
  vi.runAllTimers();
  expect(runtime.inspect().instances).toBe(0);
  expect(Object.values(runtime.inspect().resources).every((count) => count === 0)).toBe(true);
  vi.useRealTimers();
});

describe('deterministic search and validation', () => {
  it('normalizes NFKC, casing and whitespace, includes disabled matches and preserves host order', () => {
    const items = [
      { id: 'wide', label: 'Ｆｉｌｅ' },
      { id: 'keyword', label: 'Other', keywords: ['File archive'], disabled: true },
      { id: 'accent', label: 'Café' },
    ];
    expect(normalizeQuery('  ＦＩＬＥ  ')).toBe('file');
    expect(filterCommands(items, ' fiLE ').map((item) => item.id)).toEqual(['wide', 'keyword']);
    expect(filterCommands(items, 'Cafe\u0301').map((item) => item.id)).toEqual(['accent']);
    expect(filterCommands(items, ' \t ')).toEqual(items);
    expect(filterCommands(items, 'missing')).toEqual([]);
    expect(filterCommands(commands, 'find').map((item) => item.id)).toEqual(['search']);
  });

  it('rejects duplicates, unknown properties and malformed shortcut modifiers with exact paths', () => {
    expect(
      validateConfiguration({
        commands: [
          { id: 'same', label: 'One' },
          { id: 'same', label: 'Two' },
        ],
      }),
    ).toEqual([
      {
        code: 'invalid-config',
        path: '/commands/1/id',
        message: 'Command identifiers must be unique.',
      },
    ]);
    expect(validateConfiguration({ commands: [], shortcut: 'Mod+Ctrl+K' })[0]?.path).toBe(
      '/shortcut',
    );
    expect(validateConfiguration({ commands: [], unexpected: 'no' })[0]?.path).toBe('/unexpected');
  });
});

describe('surface and commands', () => {
  it('restores the remembered trigger when WebKit blurs it before a click handler opens the palette', () => {
    const host = mount();
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();
    trigger.blur();
    expect(document.activeElement).toBe(document.body);
    invoke('open');
    expect(document.activeElement).toBe(input(host));
    invoke('close');
    expect(document.activeElement).toBe(trigger);
  });

  it('opens and closes idempotently, resets the query and restores focus', () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const host = mount();
    expect(invoke('open').value).toEqual({ isOpen: true });
    type('create', host);
    invoke('open');
    expect(input(host).value).toBe('create');
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.activeElement).toBe(input(host));
    invoke('close');
    invoke('close');
    expect(document.activeElement).toBe(button);
    invoke('toggle');
    expect(input(host).value).toBe('');
    invoke('toggle');
    vi.runAllTimers();
    expect(deliveries.map((event) => event.eventName)).toEqual([
      'opened',
      'queryChanged',
      'closed',
      'opened',
      'closed',
    ]);
  });

  it.each([-1, 0])(
    'falls back to a host with tabindex %s or document body when prior focus is removed',
    (tabIndex) => {
      const button = document.createElement('button');
      document.body.append(button);
      const host = mount();
      host.tabIndex = tabIndex;
      button.focus();
      invoke('open');
      button.remove();
      invoke('close');
      expect(document.activeElement).toBe(host);
      invoke('open');
      host.remove();
      invoke('close');
      expect(document.activeElement).toBe(document.body);
      expect(document.body.hasAttribute('tabindex')).toBe(false);
    },
  );

  it('renders every host string as text without creating elements or attributes', () => {
    const text = '<img src=x onerror=alert(1)><script>bad()</script>';
    const host = mount('palette', {
      commands: [
        {
          id: '" onclick=bad()',
          label: text,
          description: text,
          keywords: [text],
          group: text,
          metadata: { hint: text },
        },
      ],
      title: text,
      placeholder: text,
      emptyMessage: text,
    });
    invoke('open');
    expect(host.querySelector('img,script,[onclick],[onerror]')).toBeNull();
    expect(host.querySelector('[role="option"]')?.textContent).toContain(text);
    expect(input(host).placeholder).toBe(text);
    type('missing', host);
    expect(host.querySelector('.osai-command-palette-empty')?.textContent).toBe(text);
  });
});

describe('keyboard, composition and selection', () => {
  it('wraps through enabled options, supports Home/End, scrolls and Escape', () => {
    mount();
    const scrolled = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrolled;
    try {
      invoke('open');
      expect(active()).toBe('create');
      key('ArrowUp');
      expect(active()).toBe('profile');
      key('ArrowDown');
      expect(active()).toBe('create');
      key('ArrowDown');
      expect(active()).toBe('search');
      key('End');
      expect(active()).toBe('profile');
      key('Home');
      expect(active()).toBe('create');
      expect(scrolled).toHaveBeenCalledTimes(5);
      key('Escape');
      expect(input().getAttribute('aria-expanded')).toBe('false');
      vi.runAllTimers();
      expect(deliveries.at(-1)?.payload.reason).toBe('escape');
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('emits one selection from rapid Enter or pointer activation and delegates behavior to the host', () => {
    const host = mount();
    invoke('open');
    key('Enter');
    key('Enter');
    vi.runAllTimers();
    expect(selected()).toHaveLength(1);
    expect(selected()[0]?.payload).toEqual({
      instanceId: 'palette',
      commandId: 'create',
      query: '',
      source: 'keyboard',
    });
    expect(deliveries.at(-1)?.payload.reason).toBe('selection');
    invoke('open');
    host.querySelector<HTMLElement>('[data-command-id="locked"]')!.click();
    vi.runAllTimers();
    expect(selected()).toHaveLength(1);
    const option = host.querySelector<HTMLElement>('[data-command-id="search"]')!;
    option.click();
    option.click();
    vi.runAllTimers();
    expect(selected()).toHaveLength(2);
    expect(selected()[1]?.payload.source).toBe('pointer');
  });

  it('does not commit a query or activate a command during IME composition', () => {
    mount();
    invoke('open');
    input().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    type('search');
    key('Enter');
    vi.runAllTimers();
    expect(selected()).toHaveLength(0);
    expect(deliveries.filter((event) => event.eventName === 'queryChanged')).toHaveLength(0);
    input().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    // The browser may also send input after compositionend; this is one commit.
    input().dispatchEvent(new Event('input', { bubbles: true }));
    key('Enter', input(), { isComposing: true });
    vi.runAllTimers();
    expect(deliveries.filter((event) => event.eventName === 'queryChanged')).toHaveLength(1);
    expect(selected()).toHaveLength(0);
    key('Enter');
    vi.runAllTimers();
    expect(selected()[0]?.payload.commandId).toBe('search');
  });

  it('handles no enabled results safely and can stay open after selection when configured', () => {
    mount('palette', { commands: [{ id: 'disabled', label: 'Disabled', disabled: true }] });
    invoke('open');
    for (const name of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) key(name);
    expect(active()).toBeNull();
    type('none');
    key('Enter');
    expect(input().getAttribute('aria-activedescendant')).toBeNull();
    expect(
      result(runtime.api.update('palette', JSON.stringify({ commands, closeOnSelect: false }))).ok,
    ).toBe(true);
    type('');
    key('Enter');
    vi.runAllTimers();
    expect(selected()).toHaveLength(1);
    expect(input().getAttribute('aria-expanded')).toBe('true');
  });
});

describe('live updates', () => {
  it('keeps the query and eligible active ID, restores defaults and never remounts', () => {
    const host = mount('palette', { title: 'Custom palette' });
    invoke('open');
    type('project');
    key('ArrowDown');
    expect(active()).toBe('search');
    const originalInput = input(host);
    const listenerCount = runtime.inspect().resources.listeners;
    expect(
      result(
        runtime.api.update(
          'palette',
          JSON.stringify({ commands: [{ id: 'first', label: 'First project' }, ...commands] }),
        ),
      ).ok,
    ).toBe(true);
    expect(input(host)).toBe(originalInput);
    expect(input(host).value).toBe('project');
    expect(active()).toBe('search');
    expect(host.querySelector('h2')?.textContent).toBe('Command palette');
    expect(runtime.inspect().resources.listeners).toBe(listenerCount);
    runtime.api.update(
      'palette',
      JSON.stringify({ commands: [{ id: 'first', label: 'First project' }] }),
    );
    expect(active()).toBe('first');
    runtime.api.update('palette', JSON.stringify({ commands: [] }));
    expect(active()).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('0 commands');
  });

  it('rejects invalid replacements atomically, including semantic duplicate identifiers', () => {
    const host = mount();
    invoke('open');
    type('create');
    const before = host.innerHTML;
    for (const config of [
      { commands: [{ id: 'missing' }] },
      {
        commands: [
          { id: 'same', label: 'One' },
          { id: 'same', label: 'Two' },
        ],
        title: 'Changed',
      },
      { commands: [], title: null },
      {},
    ]) {
      expect(result(runtime.api.update('palette', JSON.stringify(config))).ok).toBe(false);
      expect(host.innerHTML).toBe(before);
    }
  });
});

describe('accessible modal and cleanup', () => {
  it('exposes relationships and states, traps forward and reverse focus, and locks background interaction', () => {
    const background = document.createElement('button');
    document.body.append(background);
    const host = mount();
    invoke('open');
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Command palette',
    );
    expect(input().getAttribute('aria-controls')).toBe(host.querySelector('[role="listbox"]')?.id);
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-command-id="locked"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(host.querySelector('[data-command-id="create"]')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(background.hasAttribute('inert')).toBe(true);
    key('Tab');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close command palette');
    key('Tab', document.activeElement!, { shiftKey: true });
    expect(document.activeElement).toBe(input());
    key('Tab', input(), { shiftKey: true });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close command palette');
    key('Tab', document.activeElement!);
    expect(document.activeElement).toBe(input());
    invoke('close');
    expect(background.hasAttribute('inert')).toBe(false);
    expect(background.hasAttribute('aria-hidden')).toBe(false);
  });

  it('disposes open or removed hosts, cancels pending events and leaves zero resources', () => {
    const host = mount('palette', { shortcut: 'Ctrl+K' });
    invoke('open');
    type('project');
    host.remove();
    runtime.api.dispose('palette');
    runtime.api.dispose('palette');
    vi.runAllTimers();
    expect(deliveries).toEqual([]);
    expect(document.querySelector('[data-osai-component]')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
    expect(runtime.inspect().pendingEvents).toBe(0);
    expect(runtime.inspect().subscriptions).toBe(0);
    expect(Object.values(runtime.inspect().resources).every((count) => count === 0)).toBe(true);
  });

  it('gives a second modal exclusive focus ownership and restores the first on close', () => {
    const first = mount('one');
    const second = mount('two');
    invoke('open', 'one');
    invoke('open', 'two');
    expect(first.querySelector('[data-osai-component]')?.closest('[inert]')).not.toBeNull();
    expect(document.activeElement).toBe(input(second));
    invoke('close', 'two');
    expect(first.querySelector('[data-osai-component]')?.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(input(first));
    expect(runtime.inspect().resources.backgroundLocks).toBe(1);
  });
});

describe('shortcut ownership', () => {
  it('is opt-in, ignores editable surfaces, normalizes modifiers and transfers among ordered contenders', () => {
    const first = mount('one', { shortcut: 'Ctrl+Shift+K' });
    const second = mount('two', { shortcut: 'SHIFT+control+k' });
    const third = mount('three', { shortcut: 'shift+ctrl+k' });
    expect(
      runtime.inspect().diagnostics.filter((item) => item.code === 'shortcut-conflict'),
    ).toHaveLength(2);
    const editing = document.createElement('input');
    document.body.append(editing);
    key('k', editing, { ctrlKey: true, shiftKey: true });
    expect(input(first).getAttribute('aria-expanded')).toBe('false');
    expect(key('k', document.body, { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(input(first).getAttribute('aria-expanded')).toBe('true');
    expect(input(second).getAttribute('aria-expanded')).toBe('false');
    invoke('close', 'one');
    runtime.api.update('one', JSON.stringify({ commands, shortcut: 'Alt+P' }));
    key('K', document.body, { ctrlKey: true, shiftKey: true });
    expect(input(second).getAttribute('aria-expanded')).toBe('true');
    expect(input(third).getAttribute('aria-expanded')).toBe('false');
    runtime.api.dispose('two');
    key('k', document.body, { ctrlKey: true, shiftKey: true });
    expect(input(third).getAttribute('aria-expanded')).toBe('true');
    key('k', input(third), { ctrlKey: true, shiftKey: true });
    expect(input(third).getAttribute('aria-expanded')).toBe('false');
  });

  it('does not register a global shortcut unless configured', () => {
    const host = mount();
    key('k', document.body, { ctrlKey: true });
    expect(input(host).getAttribute('aria-expanded')).toBe('false');
    expect(runtime.inspect().resources.shortcutClaims).toBe(0);
  });

  it('keeps ownership across unrelated updates, ignores all editable surfaces, and reports live collisions', () => {
    const first = mount('one', { shortcut: 'Ctrl+K' });
    mount('two');
    runtime.api.update('two', JSON.stringify({ commands, shortcut: 'control+k' }));
    runtime.api.update(
      'one',
      JSON.stringify({ commands, shortcut: 'control+k', title: 'Updated title' }),
    );
    vi.runAllTimers();
    expect(deliveries.filter((event) => event.eventName === 'error')[0]?.payload.code).toBe(
      'shortcut-conflict',
    );
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      const control = document.createElement(tag);
      if (tag === 'div') control.setAttribute('contenteditable', 'true');
      document.body.append(control);
      const pressed = key('k', control, { ctrlKey: true });
      expect(pressed.defaultPrevented).toBe(false);
      expect(input(first).getAttribute('aria-expanded')).toBe('false');
    }
    key('k', document.body, { ctrlKey: true });
    expect(input(first).getAttribute('aria-expanded')).toBe('true');
  });
});

describe('published contract examples', () => {
  it('validates every JSON guide example and executes the host-owned action example', () => {
    const guide = readFileSync(resolve(process.cwd(), 'docs/command-palette.md'), 'utf8');
    const examples = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)];
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const value: unknown = JSON.parse(example[1]!);
      expect(validateJsonSchema(configSchema, value)).toEqual([]);
      expect(normalizeConfig(componentManifest, value).ok).toBe(true);
    }
    const host = document.createElement('div');
    host.id = 'PaletteHost';
    document.body.append(host);
    const script = /```js\n([\s\S]*?)\n```/.exec(guide)?.[1];
    expect(script).toBeTruthy();
    const hostAction = vi.fn();
    runInNewContext(script!, {
      window: { OSAI: { Components: { v1: runtime.api } } },
      $actions: { OnCommandSelected: hostAction },
    });
    expect(runtime.inspect().instances).toBe(0);
    expect(hostAction).not.toHaveBeenCalled();
  });
});
