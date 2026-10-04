import type {
  ComponentContext,
  ComponentController,
  ComponentDefinition,
} from '@osai/component-sdk';
import {
  canonicalJson,
  isJsonValue,
  normalizeConfig,
  pointer,
  validateImplementationParity,
  validateJsonSchema,
  validateManifest,
} from '@osai/contract-schemas';
import type { Diagnostic, JsonObject, JsonValue } from '@osai/contract-schemas';
import {
  BackgroundLocks,
  emptyCounts,
  ManagedResources,
  normalizeShortcut,
  ShortcutCoordinator,
} from './resources.js';
import type { ResourceCounts } from './resources.js';

export { normalizeShortcut };
export type { ResourceCounts };
export const BRIDGE_VERSION = '1.0.0';
export const CONTRACT_VERSION = '1.0';
const bridgeIdentity = Symbol.for('@osai/runtime-bridge');

export interface Envelope<T = JsonValue> {
  contractVersion: typeof CONTRACT_VERSION;
  ok: boolean;
  code: string;
  message: string;
  path?: string;
  value?: T;
}

export interface BridgeApi {
  create(
    componentId: string,
    instanceId: string,
    hostElementId: string,
    configJson: string,
  ): string;
  update(instanceId: string, configJson: string): string;
  invoke(instanceId: string, commandName: string, argumentsJson: string): string;
  registerCallback(
    instanceId: string,
    eventName: string,
    callback: (eventJson: string) => void,
  ): string;
  unregisterCallback(instanceId: string, subscriptionId: string): string;
  dispose(instanceId: string): string;
  getInfo(componentId?: string): string;
}

export interface RuntimeSnapshot {
  bridgeVersion: string;
  instances: number;
  subscriptions: number;
  pendingEvents: number;
  resources: ResourceCounts;
  diagnostics: Diagnostic[];
}

export interface RuntimeBridge {
  readonly api: BridgeApi;
  registerComponent(definition: ComponentDefinition): string;
  inspect(): RuntimeSnapshot;
}

export interface BridgeOptions {
  document?: Document;
  globalObject?: object;
  namespace?: string;
  /** Raw causes are available only to this local callback, never to host envelopes. */
  diagnostics?: (diagnostic: Diagnostic, cause?: unknown) => void;
}

interface Subscription {
  event: string;
  callback: (eventJson: string) => void;
}
interface Delivery {
  json: string;
  subscriptions: string[];
}
interface Instance {
  id: string;
  definition: ComponentDefinition;
  config: JsonObject;
  host: HTMLElement;
  root: HTMLElement;
  resources: ManagedResources;
  controller?: ComponentController;
  subscriptions: Map<string, Subscription>;
  queue: Delivery[];
  cancelDelivery?: () => void;
  disposed: boolean;
  committed: boolean;
}

class BoundaryFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly path?: string,
  ) {
    super(message);
  }
}

const messages: Record<string, string> = {
  'internal-error': 'The component operation failed.',
  'callback-error': 'A host callback failed.',
  'cleanup-error': 'A managed cleanup failed.',
  'shortcut-conflict': 'This shortcut is currently owned by another component.',
  'event-contract-error': 'The component emitted an invalid event.',
};

function envelope(
  ok: boolean,
  code: string,
  message: string,
  value?: unknown,
  path?: string,
): string {
  return JSON.stringify({
    contractVersion: CONTRACT_VERSION,
    ok,
    code,
    message,
    ...(path === undefined ? {} : { path }),
    ...(value === undefined ? {} : { value }),
  });
}

function identifier(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new BoundaryFailure('invalid-identifier', 'Expected a nonempty string identifier.', path);
}

function parse(value: unknown, path: string): JsonValue {
  if (typeof value !== 'string')
    throw new BoundaryFailure('invalid-json', 'Expected a JSON string.', path);
  try {
    return JSON.parse(value) as JsonValue;
  } catch {
    throw new BoundaryFailure('invalid-json', 'Malformed JSON input.', path);
  }
}

