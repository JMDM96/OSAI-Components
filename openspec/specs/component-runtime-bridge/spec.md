# component-runtime-bridge Specification

## Purpose

Defines the stable browser boundary through which OutSystems Blocks create, update, control, observe, and safely dispose component instances.

## Requirements

### Requirement: The bridge exposes a versioned global API
An OutSystems distribution SHALL expose one collision-resistant, versioned browser-global API supporting create, full-configuration update, synchronous command invocation, callback registration and unregistration, inspection, and disposal.

#### Scenario: Required Script finishes loading
- **WHEN** an ODC or supported OS11 page loads the component distribution as a Required Script
- **THEN** the declared global API version is available before its consuming Block initializes

#### Scenario: Compatible bridge is loaded again
- **WHEN** an exact compatible bridge version already occupies the global namespace
- **THEN** the new distribution reuses and extends that bridge without resetting live instances or callbacks

#### Scenario: Incompatible global already exists
- **WHEN** the requested global namespace is occupied by an incompatible bridge version
- **THEN** loading fails visibly without replacing the existing API or changing its instances

### Requirement: The public data boundary is serialized and validated
Component identifiers, instance identifiers, host element identifiers, event names, and command names SHALL be strings; configuration and command arguments SHALL enter as JSON strings; and operation results and event payloads SHALL leave as JSON strings in the declared schemas. Host callbacks are the only non-JSON boundary value.

#### Scenario: Malformed configuration JSON is supplied
- **WHEN** create or update receives JSON that cannot be parsed
- **THEN** it returns a stable validation envelope without creating or mutating an instance and without exposing a raw exception

#### Scenario: Parsed data violates its schema
- **WHEN** configuration or command arguments parse successfully but violate the declared schema
- **THEN** the operation is rejected atomically with the failing contract path

### Requirement: Instances are addressed by stable string identifiers
The bridge SHALL maintain private instance references and SHALL let the host address instances only through component and instance identifiers.

#### Scenario: Multiple instances coexist
- **WHEN** two instances of the same component are created with different identifiers
- **THEN** updates, commands, events, callback subscriptions, and disposal are routed only to the addressed instance

#### Scenario: Duplicate live identifier is requested
- **WHEN** creation uses an identifier already owned by a live instance
- **THEN** creation fails with a duplicate-instance error and leaves the existing instance unchanged

### Requirement: Creation is container-scoped and atomic
Creating an instance SHALL require an existing unclaimed host container and validated configuration, SHALL modify only owned DOM or declared portals, and SHALL commit the registry entry only after successful initialization.

#### Scenario: Valid instance is created
- **WHEN** the host supplies an existing unclaimed container and valid configuration
- **THEN** the component mounts within that container and returns a successful serialized response

#### Scenario: Container is unavailable
- **WHEN** the supplied container cannot be found or is already owned by an incompatible live instance
- **THEN** creation fails without modifying unrelated DOM

#### Scenario: Initialization fails after setup begins
- **WHEN** component initialization throws or reports failure after allocating owned resources
- **THEN** the bridge removes partial DOM, listeners, portals, callbacks, and registry state so the same identifier can be retried

### Requirement: Updates atomically replace normalized configuration
Bridge version 1 SHALL treat update input as the complete next configuration, not as a merge patch. Omitted optional properties SHALL resolve to declared defaults, omitted required properties SHALL fail validation, explicit `null` SHALL be accepted only when allowed by schema, and a valid live update SHALL retain instance identity.

#### Scenario: Live configuration replaces the prior configuration
- **WHEN** the host supplies a complete valid configuration whose changed properties are all marked `live`
- **THEN** the addressed instance atomically adopts the normalized configuration and retains its identity and event bindings

#### Scenario: Invalid update is supplied
- **WHEN** any part of an update violates the component contract
- **THEN** no part of the update is applied and the last valid instance state remains active

#### Scenario: A recreation-required property changes
- **WHEN** valid next configuration changes a property marked `recreate`
- **THEN** update returns the stable `recreation-required` code and leaves the instance unchanged until the host explicitly disposes and creates it

### Requirement: Commands return serialized synchronous outcomes
Invoking a declared bridge-version-1 command SHALL complete synchronously with a schema-valid serialized response and SHALL reject undeclared commands, invalid arguments, invalid result values, and asynchronous handlers predictably.

#### Scenario: Command succeeds
- **WHEN** the host invokes a declared synchronous command with valid arguments
- **THEN** the bridge returns a successful response containing any declared result value

#### Scenario: Unknown command is invoked
- **WHEN** the host invokes a command absent from the component contract
- **THEN** the bridge returns a stable unknown-command error

#### Scenario: Command returns a Promise
- **WHEN** a bridge-version-1 command handler returns a Promise or thenable
- **THEN** invocation fails with an unsupported-execution-mode error rather than returning an ambiguous result

### Requirement: Event subscriptions have deterministic lifecycles
Accepted component events SHALL be delivered asynchronously through registered host callbacks with schema-valid serialized payloads and the originating instance identifier; registration SHALL return an opaque subscription identifier that can be unregistered. Admission and delivery SHALL honor the declared finite event limits without silently losing an accepted event.

#### Scenario: Registered events are emitted in order
- **WHEN** one instance emits multiple declared events within its admission limits
- **THEN** its active subscriptions receive them in emission order and subscriptions for other instances receive none

#### Scenario: Invalid event payload is produced
- **WHEN** an emitted payload violates its declared schema
- **THEN** the bridge reports the contract violation and does not forward malformed data to the host

#### Scenario: Host callback throws
- **WHEN** one registered callback throws while handling an event
- **THEN** the bridge reports a scrubbed callback error and continues delivering to other active subscriptions

