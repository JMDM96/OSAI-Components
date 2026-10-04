/** Independent instrumentation, installed before component artifacts in each preview realm. */
export interface ObservationSnapshot {
  listeners: number;
  timers: number;
  animationFrames: number;
  observers: number;
  workers: number;
  portals: number;
  effects: number;
  workerUrls: string[];
  origins: string[];
  portalSelectors: string[];
  apis: string[];
}
export interface BrowserObservations {
  reset(): void;
  snapshot(): ObservationSnapshot;
  delay(ms: number): Promise<void>;
  untracked<T>(operation: () => T): T;
}
declare global {
  interface Window {
    observations: BrowserObservations;
  }
}
const originalAdd = EventTarget.prototype.addEventListener;
const NativeMutationObserver = window.MutationObserver;
const originalRemove = EventTarget.prototype.removeEventListener;
const originalTimeout = window.setTimeout.bind(window);
const originalClear = window.clearTimeout.bind(window);
const originalInterval = window.setInterval.bind(window);
const originalClearInterval = window.clearInterval.bind(window);
const originalRaf = window.requestAnimationFrame.bind(window);
const originalCancelRaf = window.cancelAnimationFrame.bind(window);
let active = false;
let effects = 0;
type Listener = {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  wrapped: EventListener;
  capture: boolean;
  tracked: boolean;
};
const listeners: Listener[] = [];
const timers = new Set<number>();
const frames = new Set<number>();
const observers = new Set<object>();
const workers = new Set<Worker>();
const workerUrls = new Set<string>();
const origins = new Set<string>();
const apis = new Set<string>();
const portals = new Map<Element, string>();
const noteOrigin = (url: string) => {
  try {
    const origin = new URL(url, location.href).origin;
    if (origin !== location.origin) origins.add(origin);
  } catch {
    origins.add('invalid');
  }
};
EventTarget.prototype.addEventListener = function (type, listener, options) {
  if (!listener) return;
  const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
  if (
    listeners.some(
      (entry) =>
        entry.target === this &&
        entry.type === type &&
        entry.listener === listener &&
        entry.capture === capture,
    )
  )
    return;
  if (typeof options === 'object' && options.signal?.aborted) return;
  const entry: Listener = {
    target: this,
    type,
    listener,
    capture,
    tracked: active,
    wrapped: (event) => {
      if (typeof options === 'object' && options.once) remove();
      if (entry.tracked) effects++;
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    },
  };
  const remove = () => {
    const index = listeners.indexOf(entry);
    if (index >= 0) listeners.splice(index, 1);
  };
  listeners.push(entry);
  originalAdd.call(this, type, entry.wrapped, options);
  if (typeof options === 'object' && options.signal)
    originalAdd.call(options.signal, 'abort', remove, { once: true });
};
EventTarget.prototype.removeEventListener = function (type, listener, options) {
  const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
  const index = listeners.findIndex(
    (entry) =>
      entry.target === this &&
      entry.type === type &&
      entry.listener === listener &&
      entry.capture === capture,
  );
  if (index < 0) {
    originalRemove.call(this, type, listener, options);
    return;
  }
  const [entry] = listeners.splice(index, 1);
  originalRemove.call(this, type, entry!.wrapped, options);
};
window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  const tracked = active;
  const id = originalTimeout(() => {
    timers.delete(id);
    if (tracked) effects++;
    if (typeof handler === 'function') handler(...args);
  }, timeout);
  if (tracked) timers.add(id);
  return id;
}) as typeof window.setTimeout;
window.clearTimeout = (id) => {
  timers.delete(Number(id));
  originalClear(id);
};
window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  const tracked = active;
  const id = originalInterval(() => {
    if (tracked) effects++;
    if (typeof handler === 'function') handler(...args);
  }, timeout);
  if (tracked) timers.add(id);
  return id;
}) as typeof window.setInterval;
window.clearInterval = (id) => {
  timers.delete(Number(id));
  originalClearInterval(id);
};
window.requestAnimationFrame = (callback) => {
  const tracked = active;
  const id = originalRaf((time) => {
    frames.delete(id);
    if (tracked) effects++;
    callback(time);
  });
  if (tracked) frames.add(id);
  return id;
};
window.cancelAnimationFrame = (id) => {
  frames.delete(id);
  originalCancelRaf(id);
};
for (const name of ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'] as const) {
  const Original = window[name];
  Object.defineProperty(window, name, {
    configurable: true,
    value: new Proxy(Original, {
      construct(Target, args) {
        const tracked = active;
        if (tracked) apis.add(name);
        const callback = args[0] as (...values: unknown[]) => void;
        args[0] = (...values: unknown[]) => {
          if (tracked) effects++;
          callback(...values);
        };
        const observer = Reflect.construct(Target, args) as MutationObserver;
        const observe = observer.observe.bind(observer);
        const disconnect = observer.disconnect.bind(observer);
        observer.observe = ((...values: Parameters<MutationObserver['observe']>) => {
          if (tracked) observers.add(observer);
          observe(...values);
        }) as MutationObserver['observe'];
        observer.disconnect = () => {
          observers.delete(observer);
          disconnect();
        };
        return observer;
      },
    }),
  });
}
const WorkerClass = window.Worker;
window.Worker = new Proxy(WorkerClass, {
  construct(Target, args) {
    const worker = Reflect.construct(Target, args) as Worker;
    const tracked = active;
    if (tracked) {
      workers.add(worker);
      workerUrls.add(new URL(String(args[0]), location.href).href);
      apis.add('Worker');
      noteOrigin(String(args[0]));
    }
    const terminate = worker.terminate.bind(worker);
    worker.terminate = () => {
      workers.delete(worker);
      terminate();
    };
    return worker;
  },
});
const fetchOriginal = window.fetch.bind(window);
window.fetch = (input, init) => {
  if (active)
    noteOrigin(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  return fetchOriginal(input, init);
};
const XHR = window.XMLHttpRequest;
window.XMLHttpRequest = new Proxy(XHR, {
  construct(Target, args) {
    const request = Reflect.construct(Target, args) as XMLHttpRequest;
    const open = request.open;
    request.open = function (
      method: string,
      url: string | URL,
      async: boolean = true,
      user?: string | null,
      password?: string | null,
    ) {
      if (active) noteOrigin(String(url));
      open.call(this, method, url, async, user, password);
    };
    return request;
  },
});
// DOM ownership is inspected directly; it does not depend on managed portal counters.
function collectPortals() {
  if (!active) return;
  for (const element of document.body.children) {
    if (element.id === 'hosts' || element.matches('script,link')) continue;
    const selectors =
      window.previewMetadata?.manifest.capabilities.portals.map((portal) => portal.selector) ?? [];
    const selector =
      selectors.find((value) => element.matches(value)) ??
      `undeclared:${element.tagName.toLowerCase()}`;
    portals.set(element, selector);
  }
}
const domObserver = new NativeMutationObserver((records) => {
  if (!active) return;
  for (const record of records)
    if (record.target === document.body)
      for (const node of record.addedNodes) {
        if (!(node instanceof Element) || node.id === 'hosts' || node.matches('script,link'))
          continue;
        const selector =
          window.previewMetadata?.manifest.capabilities.portals.find((portal) =>
            node.matches(portal.selector),
          )?.selector ?? `undeclared:${node.tagName.toLowerCase()}`;
        portals.set(node, selector);
      }
});
domObserver.observe(document, { subtree: true, childList: true });
window.observations = {
  untracked(operation) {
    const before = active;
    active = false;
    try {
      return operation();
    } finally {
      active = before;
    }
  },
  reset() {
    active = true;
    effects = 0;
    workerUrls.clear();
    origins.clear();
    apis.clear();
    portals.clear();
  },
  delay: (ms) => new Promise((resolve) => originalTimeout(resolve, ms)),
  snapshot() {
    collectPortals();
    return {
      listeners: listeners.filter((item) => item.tracked).length,
      timers: timers.size,
      animationFrames: frames.size,
      observers: observers.size,
      workers: workers.size,
      portals: [...portals.keys()].filter((element) => element.isConnected).length,
      effects,
      workerUrls: [...workerUrls],
      origins: [...origins],
      portalSelectors: [...portals.values()],
      apis: [...apis],
    };
  },
};
window.observations.reset();
