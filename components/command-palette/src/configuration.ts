import type { Diagnostic, JsonObject } from '@osai/component-sdk';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  group?: string;
  disabled?: boolean;
  metadata?: { hint?: string };
}

export interface PaletteConfiguration {
  commands: CommandItem[];
  title: string;
  placeholder: string;
  emptyMessage: string;
  shortcut: string;
  closeOnSelect: boolean;
}

export const configurationDefaults = {
  title: 'Command palette',
  placeholder: 'Search commands…',
  emptyMessage: 'No commands found.',
  shortcut: '',
  closeOnSelect: true,
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Cross-field rules supplement JSON Schema before the bridge changes any state. */
export function validateConfiguration(value: JsonObject): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const add = (path: string, message: string) => {
    diagnostics.push({ code: 'invalid-config', path, message });
  };
  const allowed = ['commands', 'title', 'placeholder', 'emptyMessage', 'shortcut', 'closeOnSelect'];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) add(`/${key}`, 'Unknown configuration property.');
  }
  if (!Array.isArray(value.commands)) {
    add('/commands', 'Commands must be an array.');
  } else {
    const identifiers = new Set<string>();
    value.commands.forEach((item, index) => {
      const path = `/commands/${index}`;
      if (!record(item)) {
        add(path, 'A command must be an object.');
        return;
      }
      for (const key of Object.keys(item)) {
        if (
          !['id', 'label', 'description', 'keywords', 'group', 'disabled', 'metadata'].includes(key)
        ) {
          add(`${path}/${key}`, 'Unknown command property.');
        }
      }
      if (typeof item.id !== 'string' || !item.id.length)
        add(`${path}/id`, 'A command requires a nonempty identifier.');
      else if (identifiers.has(item.id)) add(`${path}/id`, 'Command identifiers must be unique.');
      else identifiers.add(item.id);
      if (typeof item.label !== 'string' || !item.label.length)
        add(`${path}/label`, 'A command requires a nonempty label.');
      for (const key of ['description', 'group']) {
        if (item[key] !== undefined && typeof item[key] !== 'string')
          add(`${path}/${key}`, 'Expected text.');
      }
      if (item.disabled !== undefined && typeof item.disabled !== 'boolean')
        add(`${path}/disabled`, 'Expected a boolean.');
      if (
        item.keywords !== undefined &&
        (!Array.isArray(item.keywords) || item.keywords.some((word) => typeof word !== 'string'))
      ) {
        add(`${path}/keywords`, 'Keywords must be an array of text values.');
      }
      if (
        item.metadata !== undefined &&
        (!record(item.metadata) ||
          Object.keys(item.metadata).some((key) => key !== 'hint') ||
          (item.metadata.hint !== undefined && typeof item.metadata.hint !== 'string'))
      ) {
        add(`${path}/metadata`, 'Presentation metadata supports only a text hint.');
      }
    });
  }
  for (const key of ['title', 'placeholder', 'emptyMessage', 'shortcut']) {
    if (value[key] !== undefined && typeof value[key] !== 'string')
      add(`/${key}`, 'Expected text.');
  }
  if (value.title === '') add('/title', 'The dialog must have a nonempty accessible name.');
  if (value.closeOnSelect !== undefined && typeof value.closeOnSelect !== 'boolean')
    add('/closeOnSelect', 'Expected a boolean.');
  if (typeof value.shortcut === 'string' && value.shortcut) {
    const parts = value.shortcut.toLowerCase().split('+');
    const key = parts.pop();
    const modifiers = parts.map((part) => (part === 'control' ? 'ctrl' : part));
    if (
      !key ||
      !/^[a-z0-9]$/.test(key) ||
      !modifiers.length ||
      modifiers.some((part) => !['mod', 'ctrl', 'meta', 'alt', 'shift'].includes(part)) ||
      new Set(modifiers).size !== modifiers.length ||
      (modifiers.includes('mod') && (modifiers.includes('ctrl') || modifiers.includes('meta')))
    ) {
      add(
        '/shortcut',
        'Use distinct modifiers and one letter or digit, such as Mod+K or Alt+Shift+P.',
      );
    }
  }
  return diagnostics;
}

/** Copy caller data so later host-side mutation cannot change accepted state. */
export function normalizeConfiguration(value: JsonObject): PaletteConfiguration {
  const diagnostics = validateConfiguration(value);
  if (diagnostics.length) throw new Error('Invalid command-palette configuration.');
  const commands = value.commands as unknown as CommandItem[];
  return {
    ...configurationDefaults,
    ...value,
    commands: commands.map((item) => ({
      ...item,
      ...(item.keywords ? { keywords: [...item.keywords] } : {}),
      ...(item.metadata ? { metadata: { ...item.metadata } } : {}),
    })),
  } as PaletteConfiguration;
}

export function normalizeQuery(query: string): string {
  return query.normalize('NFKC').toLowerCase().trim();
}

export function filterCommands(commands: readonly CommandItem[], query: string): CommandItem[] {
  const needle = normalizeQuery(query);
  return commands.filter(
    (command) =>
      !needle ||
      [command.label, ...(command.keywords ?? [])].some((candidate) =>
        candidate.normalize('NFKC').toLowerCase().includes(needle),
      ),
  );
}
