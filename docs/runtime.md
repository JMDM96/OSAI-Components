# Runtime bridge v1

Each generated target script installs the same browser API at `OSAI.Components.v1`. The build configuration may change the namespace; component implementations do not contain it. The hardened implementation version is `2.0.0`; the serialized contract version remains `1.0` with the existing host call signatures. Loading the same bridge implementation again preserves component registrations, instances, and callbacks. A different implementation version in the same namespace throws during script loading without replacing existing state; coordinate host upgrades or use isolated documents.

The browser API contains only the operations below. The internal `installBridge()` result also provides `registerComponent(definition)` and `inspect()` for build entry points and tests; hosts never receive a component controller or renderer reference. Component registration validates its manifest and bidirectional implementation metadata before accepting it. Registration of identical metadata is idempotent; conflicting metadata under the same component identifier is rejected.

## Host operations

Every operation returns a JSON string. Identifiers must be nonempty strings. Configuration and command arguments must be JSON strings, even when their decoded value is an empty object.

| Operation                                                    | Result value                          | Purpose                                                                           |
| ------------------------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------- |
| `create(componentId, instanceId, hostElementId, configJson)` | `{ instanceId }`                      | Validate configuration and mount an owned root inside an existing unclaimed host. |
| `update(instanceId, configJson)`                             | `{ instanceId }`                      | Atomically replace the complete normalized configuration.                         |
| `invoke(instanceId, commandName, argumentsJson)`             | Declared command result               | Execute a declared synchronous command.                                           |
| `registerCallback(instanceId, eventName, callback)`          | `{ subscriptionId }`                  | Subscribe a function accepting one serialized event envelope.                     |
| `unregisterCallback(instanceId, subscriptionId)`             | None                                  | Remove a callback, including its eligibility for already queued delivery.         |
| `dispose(instanceId)`                                        | `{ instanceId }`                      | Defensively dispose the instance; repeated calls succeed.                         |
| `getInfo(componentId?)`                                      | Component manifest or bridge snapshot | Inspect contracts and aggregate live resources without revealing controllers.     |

A typical result is:

```json
{
  "contractVersion": "1.0",
  "ok": true,
  "code": "created",
  "message": "The component instance was created.",
  "value": { "instanceId": "palette-one" }
}
```

Errors use the same fields with `ok: false`, a stable `code`, and an optional JSON Pointer `path`. Host code branches on the code and path. It should not parse the human-readable message. Raw exceptions, stacks, file paths, and provider data are never serialized. A configured local diagnostics callback may receive the original cause; failures in that callback cannot interrupt cleanup.

## Lifecycle example

Create a Block container with ID `palette-host`, and load the generated command-palette Required Script and stylesheet first. This complete example executes the same public boundary used by an OutSystems wrapper. It is exercised against an ES2017 bundled bridge and component in `packages/runtime-bridge/src/documentation.test.ts`.

```javascript
const api = OSAI.Components.v1;
function requireSuccess(serialized) {
  const response = JSON.parse(serialized);
  if (!response.ok) throw new Error(response.code + ': ' + response.message);
  return response.value;
}

// Block On Ready: keep only this string identifier in host state.
const instanceId = 'palette-one';
const configuration = {
  commands: [{ id: 'open-orders', label: 'Open orders', keywords: ['sales'] }],
  title: 'Quick actions',
};
requireSuccess(
  api.create('command-palette', instanceId, 'palette-host', JSON.stringify(configuration)),
);
const subscription = requireSuccess(
  api.registerCallback(instanceId, 'commandSelected', (serialized) => {
    const event = JSON.parse(serialized).value;
    // In OutSystems, forward event.payload.commandId to a declared Client Action.
    // Business authorization and execution remain in that host action.
    if (event.instanceId !== instanceId) throw new Error('Unexpected event instance.');
  }),
);

// Parameters Changed: send the whole configuration, retaining desired values.
requireSuccess(api.update(instanceId, JSON.stringify({ ...configuration, title: 'Actions' })));

// Client Actions: v1 commands complete synchronously.
requireSuccess(api.invoke(instanceId, 'open', '{}'));
requireSuccess(api.invoke(instanceId, 'close', '{}'));

// Block On Destroy: unsubscribe is optional when disposing the whole instance.
requireSuccess(api.unregisterCallback(instanceId, subscription.subscriptionId));
requireSuccess(api.dispose(instanceId));
requireSuccess(api.dispose(instanceId));
```

Repeated Render does not call `create` again for a live identifier: the adapter keeps its instance ID, compares normalized input, and sends a full `update` only when needed. A newly rendered Block uses a fresh ID while an older screen is still mounted. On Destroy always calls `dispose`, even if the host DOM has already disappeared.

## Full replacement and recreation

