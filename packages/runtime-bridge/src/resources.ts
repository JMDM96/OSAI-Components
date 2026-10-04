import type {
  ResourceScope,
  OperationContext,
  ManagedOperation,
  ProviderContract,
  OwnedProvider,
} from '@osai/component-sdk';

export interface ResourceCounts {
  operations: number;
  listeners: number;
  timers: number;
  observers: number;
  animationFrames: number;
  workers: number;
  portals: number;
  backgroundLocks: number;
  ownedRoots: number;
  disposables: number;
  shortcutClaims: number;
}

export const emptyCounts = (): ResourceCounts => ({
  operations: 0,
  listeners: 0,
  timers: 0,
  observers: 0,
  animationFrames: 0,
  workers: 0,
  portals: 0,
  backgroundLocks: 0,
  ownedRoots: 0,
  disposables: 0,
  shortcutClaims: 0,
});

/** Keeps nested modal owners from restoring each other's background attributes. */
export class BackgroundLocks {
  private readonly roots = new Map<symbol, HTMLElement>();
  private readonly changed = new Map<
    HTMLElement,
    { inert: string | null; hidden: string | null }
  >();

  constructor(private readonly document: Document) {}

  acquire(root: HTMLElement): () => void {
    const token = Symbol();
    this.roots.set(token, root);
    this.refresh();
    return () => {
      this.roots.delete(token);
      this.refresh();
    };
  }

  private refresh(): void {
    for (const [element, previous] of this.changed) {
      if (previous.inert === null) element.removeAttribute('inert');
      else element.setAttribute('inert', previous.inert);
      if (previous.hidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', previous.hidden);
    }
    this.changed.clear();
    // The most recently acquired connected modal alone owns interaction. Previous
    // dialogs stay mounted but inert, so independent focus traps cannot fight.
    const connected = [...this.roots.values()].filter((root) => root.isConnected);
    const live = connected.slice(-1);
    if (live.length === 0) return;
    const visit = (parent: Element): void => {
      for (const element of Array.from(parent.children)) {
        if (!(element instanceof this.document.defaultView!.HTMLElement)) continue;
        if (live.some((root) => root === element || root.contains(element))) continue;
        if (live.some((root) => element.contains(root))) {
          visit(element);
          continue;
        }
        this.changed.set(element, {
          inert: element.getAttribute('inert'),
          hidden: element.getAttribute('aria-hidden'),
        });
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      }
    };
    visit(this.document.body);
  }
}

export class ManagedResources implements ResourceScope {
  readonly counts: ResourceCounts;
  private readonly cleanups = new Set<() => void>();
  private disposed = false;
  private transaction?: {
    provisional: Set<() => void>;
    deferred: Set<() => void>;
    promotions: Map<ManagedResources, Map<string, ManagedOperation>>;
  };
  private readonly transactionRoot: ManagedResources;
  private parentRelease?: () => void;
  private readonly operations = new Map<string, ManagedOperation>();
  private generation = 0;

  constructor(
    private readonly view: Window,
    private readonly locks: BackgroundLocks,
    private readonly report: (code: string, cause?: unknown) => void,
    private readonly allowPortal: (element: HTMLElement) => boolean = () => false,
    parent?: ManagedResources,
    private readonly allowProvider = false,
    private readonly allowOperations = true,
  ) {
    this.transactionRoot = parent?.transactionRoot ?? this;
    this.counts = parent?.counts ?? emptyCounts();
  }

  child(): ManagedResources {
    const child = new ManagedResources(
      this.view,
      this.locks,
      this.report,
      this.allowPortal,
      this,
      this.allowProvider,
      this.allowOperations,
    );
    child.parentRelease = this.track('disposables', () => child.dispose());
    return child;
  }

  adoptProvider<T>(
    contract: ProviderContract,
    initialize: (scope: ResourceScope) => T,
  ): OwnedProvider<T> {
    if (
      !this.allowProvider ||
      this.disposed ||
      !contract.id.trim() ||
      contract.partialInitialization !== 'register-cleanup-before-allocation' ||
      contract.update !== 'transactional' ||
      contract.disposal !== 'scope' ||
      !Array.isArray(contract.capabilities) ||
      contract.capabilities.some(
        (capability) =>
          !['listeners', 'timers', 'observers', 'workers', 'portals'].includes(capability),
      )
    )
      throw new Error('Provider ownership requires a supported profile and complete obligations.');
    const scope = this.child();
    try {
      const value = initialize(scope);
      if (
        value &&
        (typeof value === 'object' || typeof value === 'function') &&
        typeof (value as { then?: unknown }).then === 'function'
      ) {
        void Promise.resolve(value).catch(() => {});
        throw new Error('Provider initialization must be synchronous.');
      }
      return Object.freeze({ value, dispose: () => scope.dispose() });
    } catch (cause) {
      scope.dispose();
      throw cause;
    }
  }

