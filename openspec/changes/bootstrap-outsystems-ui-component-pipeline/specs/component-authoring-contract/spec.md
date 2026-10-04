# Spec Delta

## Purpose

Defines the mandatory, machine-readable contract that makes TypeScript UI components predictable to validate, package, document, and adapt for OutSystems hosts.

## ADDED Requirements

### Requirement: Component manifest is mandatory
Every component SHALL provide a manifest containing a supported schema version, stable component identifier, semantic version, contract version, supported targets, public contract references, source entry points, capabilities, dependencies, and assets.

#### Scenario: Valid manifest is accepted
- **WHEN** a component manifest contains every required field with valid values
- **THEN** contract validation succeeds and exposes the normalized component metadata

#### Scenario: Incomplete manifest is rejected
- **WHEN** a component is missing its manifest or a required manifest field
- **THEN** validation fails with the field path and an actionable error code

#### Scenario: Unsupported manifest schema is supplied
- **WHEN** a component declares a manifest schema version unsupported by the installed toolchain
- **THEN** validation stops before compilation or packaging and reports the unsupported version

#### Scenario: Declared default violates its schema
- **WHEN** a property or theme token default is not valid under its referenced schema
- **THEN** validation fails at the default's contract path

### Requirement: Public behavior is completely schema-defined
Every public property SHALL declare a JSON Schema, requiredness, default where applicable, access mode, and `live` or `recreate` update mode; every command SHALL declare argument and result schemas plus its supported execution mode; every event SHALL declare its payload schema; and every theme token SHALL declare accepted values and a default.

#### Scenario: Declared contract is internally consistent
- **WHEN** every public property, event, command, and theme token has valid metadata and referenced schemas
- **THEN** validation succeeds and the normalized contract is available for adapter and documentation generation

#### Scenario: Non-serializable boundary is requested
- **WHEN** a public contract requires a function, DOM node, class instance, renderer object, or another non-JSON value
- **THEN** validation fails before any distribution is produced

#### Scenario: Unsupported command execution mode is requested
- **WHEN** a component declares a command execution mode unsupported by bridge contract version 1
- **THEN** validation fails rather than generating an adapter with ambiguous behavior

### Requirement: Manifest and implementation remain in parity
The implemented public surface SHALL contain every manifest-declared property, event, command, and compatible type, and SHALL NOT emit an undeclared public boundary member.

#### Scenario: Declared command is missing
- **WHEN** the manifest declares a command that the component implementation does not provide
- **THEN** conformance fails at that command's contract path

#### Scenario: Implementation exposes an undeclared event
- **WHEN** the implementation attempts to emit an event absent from the manifest
- **THEN** conformance fails and the event is not included in generated adapters

#### Scenario: Command result type differs
- **WHEN** an implemented command returns a value incompatible with its declared result schema
- **THEN** conformance fails at the command result path

### Requirement: Components conform behaviorally to the SDK lifecycle
A component SHALL implement the SDK's synchronous initialization, full-configuration update, command, event, and disposal contract and SHALL isolate more than one concurrently mounted instance.

#### Scenario: Complete lifecycle passes the harness
- **WHEN** a conforming component runs through create, update, invoke, event, and dispose operations for two concurrent instances
- **THEN** every operation matches the contract and neither instance changes or receives events because of operations addressed to the other

#### Scenario: Type-correct implementation leaks resources
- **WHEN** a component has compatible TypeScript signatures but retains owned resources or emits callbacks after disposal
- **THEN** behavioral conformance fails

#### Scenario: Arbitrary source is not silently converted
- **WHEN** TypeScript or framework source does not implement the SDK contract
- **THEN** the pipeline rejects it as non-conforming rather than attempting a heuristic conversion

### Requirement: Runtime capabilities and dependencies are declared
The manifest SHALL declare runtime dependencies, external assets, network origins, workers, browser APIs, portals, global styles, and other host permissions required by the component.

#### Scenario: Observed undeclared capability is detected
- **WHEN** static analysis or the conformance harness observes a runtime external or capability absent from the manifest
- **THEN** the component fails conformance with the observed item identified

#### Scenario: Self-contained component declares no externals
- **WHEN** all runtime dependencies and assets are included in the component distribution
- **THEN** the manifest records an empty external dependency set

#### Scenario: Declared portal is used
- **WHEN** a component renders outside its owned root through an approved portal capability
- **THEN** the manifest identifies the portal surface, owner, accessibility behavior, and cleanup obligation

### Requirement: Styling has a stable and isolated public surface
Each component SHALL scope ordinary selectors to its owned root, prefix public theme tokens, declare each token's accepted values and default, and identify any exceptional portal, keyframe, font, or global rule without exposing internal selectors as API.

#### Scenario: Consumer overrides a public token on one instance
- **WHEN** a host assigns a documented component theme token to one component instance
- **THEN** that instance reflects the override without changing a sibling instance or requiring internal selector knowledge

#### Scenario: Undeclared global style leakage is found
- **WHEN** a component stylesheet contains an undeclared selector or rule that can affect elements outside its owned root or approved portal
- **THEN** conformance validation fails with the offending rule identified

### Requirement: Conformance results are deterministic
Running validation against the same normalized sources, manifest, schemas, and locked toolchain SHALL produce the same outcome and machine-readable diagnostics.

#### Scenario: Validation is repeated
- **WHEN** the same component revision is validated twice with the same toolchain version
- **THEN** both runs report the same success state, error codes, contract paths, and normalized contract