#### Scenario: Subscription is removed or instance is disposed
- **WHEN** a callback is unregistered or its instance is disposed
- **THEN** no later event is delivered to that callback

#### Scenario: Event queue capacity is exceeded
- **WHEN** accepting another event would exceed the active profile's queue limit
- **THEN** the newest event is rejected with a stable scrubbed diagnostic, previously accepted events remain ordered, and delivery yields after the configured batch limit

### Requirement: Disposal is symmetric, idempotent, and defensive
Disposal SHALL release listeners, observers, timers, animation frames, workers, portals, callbacks, owned DOM references, and registry entries, even if the host DOM was already removed.

#### Scenario: Host destroys a mounted Block
- **WHEN** the adapter disposes the corresponding instance
- **THEN** all owned resources are released, a successful disposed response is returned, and the identifier becomes available for reuse

#### Scenario: Disposal is repeated after DOM removal
- **WHEN** disposal is called more than once or after the container has disappeared
- **THEN** the operation returns an idempotent success without affecting another instance

### Requirement: Every operation uses a stable and scrubbed response envelope
Every bridge operation SHALL return a serialized envelope containing contract version, success state, stable code, human-readable message, and optional schema-valid value; expected and unexpected failures SHALL use the envelope and SHALL NOT expose stacks, source paths, secrets, or provider internals.

#### Scenario: Host parses a documented error
- **WHEN** an operation fails for a documented reason
- **THEN** the host can branch on its stable code and contract path without parsing message text

#### Scenario: Unexpected implementation failure occurs
- **WHEN** component or provider code throws an unexpected value
- **THEN** the host receives a stable internal-error envelope and implementation details remain available only to configured local diagnostics

### Requirement: Registered contracts and committed values cannot drift through aliases
The runtime SHALL own immutable normalized registration metadata and independent committed configuration and event payload snapshots. Mutating objects supplied at registration or retained by a component SHALL NOT change validation, inspection or queued delivery contracts.

#### Scenario: Caller mutates its manifest after registration
- **WHEN** the registering code changes a property schema, default or command contract after successful registration
- **THEN** subsequent creation, validation and inspection use the originally registered contract

#### Scenario: Component mutates a retained payload reference
- **WHEN** a component changes an object after emitting it or receiving normalized configuration
- **THEN** queued host payloads and the runtime's committed configuration remain unchanged

### Requirement: Failed update transitions suppress provisional effects
The runtime SHALL buffer events and provisional managed resources from before update preparation until successful commit. Preparation or commit failure SHALL discard transition events and provisional work while preserving previously accepted events and the last committed configuration whenever rollback succeeds.

#### Scenario: Preparation emits and throws
- **WHEN** preparation emits a valid event and then throws
- **THEN** the update fails, no event from that preparation reaches the host, and pre-existing queued events remain eligible for delivery

#### Scenario: Commit fails and rollback emits
- **WHEN** commit throws and rollback restores the old state while emitting another event
- **THEN** neither commit nor rollback emissions reach the host and provisional resources are released

#### Scenario: Successful update publishes its events
- **WHEN** preparation and commit complete successfully
- **THEN** the new configuration becomes committed before that transition's events are delivered

### Requirement: Unrecoverable transitions fault only the affected instance
Rollback failure SHALL put the affected instance into an inspectable faulted state, cancel its pending delivery and work, and attempt all cleanup. Update and invoke SHALL reject that instance with a stable fault code until explicit disposal; other instances SHALL remain usable.

#### Scenario: Rollback also fails
- **WHEN** a failed commit is followed by a throwing rollback
- **THEN** the result reports `instance-faulted`, later commands cannot use the corrupted instance, and inspection exposes only scrubbed fault information

#### Scenario: Host acknowledges the fault
- **WHEN** the host explicitly disposes a faulted instance and later creates a replacement
- **THEN** disposal is defensive and idempotent, the identifier is reusable, and unresolved cleanup findings remain observable to certification

### Requirement: Reentrant transitions are rejected predictably
The runtime SHALL reject a same-instance lifecycle mutation attempted during an active transition with `operation-in-progress`, without corrupting the outer transition or affecting another instance.

#### Scenario: Component reenters update during commit
- **WHEN** a component attempts another update or disposal of its own instance before the outer transition ends
- **THEN** the nested operation fails predictably and cannot partially mutate the outer transition

### Requirement: Managed asynchronous work respects scope and generation
Managed operations SHALL expose cancellation and generation identity, cancel superseded operations for the same key, and suppress stale or post-disposal completions. Failed transitions SHALL cancel only provisional work; public commands SHALL retain synchronous JSON results.

#### Scenario: Older work resolves after its replacement
- **WHEN** a keyed operation is superseded and the older operation subsequently completes
- **THEN** only the current generation can change the view or emit its declared completion event

#### Scenario: Instance is disposed during work
- **WHEN** disposal occurs before an operation resolves or rejects
- **THEN** cancellation is signaled, late results cannot affect state or callbacks, and rejection handling produces no unhandled exception

#### Scenario: Replacement update fails
- **WHEN** an update starts provisional work but fails before commit
- **THEN** that provisional work is canceled and previously committed work is not superseded by the failed update

### Requirement: Public JSON work is bounded by a declared profile
The runtime SHALL enforce finite profile-defined byte and nesting limits for input and output JSON before admitting operations or events, and SHALL report stable limit diagnostics without exposing payload values or partially changing state.

#### Scenario: Configuration exceeds a resource limit
- **WHEN** a configuration exceeds its admitted byte or nesting limit
- **THEN** create or update fails with the limit identified and no instance mutation occurs

#### Scenario: High-volume producer exceeds an event payload limit
- **WHEN** an emitted event is schema-valid but exceeds the declared payload limit
- **THEN** it is rejected without enlarging the pending event queue