An omitted optional property regains its declared default. An omitted required property fails; `null` is accepted only by schemas declaring it. Updates do not merge with the previous configuration. Registration owns an immutable normalized contract and captured entry points. Configuration supplied to component code is an independent deeply frozen snapshot; event payloads are serialized at emission, so retained aliases cannot change delivery.

Both schema and component semantic checks run before a transaction is prepared. SDK implementations prepare without changing the live view, commit atomically, and restore the previous view in `rollback()` if commit throws. The runtime opens a provisional event/resource transaction before preparation. Preparation, commit and rollback emissions are discarded on failure; previously queued events remain eligible. A successful commit records configuration before publishing its buffered events. New managed allocations are removed on failure; release requests for previously committed resources take effect only after successful commit. Provider rollback must restore its own view/state and retained resource handles.

If a changed property is marked `recreate`, `update` returns `recreation-required` with `/properties/<name>`, leaving the current instance untouched. The adapter then explicitly unregisters callbacks or disposes, calls `create` with the complete next configuration, and registers fresh callbacks. IDs may be reused only after disposal. Normal live updates retain their root, identity, and subscriptions.

## Fault inspection and recovery

A throwing rollback returns `instance-faulted`. The runtime stops delivery, attempts every cleanup, and retains a tombstone in `getInfo().value.faultedInstances`. Its entry contains only `instanceId` and the stable fault code. Later update/invoke calls fail until explicit disposal acknowledges the fault. Cleanup failures remain counted even after acknowledgment; disposal does not assert that a throwing provider released its resources. Siblings remain usable.

Same-instance update, invocation or disposal during an active lifecycle operation returns `operation-in-progress`. Host event callbacks run after commit, outside that transition, and can perform ordinary lifecycle calls. Do not retry a rejected nested call recursively.

This recovery helper runs only when the host has chosen to recreate a faulted instance. Pass the last accepted complete configuration and an existing host container. After successful recreation, register fresh event callbacks. Other errors preserve their result for the host to handle.

<!-- executable: fault-recovery -->

```javascript
function updateWithRecovery(api, componentId, instanceId, hostId, nextJson, acceptedJson) {
  const updated = JSON.parse(api.update(instanceId, nextJson));
  if (updated.code !== 'instance-faulted') return updated;
  const info = JSON.parse(api.getInfo()).value;
  if (!info.faultedInstances.some((entry) => entry.instanceId === instanceId)) {
    throw new Error('Fault inspection did not match the requested instance.');
  }
  const disposed = JSON.parse(api.dispose(instanceId));
  if (!disposed.ok) return disposed;
  return JSON.parse(api.create(componentId, instanceId, hostId, acceptedJson));
}
```

## Events and synchronous commands

The callback receives a JSON envelope whose `value` is `{ instanceId, eventName, payload }`; `payload` follows the event's declared schema. Deliveries are asynchronous and ordered per instance. Only subscriptions active at emission and still active at delivery receive an event. A callback exception is reported as `callback-error` and does not prevent another active callback from receiving it. Unsubscribe and dispose cancel pending deliveries. Events emitted after disposal are ignored.

Command arguments and results are schema-validated. A Promise or thenable returns `unsupported-execution-mode`; v1 never returns a pending result. Asynchronous business work belongs in the host, which supplies resulting state through a later complete update.

## Stable response codes

| Code                                                                                                     | Meaning                                                                             |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `registered`, `created`, `updated`, `invoked`, `subscribed`, `unsubscribed`, `disposed`, `info`, `event` | Successful operation or event.                                                      |
| `invalid-identifier`, `invalid-json`, `validation-error`                                                 | Invalid public input; `path` identifies the failing contract member when available. |
| `unknown-component`, `unknown-instance`, `unknown-command`, `unknown-event`                              | The requested registered entity or declared member does not exist.                  |
| `duplicate-instance`, `missing-container`, `container-claimed`                                           | Creation cannot safely acquire its identifier or host.                              |
| `recreation-required`                                                                                    | A changed property requires explicit disposal and creation.                         |
| `invalid-callback`                                                                                       | Subscription requires a function.                                                   |
| `invalid-command-result`, `unsupported-execution-mode`                                                   | The implementation violated its synchronous command contract.                       |
| `incompatible-component`, `implementation-contract-error`                                                | Registration metadata or lifecycle controller violates the SDK contract.            |
| `internal-error`                                                                                         | Unexpected implementation failure, with scrubbed host details.                      |
| `instance-faulted`                                                                                       | Rollback failed; inspect and explicitly dispose before recreation.                  |
| `operation-in-progress`                                                                                  | A same-instance lifecycle operation is active; the nested operation did not run.    |

Diagnostics additionally include `event-contract-error`, `callback-error`, `cleanup-error`, and `shortcut-conflict`. A diagnostic does not expose its original exception through `getInfo`.

## Managed resources and ownership

