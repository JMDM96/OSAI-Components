# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
