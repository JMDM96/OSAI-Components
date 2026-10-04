import type { ComponentContext, ComponentController, JsonObject } from '@osai/component-sdk';
import { filterCommands, normalizeConfiguration } from './configuration.js';
import type { CommandItem, PaletteConfiguration } from './configuration.js';

type CloseReason = 'host' | 'escape' | 'selection' | 'shortcut' | 'button';

/** Creates owned light DOM only; every long-lived resource belongs to the SDK scope. */
export function createCommandPalette(
  context: ComponentContext,
  initial: JsonObject,
): ComponentController {
  let configuration = normalizeConfiguration(initial);
  const { root, host, instanceId, resources } = context;
  const document = root.ownerDocument;
  // IDs depend only on the instance, never on host-controlled command identifiers.
  const idPrefix = `osai-palette-${Array.from(instanceId)
    .map((character) => character.codePointAt(0)?.toString(16))
    .join('-')}`;
  let disposed = false;
  let isOpen = false;
  let composing = false;
  let query = '';
  let activeId: string | undefined;
  let results: CommandItem[] = [];
  let previousFocus: HTMLElement | null = null;
  // WebKit may blur a focused button on pointer-down before its click action opens us.
  let lastClosedFocus: HTMLElement | null =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let releaseBackground: (() => void) | undefined;
  let releaseShortcut: (() => void) | undefined;

  function element<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const overlay = element('div', 'osai-command-palette-overlay');
  overlay.hidden = true;
  const dialog = element('section', 'osai-command-palette-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${idPrefix}-title`);
  dialog.setAttribute('aria-describedby', `${idPrefix}-instructions`);

  const heading = element('div', 'osai-command-palette-heading');
  const title = element('h2', 'osai-command-palette-title');
  title.id = `${idPrefix}-title`;
  const closeButton = element('button', 'osai-command-palette-close', 'Esc');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close command palette');
  heading.append(title, closeButton);

  const searchRow = element('div', 'osai-command-palette-search-row');
  const searchIcon = element('span', 'osai-command-palette-search-icon', '⌕');
  searchIcon.setAttribute('aria-hidden', 'true');
  const input = element('input', 'osai-command-palette-input');
  input.type = 'text';
  input.id = `${idPrefix}-input`;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', `${idPrefix}-results`);
  input.setAttribute('aria-describedby', `${idPrefix}-instructions`);
  searchRow.append(searchIcon, input);

  const list = element('div', 'osai-command-palette-results');
  list.id = `${idPrefix}-results`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Commands');
  const empty = element('p', 'osai-command-palette-empty');
  empty.hidden = true;
  const footer = element('div', 'osai-command-palette-footer');
  const count = element('span', 'osai-command-palette-count');
  count.setAttribute('role', 'status');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const hints = element('span', 'osai-command-palette-hints', '↑↓ Navigate · ↵ Select');
  hints.setAttribute('aria-hidden', 'true');
  footer.append(count, hints);
  const instructions = element(
    'p',
    'osai-command-palette-visually-hidden',
    'Type to filter commands. Use the up and down arrow keys to navigate, Enter to select, and Escape to close.',
  );
  instructions.id = `${idPrefix}-instructions`;
  dialog.append(heading, searchRow, list, empty, footer, instructions);
  overlay.append(dialog);
  root.append(overlay);

  function emit(name: string, payload: JsonObject = {}): void {
    if (!disposed) context.emit(name, { instanceId, ...payload });
  }

  function setActive(id: string | undefined, scroll: boolean): void {
    activeId = id;
    let activeNode: HTMLElement | undefined;
    Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')).forEach((option) => {
      const active = option.dataset.commandId === id;
      option.setAttribute('aria-selected', String(active));
      if (active) activeNode = option;
    });
    if (activeNode) {
      input.setAttribute('aria-activedescendant', activeNode.id);
      if (scroll && typeof activeNode.scrollIntoView === 'function')
        activeNode.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function render(preserveActive: boolean): void {
    results = filterCommands(configuration.commands, query);
    const nextActive =
      preserveActive && results.some((command) => command.id === activeId && !command.disabled)
        ? activeId
        : results.find((command) => !command.disabled)?.id;
    const fragment = document.createDocumentFragment();
    results.forEach((command, index) => {
      const option = element('div', 'osai-command-palette-option');
      option.id = `${idPrefix}-option-${index}`;
      option.dataset.commandId = command.id;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-disabled', String(Boolean(command.disabled)));
      option.setAttribute('aria-posinset', String(index + 1));
      option.setAttribute('aria-setsize', String(results.length));
      const content = element('span', 'osai-command-palette-option-content');
      const label = element('span', 'osai-command-palette-option-label', command.label);
      content.append(label);
      if (command.description)
        content.append(
          element('span', 'osai-command-palette-option-description', command.description),
        );
      option.append(content);
      if (command.group || command.metadata?.hint) {
        const metadata = element('span', 'osai-command-palette-option-meta');
        if (command.group)
          metadata.append(element('span', 'osai-command-palette-group', command.group));
        if (command.metadata?.hint)
          metadata.append(element('span', 'osai-command-palette-hint', command.metadata.hint));
        option.append(metadata);
      }
      fragment.append(option);
    });
    list.replaceChildren(fragment);
    title.textContent = configuration.title;
    input.setAttribute('aria-label', `Search ${configuration.title}`);
    input.placeholder = configuration.placeholder;
    empty.textContent = configuration.emptyMessage;
    empty.hidden = results.length !== 0;
    list.hidden = results.length === 0;
    count.textContent =
      results.length === 0
        ? `0 commands. ${configuration.emptyMessage}`
        : `${results.length} ${results.length === 1 ? 'command' : 'commands'}`;
    setActive(nextActive, false);
  }

  function restoreFocus(): void {
    const candidate = previousFocus?.isConnected
      ? previousFocus
      : host.isConnected
        ? host
        : document.body;
    previousFocus = null;
    if (candidate !== document.body) {
      candidate.focus({ preventScroll: true });
      if (document.activeElement === candidate) return;
    }
    const body = document.body;
    const priorTabIndex = body.getAttribute('tabindex');
    body.setAttribute('tabindex', '-1');
    body.focus({ preventScroll: true });
    if (priorTabIndex === null) body.removeAttribute('tabindex');
    else body.setAttribute('tabindex', priorTabIndex);
  }

  function open(): void {
    if (disposed || isOpen) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousFocus =
      active === document.body && lastClosedFocus?.isConnected ? lastClosedFocus : active;
    query = '';
    input.value = '';
    composing = false;
    render(false);
    overlay.hidden = false;
    isOpen = true;
    input.setAttribute('aria-expanded', 'true');
    releaseBackground = resources.lockBackground(root);
    input.focus({ preventScroll: true });
    emit('opened');
  }

  function close(reason: CloseReason, notify = true): void {
    if (!isOpen) return;
    isOpen = false;
    composing = false;
    overlay.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    releaseBackground?.();
    releaseBackground = undefined;
    restoreFocus();
    if (notify) emit('closed', { reason });
  }

  function select(id: string | undefined, source: 'keyboard' | 'pointer'): void {
    if (!isOpen || disposed || composing) return;
    const command = results.find((item) => item.id === id && !item.disabled);
    if (!command) return;
    emit('commandSelected', { commandId: command.id, query, source });
    if (configuration.closeOnSelect) close('selection');
  }

  function configureShortcut(next: string): void {
    releaseShortcut?.();
    releaseShortcut = undefined;
    if (!next) return;
    releaseShortcut = context.registerShortcut(
      next,
      (event) => {
        event.preventDefault();
        if (isOpen) close('shortcut');
        else open();
      },
      {
        isOpen: () => isOpen,
        onConflict: () =>
          emit('error', {
            code: 'shortcut-conflict',
            message: 'This shortcut is currently owned by another component.',
          }),
      },
    );
  }

  function shortcutIdentity(value: string): string {
    const mac = /Mac|iPhone|iPad/.test(document.defaultView?.navigator.platform ?? '');
    const parts = value
      .toLowerCase()
      .split('+')
      .map((part) =>
        part === 'control' ? 'ctrl' : part === 'mod' ? (mac ? 'meta' : 'ctrl') : part,
      );
    const key = parts.pop() ?? '';
    return [...['ctrl', 'meta', 'alt', 'shift'].filter((part) => parts.includes(part)), key].join(
      '+',
    );
  }

  function commitQuery(): void {
    if (!isOpen || composing || input.value === query) return;
    query = input.value;
    render(false);
    emit('queryChanged', { query, resultCount: results.length });
  }

  function keydown(event: KeyboardEvent): void {
    if (!isOpen || event.isComposing || composing || event.keyCode === 229) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close('escape');
      return;
    }
    if (event.key === 'Tab') {
      // Only the input and close button participate in this modal's tab cycle.
      event.preventDefault();
      if (document.activeElement === input) closeButton.focus();
      else input.focus();
      return;
    }
    if (event.target !== input) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      select(activeId, 'keyboard');
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabled = results.filter((command) => !command.disabled);
    if (!enabled.length) return;
    const current = enabled.findIndex((command) => command.id === activeId);
    const index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? enabled.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % enabled.length
            : (current - 1 + enabled.length) % enabled.length;
    setActive(enabled[index]?.id, true);
  }

  resources.listen(overlay, 'keydown', (event) => keydown(event as KeyboardEvent));
  resources.listen(input, 'input', commitQuery);
  resources.listen(input, 'compositionstart', () => {
    composing = true;
  });
  resources.listen(input, 'compositionend', () => {
    composing = false;
    commitQuery();
  });
  resources.listen(closeButton, 'click', () => close('button'));
  resources.listen(list, 'mousedown', (event) => {
    // Options are virtual focus targets; preserve physical focus in the combobox.
    if ((event as MouseEvent).button === 0) event.preventDefault();
  });
  resources.listen(list, 'click', (event) => {
    if (!(event.target instanceof Element)) return;
    const option = event.target.closest<HTMLElement>('[role="option"]');
    if (option && list.contains(option)) select(option.dataset.commandId, 'pointer');
  });
  resources.listen(document, 'focusin', () => {
    if (
      !isOpen &&
      document.activeElement instanceof HTMLElement &&
      !root.contains(document.activeElement)
    ) {
      lastClosedFocus = document.activeElement;
    }
    if (isOpen && !root.contains(document.activeElement) && !root.closest('[inert]'))
      input.focus({ preventScroll: true });
  });
  render(false);
  configureShortcut(configuration.shortcut);

  return {
    prepareUpdate(next: JsonObject) {
      const normalized = normalizeConfiguration(next);
      const previous = configuration;
      const previousActive = activeId;
      let committed = false;
      function apply(value: PaletteConfiguration, restoreActive?: string): void {
        const shortcutChanged =
          shortcutIdentity(configuration.shortcut) !== shortcutIdentity(value.shortcut);
        configuration = value;
        if (restoreActive !== undefined) activeId = restoreActive;
        render(true);
        if (shortcutChanged) configureShortcut(configuration.shortcut);
      }
      return {
        commit() {
          if (disposed) return;
          committed = true;
          apply(normalized);
        },
        rollback() {
          if (committed && !disposed) apply(previous, previousActive);
        },
      };
    },
    commands: {
      open() {
        open();
        return { isOpen };
      },
      close() {
        close('host');
        return { isOpen };
      },
      toggle() {
        if (isOpen) close('host');
        else open();
        return { isOpen };
      },
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseShortcut?.();
      releaseShortcut = undefined;
      close('host', false);
      previousFocus = null;
      lastClosedFocus = null;
      overlay.remove();
    },
  };
}
