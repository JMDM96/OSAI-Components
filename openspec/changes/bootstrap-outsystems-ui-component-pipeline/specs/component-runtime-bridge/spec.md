# Spec Delta

## Purpose

Defines the stable browser boundary through which OutSystems Blocks create, update, control, observe, and safely dispose component instances.

## ADDED Requirements

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
Component events SHALL be delivered asynchronously through registered host callbacks with schema-valid serialized payloads and the originating instance identifier; registration SHALL return an opaque subscription identifier that can be unregistered.

#### Scenario: Registered events are emitted in order
- **WHEN** one instance emits multiple declared events
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