  operation<T>(
    key: string,
    work: (context: OperationContext) => Promise<T>,
    complete: (value: T) => void,
    failed?: () => void,
  ): ManagedOperation {
    if (!this.allowOperations)
      throw new Error('Managed operations require the managed-async capability profile.');
    if (!key.trim()) throw new Error('Managed operation keys must be nonempty.');
    const scope = this.child();
    const controller = new AbortController();
    const generation = ++this.generation;
    const transaction = this.transactionRoot.transaction;
    let pending = transaction?.promotions.get(this);
    if (transaction && !pending) {
      pending = new Map();
      transaction.promotions.set(this, pending);
    }
    const current = pending ?? this.operations;
    current.get(key)?.cancel();
    let active = !this.disposed;
    const operation: ManagedOperation = {
      signal: controller.signal,
      generation,
      resources: scope,
      isCurrent: () =>
        active &&
        !this.disposed &&
        !this.transactionRoot.disposed &&
        (this.operations.get(key) === operation ||
          this.transactionRoot.transaction?.promotions.get(this)?.get(key) === operation),
      cancel: () => release(),
    };
    const release = this.track('operations', () => {
      active = false;
      if (this.operations.get(key) === operation) this.operations.delete(key);
      if (current.get(key) === operation) current.delete(key);
      controller.abort();
      scope.dispose();
    });
    if (active) current.set(key, operation);
    void (async () => {
      if (!active) return;
      try {
        const value = await work(operation);
        if (operation.isCurrent()) complete(value);
      } catch (cause) {
        if (operation.isCurrent()) {
          this.report('operation-error', cause);
          try {
            failed?.();
          } catch (failureCause) {
            this.report('operation-error', failureCause);
          }
        }
      } finally {
        release();
      }
    })();
    return operation;
  }

  beginTransaction(): { commit(): void; rollback(): void } {
    if (this.transactionRoot !== this || this.transaction || this.disposed)
      throw new Error('Resource transition is unavailable.');
    const transaction = {
      provisional: new Set<() => void>(),
      deferred: new Set<() => void>(),
      promotions: new Map<ManagedResources, Map<string, ManagedOperation>>(),
    };
    this.transaction = transaction;
    const finish = (commit: boolean): void => {
      if (this.transaction !== transaction) return;
      delete this.transaction;
      if (commit)
        for (const [scope, operations] of transaction.promotions)
          for (const [key, operation] of operations) {
            scope.operations.get(key)?.cancel();
            scope.operations.set(key, operation);
          }
      const releases = commit ? transaction.deferred : transaction.provisional;
      for (const release of [...releases].reverse()) release();
    };
    return { commit: () => finish(true), rollback: () => finish(false) };
  }

  track(kind: keyof ResourceCounts, cleanup: () => void): () => void {
    if (this.disposed) {
      try {
        cleanup();
      } catch (cause) {
        this.report('cleanup-error', cause);
      }
      return () => {};
    }
    this.counts[kind] += 1;
    let active = true;
    const release = (): void => {
      if (!active) return;
      const transaction = this.transactionRoot.transaction;
      if (transaction && !transaction.provisional.has(release)) {
        transaction.deferred.add(release);
        return;
      }
      active = false;
      this.cleanups.delete(release);
      try {
        cleanup();
        this.counts[kind] -= 1;
      } catch (cause) {
        // A failed release is not evidence that the underlying resource is gone.
        // Preserve this count so a leak gate cannot accidentally certify it.
        this.report('cleanup-error', cause);
      }
    };
    this.cleanups.add(release);
    this.transactionRoot.transaction?.provisional.add(release);
    return release;
  }

  add(cleanup: () => void): () => void {
    return this.track('disposables', cleanup);
  }

  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): () => void {
    if (this.disposed) return () => {};
    // Track once/abort removal too: counts describe live listeners, not only registrations.
    let release = (): void => {};
    const once = typeof options === 'object' && options.once;
    const signal = typeof options === 'object' ? options.signal : undefined;
    if (signal?.aborted) return release;
    const wrapped: EventListener = (event) => {
      if (once) release();
      if (typeof listener === 'function') listener.call(target, event);
      else listener.handleEvent(event);
    };
    target.addEventListener(type, wrapped, options);
    release = this.track('listeners', () => {
      target.removeEventListener(type, wrapped, options);
      signal?.removeEventListener('abort', release);
    });
    signal?.addEventListener('abort', release, { once: true });
    return release;
  }

  timeout(callback: () => void, delay: number): () => void {
    if (this.disposed) return () => {};
    let release = (): void => {};
    const id = this.view.setTimeout(() => {
      release();
      if (!this.disposed) callback();
    }, delay);
    release = this.track('timers', () => this.view.clearTimeout(id));
    return release;
  }

  interval(callback: () => void, delay: number): () => void {
    if (this.disposed) return () => {};
    const id = this.view.setInterval(() => {
      if (!this.disposed) callback();
    }, delay);
    return this.track('timers', () => this.view.clearInterval(id));
  }