The SDK context exposes the host container, an owned child root, an instance ID, event emission, diagnostics, and a resource scope. Components render inside `context.root`; existing children of the host are not removed. Declared portals use `resources.portal`; an undeclared portal is rejected before attachment.

`listen`, `timeout`, `interval`, `animationFrame`, `observer`, `worker`, `portal`, `lockBackground`, and `add` return idempotent cleanup functions. One-shot timers, animation frames, once-listeners, and aborted listeners stop contributing to live counters when completed. Disposal stops events first, calls the component disposer, and releases every managed resource in reverse acquisition order even if a disposer throws. Removed hosts do not prevent cleanup. Components must register resources through this scope; unmanaged browser allocations cannot be inferred from a successful type check and are rejected by conformance tests.

`lockBackground(root)` makes content outside the most recently acquired connected modal inert and hidden from assistive technology. Older open modals stay inert until ownership returns to them. Releasing the last lock restores prior `inert` and `aria-hidden` attribute values.

`context.registerShortcut(shortcut, handler, options?)` accepts modifier-order-independent combinations such as `Ctrl+K`, `Meta+K`, `Mod+K`, and `Alt+Shift+P`. `Mod` means Meta on Apple platforms and Ctrl elsewhere. The earliest live registration owns a normalized shortcut; later registrations receive a diagnostic and optionally `onConflict`, remain contenders, and take ownership when earlier claims are released. One document listener serves all claims. Composition, repeated keydowns, already-handled gestures, and editable origins outside an open owned root are ignored. Eligible gestures prevent their default action before calling the owner.

`getInfo().value` reports `instances` (including fault tombstones), `faultedInstances`, `subscriptions`, `pendingEvents`, and `resources`: live listeners, timers, observers, animationFrames, workers, portals, backgroundLocks, ownedRoots, disposables, and shortcutClaims. These counters describe managed resources and must be checked alongside independent browser observations; zero counters alone cannot establish leak freedom. A managed release that throws remains counted after instance removal because cleanup was not confirmed; other resources are still released. After all instances are successfully disposed, each must be zero.

# Managed work and provider ownership

Profiles are versioned data. The shipped profiles admit at most 8 MiB of UTF-8 JSON,
64 levels of nesting, 1,024 queued events and 64 deliveries per timer turn.
Admission rejects the newest overflowing event with `event-queue-full`; accepted
events retain FIFO order. `json-limit-exceeded` identifies the limit without
including payload values. These bounds are admission limits, not performance claims.

A public command must return its synchronous JSON acknowledgement immediately.
Start asynchronous work with `resources.operation(key, work, complete, failed)`
and emit the manifest's typed completion event from `complete`. A replacement for
the same key cancels the previous generation; different keys are independent.
Work must respect the supplied signal and must not mutate the view or emit from
inside the work promise. Only the guarded completion callback may apply results.
Cancellation suppresses late results even when a provider ignores the signal.
Use the operation's child scope for timers, listeners and worker ownership.

This executable example uses local promises and no network. `scope` is a managed
child scope; `deliver` represents the component's typed completion emission.

<!-- executable: managed-operations -->

```javascript
function startLocal(value) {
  const operation = scope.operation('local', () => Promise.resolve(value), deliver);
  return { accepted: true, generation: operation.generation };
}
startLocal('superseded');
startLocal('current');
await Promise.resolve();
await Promise.resolve();
startLocal('disposed');
scope.dispose();
await Promise.resolve();
await Promise.resolve();
```

An `imperative-provider` profile permits `adoptProvider`. The literal contract
names its allocations and obligations. Register cleanup before a provider can
allocate, including initialization that might throw. Cleanup must be synchronous,
idempotent and complete. Updates must prepare changes without changing the live
view and support rollback. Adoption owns disposal; it does not make an arbitrary
framework transactional or cancel undocumented internal work.

<!-- executable: provider-ownership -->

```javascript
const provider = resources.adoptProvider(
  {
    id: 'local-listener',
    capabilities: ['listeners'],
    partialInitialization: 'register-cleanup-before-allocation',
    update: 'transactional',
    disposal: 'scope',
  },
  (scope) => {
    const handler = () => deliver('provider');
    scope.add(() => document.removeEventListener('local-provider', handler));
    document.addEventListener('local-provider', handler);
    return { ready: true };
  },
);
document.dispatchEvent(new Event('local-provider'));
provider.dispose();
document.dispatchEvent(new Event('local-provider'));
```

The source guard recognizes direct allocations, simple aliases and literal
property access. Use `resources` or `scope` for managed calls, and `scope` or
`owner` for cleanup registration inside an adoption callback. Computed reflection,
provider internals and arbitrary frameworks require independent browser checks;
static scanning is not a hostile-code sandbox. No profile grants network access:
origins must also be declared in the manifest and admitted by the host CSP.
