# Spec Delta

## ADDED Requirements

### Requirement: Generated types bind the implementation to its schema
The authoring workflow SHALL generate and enforce component-specific configuration, command and event types from the normalized contract before compilation. Runtime validation SHALL remain authoritative for schema constraints that cannot be represented statically.

#### Scenario: Wrong command or event shape is implemented
- **WHEN** typed component source omits a declared command, adds an undeclared command, emits an unknown event, or supplies an incompatible argument, result or event payload
- **THEN** the authoring typecheck fails at that member rather than accepting a generic JSON signature as conformance

#### Scenario: Schema constraint exceeds static type expressiveness
- **WHEN** a value satisfies generated types but violates a numeric bound or cross-field runtime constraint
- **THEN** runtime validation still rejects the value with a contract-path diagnostic

### Requirement: Host inputs and normalized configuration have distinct types
Generated host-input types SHALL reflect requiredness, defaults and access modes. Generated implementation configuration SHALL describe complete normalized values as deeply read-only, and generation SHALL NOT erase nullable or structured schema semantics.

#### Scenario: Defaulted input is omitted
- **WHEN** an author omits an optional defaulted property from host input
- **THEN** the input type accepts the omission and the implementation type exposes its normalized defaulted value

#### Scenario: Implementation mutates configuration or host sets a read-only input
- **WHEN** typed source attempts either operation
- **THEN** typechecking rejects it and runtime boundary checks remain in force

### Requirement: Authoring bindings are reproducible and checked for drift
The workflow SHALL detect stale generated bindings and SHALL reproduce the same bindings from the same normalized contract and generator version without requiring manual edits to generated files.

#### Scenario: Manifest changes without regeneration
- **WHEN** a contract change makes checked-in or cached bindings stale
- **THEN** the check-only authoring gate fails with a regeneration instruction

### Requirement: Supported capability profiles are explicit
Every certifiable component SHALL declare a supported capability profile and its component-specific scenarios. Unsupported capability combinations SHALL fail explicitly; an author SHALL NOT gain certification by omitting required scenarios or choosing an unrelated profile.

#### Scenario: Worker capability is absent from the profile
- **WHEN** a component declares or uses a worker but selects a profile without worker coverage
- **THEN** certification rejects the mismatch before assigning readiness

#### Scenario: Public member has no behavior scenario
- **WHEN** a declared command or event lacks an executable scenario and any necessary reachability setup
- **THEN** certification fails with the missing member identified

### Requirement: Providers and resources have accountable ownership
Component allocations SHALL use managed ownership or an explicitly reviewed provider boundary. Provider boundaries SHALL declare partial-initialization cleanup, update, disposal and capability obligations; a provider exception SHALL NOT exempt the component from resource or isolation gates.

#### Scenario: Unmanaged allocation bypasses the SDK
- **WHEN** component source directly allocates an unmanaged listener, timer, observer, worker or portal outside an approved boundary
- **THEN** authoring or certification rejects the allocation

#### Scenario: Provider initializes partially and fails
- **WHEN** a provider allocates DOM or resources and then fails initialization
- **THEN** its ownership boundary releases the allocations and independent conformance verifies that no effects remain