function thenable(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function sync(value: unknown): void {
  if (thenable(value)) {
    // Consume rejection from an accidental Promise without accepting an asynchronous ABI.
    if (value instanceof Promise) void value.catch(() => {});
    throw new BoundaryFailure(
      'unsupported-execution-mode',
      'Bridge contract version 1 requires synchronous completion.',
    );
  }
}

function requireValid(diagnostics: Diagnostic[]): void {
  const first = diagnostics[0];
  if (first)
    throw new BoundaryFailure(
      'validation-error',
      'The value does not satisfy its declared contract.',
      first.path,
    );
}

export function createBridge(options: BridgeOptions = {}): RuntimeBridge {
  const document = options.document ?? globalThis.document;
  if (!document?.defaultView) throw new Error('The runtime bridge requires a browser document.');
  const view = document.defaultView;
  const components = new Map<string, ComponentDefinition>();
  const instances = new Map<string, Instance>();
  const containers = new WeakMap<HTMLElement, string>();
  const pendingIds = new Set<string>();
  const failedReleases = emptyCounts();
  const diagnostics: Diagnostic[] = [];
  const locks = new BackgroundLocks(document);
  let subscriptionSequence = 0;

  const report = (code: string, path = '', cause?: unknown): void => {
    const diagnostic = {
      code,
      path,
      message: messages[code] ?? 'A component contract diagnostic was reported.',
    };
    diagnostics.push(diagnostic);
    if (diagnostics.length > 100) diagnostics.shift();
    try {
      options.diagnostics?.(diagnostic, cause);
    } catch {
      /* Diagnostics never control cleanup or delivery. */
    }
  };
  const shortcuts = new ShortcutCoordinator(document, (cause) =>
    report('internal-error', '', cause),
  );

  const boundary = (operation: () => string): string => {
    try {
      return operation();
    } catch (cause) {
      if (cause instanceof BoundaryFailure)
        return envelope(false, cause.code, cause.message, undefined, cause.path);
      report('internal-error', '', cause);
      return envelope(false, 'internal-error', messages['internal-error']!);
    }
  };

  const find = (id: string): Instance => {
    identifier(id, '/instanceId');
    const instance = instances.get(id);
    if (!instance)
      throw new BoundaryFailure(
        'unknown-instance',
        'No live instance has this identifier.',
        '/instanceId',
      );
    return instance;
  };

  const configuration = (definition: ComponentDefinition, json: string): JsonObject => {
    const normalized = normalizeConfig(definition.manifest, parse(json, '/configuration'));
    requireValid(normalized.diagnostics);
    if (!normalized.ok || !normalized.value)
      throw new BoundaryFailure(
        'validation-error',
        'The configuration is invalid.',
        '/configuration',
      );
    requireValid(definition.validateConfig?.(normalized.value) ?? []);
    return normalized.value;
  };

  const stopEvents = (instance: Instance): void => {
    instance.cancelDelivery?.();
    delete instance.cancelDelivery;
    instance.queue.length = 0;
    instance.subscriptions.clear();
  };

  const cleanup = (instance: Instance): void => {
    instance.disposed = true;
    stopEvents(instance);
    try {
      if (instance.controller) sync(instance.controller.dispose());
    } catch (cause) {
      report('cleanup-error', '', cause);
    }
    instance.resources.dispose();
    for (const key of Object.keys(failedReleases) as (keyof ResourceCounts)[])
      failedReleases[key] += instance.resources.counts[key];
    containers.delete(instance.host);
    instances.delete(instance.id);
  };

  const schedule = (instance: Instance): void => {
    if (
      instance.cancelDelivery ||
      !instance.committed ||
      instance.disposed ||
      instance.queue.length === 0
    )
      return;
    instance.cancelDelivery = instance.resources.timeout(() => {
      delete instance.cancelDelivery;
      // Work emitted by callbacks belongs to the next turn, avoiding recursive delivery.
      const deliveries = instance.queue.splice(0);
      for (const delivery of deliveries) {
        if (instance.disposed) break;
        for (const token of delivery.subscriptions) {
          if (instance.disposed) break;
          const subscription = instance.subscriptions.get(token);
          if (!subscription) continue;
          try {
            subscription.callback(delivery.json);
          } catch (cause) {
            report('callback-error', '', cause);
          }
        }
      }
      schedule(instance);
    }, 0);
  };

  const emit = (instance: Instance, name: string, payload: JsonValue): void => {
    if (instance.disposed) return;
    const path = `/events/${pointer(name)}`;
    const contract = Object.prototype.hasOwnProperty.call(instance.definition.manifest.events, name)
      ? instance.definition.manifest.events[name]
      : undefined;
    if (
      !contract ||
      !isJsonValue(payload) ||
      validateJsonSchema(contract.schema, payload, path).length > 0
    ) {
      report('event-contract-error', path);
      return;
    }
    const subscriptions = [...instance.subscriptions]
      .filter(([, subscription]) => subscription.event === name)
      .map(([token]) => token);
    if (subscriptions.length === 0) return;
    instance.queue.push({
      json: envelope(true, 'event', 'Component event.', {
        instanceId: instance.id,
        eventName: name,
        payload,
      }),
      subscriptions,
    });
    schedule(instance);
  };

  const inspect = (): RuntimeSnapshot => {
    const resources = { ...failedReleases };
    let subscriptions = 0;
    let pendingEvents = 0;
    for (const instance of instances.values()) {
      subscriptions += instance.subscriptions.size;
      pendingEvents += instance.queue.length;
      for (const key of Object.keys(resources) as (keyof ResourceCounts)[])
        resources[key] += instance.resources.counts[key];
    }
    resources.listeners += shortcuts.listenerCount;
    return {
      bridgeVersion: BRIDGE_VERSION,
      instances: instances.size,
      subscriptions,
      pendingEvents,
      resources,
      diagnostics: diagnostics.map((value) => ({ ...value })),
    };
  };

  const api: BridgeApi = Object.freeze({
    create: (
      componentId: string,
      instanceId: string,
      hostElementId: string,
      configJson: string,
    ): string =>
      boundary(() => {
        identifier(componentId, '/componentId');
        identifier(instanceId, '/instanceId');
        identifier(hostElementId, '/hostElementId');
        const definition = components.get(componentId);
        if (!definition)
          throw new BoundaryFailure(
            'unknown-component',
            'The component is not registered.',
            '/componentId',
          );
        if (instances.has(instanceId) || pendingIds.has(instanceId))
          throw new BoundaryFailure(
            'duplicate-instance',
            'The instance identifier is already in use.',
            '/instanceId',
          );
        const host = document.getElementById(hostElementId);
        if (!(host instanceof view.HTMLElement))
          throw new BoundaryFailure(
            'missing-container',
            'The host container does not exist.',
            '/hostElementId',
          );
        if (containers.has(host))
          throw new BoundaryFailure(
            'container-claimed',
            'The host container is already owned.',
            '/hostElementId',
          );
        const config = configuration(definition, configJson);
        const root = document.createElement('div');
        root.dataset.osaiComponent = componentId;
        root.dataset.osaiInstance = instanceId;
        const resources = new ManagedResources(
          view,
          locks,
          (code, cause) => report(code, '', cause),
          (element) =>
            definition.manifest.capabilities.portals.some((portal) =>
              element.matches(portal.selector),
            ),
        );
        const instance: Instance = {
          id: instanceId,
          definition,
          config,
          host,
          root,
          resources,
          subscriptions: new Map(),
          queue: [],
          disposed: false,
          committed: false,
        };
        pendingIds.add(instanceId);
        containers.set(host, instanceId);
        host.appendChild(root);
        resources.track('ownedRoots', () => root.remove());
        const context: ComponentContext = {
          instanceId,
          host,
          root,
          resources,
          emit: (name, payload) => emit(instance, name, payload),
          diagnostic: (code, _message, path) => report(code, path),
          registerShortcut: (shortcut, handler, shortcutOptions) => {
            if (instance.disposed) return () => {};
            const cancel = shortcuts.register(
              root,
              shortcut,
              handler,
              () => {
                report('shortcut-conflict', '/properties/shortcut');
                shortcutOptions?.onConflict?.();
              },
              shortcutOptions,
            );
            return resources.track('shortcutClaims', cancel);
          },
        };
        try {
          const controller = definition.create(context, config);
          sync(controller);
          if (
            !controller ||
            typeof controller.prepareUpdate !== 'function' ||
            typeof controller.dispose !== 'function'
          )
            throw new BoundaryFailure(
              'implementation-contract-error',
              'The component did not provide a complete controller.',
            );
          instance.controller = controller;
          const commands = controller.commands;
          if (!commands || typeof commands !== 'object')
            throw new BoundaryFailure(
              'implementation-contract-error',
              'The component must expose its actual command handlers.',
              '/commands',
            );
          for (const name of new Set([
            ...Object.keys(definition.manifest.commands),
            ...Object.keys(commands),
          ])) {
            if (
              !Object.prototype.hasOwnProperty.call(definition.manifest.commands, name) ||
              !Object.prototype.hasOwnProperty.call(commands, name) ||
              typeof commands[name] !== 'function'
            )
              throw new BoundaryFailure(
                'implementation-contract-error',
                'The actual command handlers must match the manifest.',
                `/commands/${pointer(name)}`,
              );
          }
          instance.committed = true;
          instances.set(instanceId, instance);
          schedule(instance);
          return envelope(true, 'created', 'The component instance was created.', { instanceId });
        } catch (cause) {
          cleanup(instance);
          throw cause;
        } finally {
          pendingIds.delete(instanceId);
        }
      }),
    update: (instanceId: string, configJson: string): string =>
      boundary(() => {
        const instance = find(instanceId);
        const next = configuration(instance.definition, configJson);
        for (const [name, property] of Object.entries(instance.definition.manifest.properties)) {
          if (
            property.updateMode === 'recreate' &&
            canonicalJson(instance.config[name] ?? null) !== canonicalJson(next[name] ?? null)
          )
            throw new BoundaryFailure(
              'recreation-required',
              'A changed property requires explicit disposal and creation.',
              `/properties/${pointer(name)}`,
            );
        }
        const transaction = instance.controller!.prepareUpdate(next);
        sync(transaction);
        if (
          !transaction ||
          typeof transaction.commit !== 'function' ||
          typeof transaction.rollback !== 'function'
        )
          throw new BoundaryFailure(
            'implementation-contract-error',
            'Updates require a commit and rollback transaction.',
          );
        const queueLength = instance.queue.length;
        try {
          sync(transaction.commit());
          instance.config = next;
        } catch (cause) {
          // Discard events emitted by a failed commit before rollback restores the view.
          instance.queue.splice(queueLength);
          try {
            sync(transaction.rollback());
          } catch (rollbackCause) {
            report('cleanup-error', '', rollbackCause);
          }
          instance.queue.splice(queueLength);
          if (instance.queue.length === 0) {
            instance.cancelDelivery?.();
            delete instance.cancelDelivery;
          }
          throw cause;
        }
        return envelope(true, 'updated', 'The complete configuration was replaced.', {
          instanceId,
        });
      }),
    invoke: (instanceId: string, commandName: string, argumentsJson: string): string =>
      boundary(() => {
        const instance = find(instanceId);
        identifier(commandName, '/commandName');
        const commandPath = `/commands/${pointer(commandName)}`;
        const command = Object.prototype.hasOwnProperty.call(
          instance.definition.manifest.commands,
          commandName,
        )
          ? instance.definition.manifest.commands[commandName]
          : undefined;
        if (!command)
          throw new BoundaryFailure('unknown-command', 'The command is not declared.', commandPath);
        const args = parse(argumentsJson, `${commandPath}/arguments`);
        requireValid(validateJsonSchema(command.arguments, args, `${commandPath}/arguments`));
        const result = instance.controller!.commands[commandName]!(args);
        sync(result);
        if (!isJsonValue(result))
          throw new BoundaryFailure(
            'invalid-command-result',
            'The command returned a non-JSON result.',
            `${commandPath}/result`,
          );
        const errors = validateJsonSchema(command.result, result, `${commandPath}/result`);
        if (errors.length)
          throw new BoundaryFailure(
            'invalid-command-result',
            'The command result does not satisfy its contract.',
            errors[0]!.path,
          );
        return envelope(true, 'invoked', 'The command completed.', result);
      }),
    registerCallback: (
      instanceId: string,
      eventName: string,
      callback: (eventJson: string) => void,
    ): string =>
      boundary(() => {
        const instance = find(instanceId);
        identifier(eventName, '/eventName');
        if (!Object.prototype.hasOwnProperty.call(instance.definition.manifest.events, eventName))
          throw new BoundaryFailure(
            'unknown-event',
            'The event is not declared.',
            `/events/${pointer(eventName)}`,
          );
        if (typeof callback !== 'function')
          throw new BoundaryFailure(
            'invalid-callback',
            'The callback must be a function.',
            '/callback',
          );
        const token = `osai-sub-${++subscriptionSequence}`;
        instance.subscriptions.set(token, { event: eventName, callback });
        return envelope(true, 'subscribed', 'The event callback was registered.', {
          subscriptionId: token,
        });
      }),
    unregisterCallback: (instanceId: string, subscriptionId: string): string =>
      boundary(() => {
        const instance = find(instanceId);
        identifier(subscriptionId, '/subscriptionId');
        instance.subscriptions.delete(subscriptionId);
        return envelope(true, 'unsubscribed', 'The event callback is no longer registered.');
      }),
    dispose: (instanceId: string): string =>
      boundary(() => {
        identifier(instanceId, '/instanceId');
        const instance = instances.get(instanceId);
        if (instance) cleanup(instance);
        return envelope(true, 'disposed', 'The instance is disposed.', { instanceId });
      }),
    getInfo: (componentId?: string): string =>
      boundary(() => {
        if (componentId !== undefined) {
          identifier(componentId, '/componentId');
          const definition = components.get(componentId);
          if (!definition)
            throw new BoundaryFailure(
              'unknown-component',
              'The component is not registered.',
              '/componentId',
            );
          return envelope(true, 'info', 'Registered component information.', definition.manifest);
        }
        return envelope(true, 'info', 'Runtime bridge information.', {
          ...inspect(),
          components: [...components.values()].map((definition) => ({
            componentId: definition.manifest.componentId,
            version: definition.manifest.version,
            contractVersion: definition.manifest.contractVersion,
          })),
        });
      }),
  });

  const runtime: RuntimeBridge = {
    api,
    inspect,
    registerComponent: (definition) =>
      boundary(() => {
        const validation = validateManifest(definition.manifest);
        requireValid(validation.diagnostics);
        if (!validation.ok)
          throw new BoundaryFailure('validation-error', 'The component manifest is invalid.');
        const manifest = definition.manifest;
        const existing = components.get(manifest.componentId);
        if (existing) {
          if (canonicalJson(existing.manifest) !== canonicalJson(manifest))
            throw new BoundaryFailure(
              'incompatible-component',
              'An incompatible component is already registered.',
              '/componentId',
            );
          return envelope(
            true,
            'registered',
            'The exact component contract is already registered.',
          );
        }
        const parity = validateImplementationParity(manifest, definition.contract);
        if (parity.length)
          throw new BoundaryFailure(
            'implementation-contract-error',
            'The implementation does not match its manifest.',
            parity[0]!.path,
          );
        components.set(manifest.componentId, definition);
        return envelope(true, 'registered', 'The component contract was registered.');
      }),
  };
  return runtime;
}

/** Install only the JSON host API. Internal registration remains behind a symbol. */
export function installBridge(options: BridgeOptions = {}): RuntimeBridge {
  const target = (options.globalObject ?? options.document?.defaultView ?? globalThis) as Record<
    string,
    unknown
  >;
  const segments = (options.namespace ?? 'OSAI.Components.v1').split('.');
  if (
    segments.some(
      (segment) =>
        !/^[A-Za-z_$][\w$]*$/.test(segment) ||
        ['__proto__', 'prototype', 'constructor'].includes(segment),
    )
  )
    throw new Error('Invalid bridge namespace.');
  // Inspect the entire existing path before creating any object: collisions cannot partially mutate it.
  let parent = target;
  let missing = -1;
  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index]!;
    if (!Object.prototype.hasOwnProperty.call(parent, key)) {
      missing = index;
      break;
    }
    const value = parent[key];
    if (index === segments.length - 1) {
      const existing =
        value && typeof value === 'object'
          ? ((value as Record<symbol, unknown>)[bridgeIdentity] as
              { version?: string; runtime?: RuntimeBridge } | undefined)
          : undefined;
      if (existing?.version === BRIDGE_VERSION && existing.runtime) return existing.runtime;
      throw new Error('Incompatible runtime bridge namespace occupant.');
    }
    if (!value || typeof value !== 'object')
      throw new Error('Incompatible runtime bridge namespace occupant.');
    parent = value as Record<string, unknown>;
  }
  const runtime = createBridge(options);
  // Keep the exported API immutable while permitting duplicate bundled runtime copies to find it.
  const installedApi = { ...runtime.api };
  Object.defineProperty(installedApi, bridgeIdentity, {
    value: Object.freeze({ version: BRIDGE_VERSION, runtime }),
  });
  Object.freeze(installedApi);
  let branch: unknown = installedApi;
  for (let index = segments.length - 2; index >= missing; index -= 1)
    branch = { [segments[index + 1]!]: branch };
  Object.defineProperty(parent, segments[missing]!, {
    value: branch,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  return runtime;
}
