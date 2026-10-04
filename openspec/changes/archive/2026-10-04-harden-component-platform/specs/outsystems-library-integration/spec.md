# Spec Delta

## Purpose

Defines a complete, repeatable handoff from verified browser component artifacts to native OutSystems Library assets, with separately authorized execution and independently recorded host evidence.

## ADDED Requirements

### Requirement: Integration plans are complete and release bound
Generated plans SHALL identify target, component/version, contract and artifact hashes, all resources and dependencies, Block inputs/events, Client Actions, native or JSON type mappings, lifecycle wiring and error behavior. Changing a bound artifact SHALL invalidate the prepared plan.

#### Scenario: Nested values and auxiliary assets are required
- **WHEN** a component uses structured payloads, a worker and an external dependency
- **THEN** the plan provides explicit JSON/native mappings and the complete asset-loading responsibilities without requiring Mentor to infer them

#### Scenario: Package changes after plan generation
- **WHEN** any bound artifact differs from the prepared plan
- **THEN** plan validation rejects execution against that package until the plan is regenerated and reviewed

### Requirement: Native changes are preceded by capability and identity resolution
The integration workflow SHALL inspect live tool capabilities and resolve actual asset/environment identities before proposing native changes. Unsupported Library creation or static-resource transfer SHALL produce a specific manual handoff or blocking prerequisite, not an invented tool operation.

#### Scenario: Only server external-library upload is available
- **WHEN** no supported browser-asset ingestion capability exists
- **THEN** the workflow does not treat a server-side external-library upload as UI resource transfer and documents the required Studio/manual step

#### Scenario: Target identity is unresolved
- **WHEN** an asset or environment cannot be unambiguously resolved
- **THEN** the workflow asks for the missing identity and performs no mutation

### Requirement: Native plans are repeatable and conflict aware
Before mutation, the workflow SHALL classify each planned native asset as create, update, unchanged or conflicting using inspected state and release identity. Reruns SHALL NOT duplicate Blocks, resources or actions, and user-owned conflicts SHALL require a decision before overwrite.

#### Scenario: Same plan is run twice
- **WHEN** read-back shows the same release is already wired correctly
- **THEN** the workflow reports unchanged assets instead of creating duplicates

#### Scenario: Partial failure or conflicting edit exists
- **WHEN** execution stops partway or an existing asset differs unexpectedly
- **THEN** the workflow re-inspects actual state, reports the completed and unresolved work and requests direction before destructive replacement or uncertain retries

### Requirement: Local preparation and tenant operations have separate authority
Local plan generation and simulated integration tests SHALL NOT authenticate, mutate, publish or deploy a tenant. Live execution SHALL require a separate request and authority for the resolved changes, and publication/deployment SHALL require their own explicit authorization.

#### Scenario: Local hardening is applied
- **WHEN** this platform's local implementation and tests complete
- **THEN** the integration checkpoint remains not executed and no tenant state has changed

#### Scenario: Smoke execution needs publication
- **WHEN** an authorized native edit cannot be exercised until publication occurs
- **THEN** the workflow stops at the publication boundary and requests authority rather than treating edit approval as publication approval

### Requirement: Native success is established through read-back and host smoke evidence
OutSystems verification SHALL require independent native read-back and matching create, update, command, event, repeated-render, navigation-overlap and disposal smoke results. Evidence SHALL record target, platform version, asset/environment identity, artifact hashes and suite version; a Mentor success summary alone SHALL NOT qualify a release.

#### Scenario: Mentor reports completion without smoke results
- **WHEN** native editing succeeds but host tests have not run
- **THEN** the release retains its prior readiness and the missing verification is explicit

#### Scenario: First ODC integration passes
- **WHEN** the existing command palette passes read-back and all required smoke cases in an authorized ODC environment
- **THEN** evidence qualifies only that exact release and ODC lane, without promoting O11 or mobile-webview status

### Requirement: Integration diagnostics never retain authentication material
Integration plans, logs, exported diagnostics and committed evidence SHALL exclude OAuth credentials, callback codes and Mentor session tokens. Session material required for tool calls SHALL remain transient and SHALL NOT be substituted with guessed values.

#### Scenario: A tool response contains session credentials
- **WHEN** progress or evidence is recorded from the response
- **THEN** only the necessary non-secret status and identity fields are retained