  animationFrame(callback: FrameRequestCallback): () => void {
    if (this.disposed) return () => {};
    let release = (): void => {};
    const id = this.view.requestAnimationFrame((time) => {
      release();
      if (!this.disposed) callback(time);
    });
    release = this.track('animationFrames', () => this.view.cancelAnimationFrame(id));
    return release;
  }

  observer<T extends { disconnect(): void }>(observer: T): () => void {
    return this.track('observers', () => observer.disconnect());
  }

  worker(worker: { terminate(): void }): () => void {
    return this.track('workers', () => worker.terminate());
  }

  portal(element: HTMLElement, parent: HTMLElement = this.view.document.body): () => void {
    if (this.disposed) return () => {};
    if (!this.allowPortal(element)) throw new Error('Undeclared portal capability.');
    parent.appendChild(element);
    return this.track('portals', () => element.remove());
  }

  lockBackground(modalRoot: HTMLElement): () => void {
    if (this.disposed) return () => {};
    return this.track('backgroundLocks', this.locks.acquire(modalRoot));
  }

  dispose(): void {
    if (this.disposed) return;
    const transaction = this.transactionRoot.transaction;
    if (transaction && (!this.parentRelease || !transaction.provisional.has(this.parentRelease))) {
      if (this.parentRelease) this.parentRelease();
      else transaction.deferred.add(() => this.dispose());
      return;
    }
    this.disposed = true;
    delete this.transaction;
    for (const cleanup of [...this.cleanups].reverse()) cleanup();
    this.parentRelease?.();
  }
}

interface ShortcutClaim {
  root: HTMLElement;
  shortcut: string;
  handler: (event: KeyboardEvent) => void;
  isOpen?: () => boolean;
}

export function normalizeShortcut(shortcut: string, mac = false): string | undefined {
  const aliases: Record<string, string> = {
    control: 'ctrl',
    command: 'meta',
    cmd: 'meta',
    option: 'alt',
    mod: mac ? 'meta' : 'ctrl',
    esc: 'escape',
    space: ' ',
  };
  const pieces = shortcut
    .toLowerCase()
    .split('+')
    .map((piece) => piece.trim())
    .map((piece) => aliases[piece] ?? piece);
  const modifiers = ['ctrl', 'meta', 'alt', 'shift'];
  const keys = pieces.filter((piece) => !modifiers.includes(piece));
  if (keys.length !== 1 || keys[0] === '' || new Set(pieces).size !== pieces.length)
    return undefined;
  return [...modifiers.filter((modifier) => pieces.includes(modifier)), keys[0]].join('+');
}

export class ShortcutCoordinator {
  private readonly claims: ShortcutClaim[] = [];
  private listening = false;
  constructor(
    private readonly document: Document,
    private readonly onError: (cause: unknown) => void,
  ) {}
  get listenerCount(): number {
    return this.listening ? 1 : 0;
  }

  register(
    root: HTMLElement,
    shortcut: string,
    handler: (event: KeyboardEvent) => void,
    conflict: () => void,
    options?: { isOpen?: () => boolean },
  ): () => void {
    const normalized = normalizeShortcut(
      shortcut,
      /Mac|iPhone|iPad/.test(this.document.defaultView!.navigator.platform),
    );
    if (!normalized) throw new Error('Invalid shortcut.');
    const claimed = this.claims.some((claim) => claim.shortcut === normalized);
    const claim: ShortcutClaim = {
      root,
      shortcut: normalized,
      handler,
      ...(options?.isOpen ? { isOpen: options.isOpen } : {}),
    };
    this.claims.push(claim);
    if (!this.listening) {
      this.document.addEventListener('keydown', this.onKeyDown);
      this.listening = true;
    }
    // Registration is already recoverable if a diagnostic callback itself throws.
    try {
      if (claimed) conflict();
    } catch (cause) {
      this.onError(cause);
    }
    return () => {
      const index = this.claims.indexOf(claim);
      if (index !== -1) this.claims.splice(index, 1);
      if (this.claims.length === 0 && this.listening) {
        this.document.removeEventListener('keydown', this.onKeyDown);
        this.listening = false;
      }
    };
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.repeat) return;
    const pressed = [
      ...(event.ctrlKey ? ['ctrl'] : []),
      ...(event.metaKey ? ['meta'] : []),
      ...(event.altKey ? ['alt'] : []),
      ...(event.shiftKey ? ['shift'] : []),
      event.key.toLowerCase(),
    ].join('+');
    const owner = this.claims.find((claim) => claim.shortcut === pressed);
    if (!owner || !owner.root.isConnected) return;
    const target = event.target;
    if (target instanceof this.document.defaultView!.Element) {
      const editable = target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      );
      if (editable && !(owner.isOpen?.() && owner.root.contains(target))) return;
    }
    event.preventDefault();
    try {
      owner.handler(event);
    } catch (cause) {
      this.onError(cause);
    }
  };
}
