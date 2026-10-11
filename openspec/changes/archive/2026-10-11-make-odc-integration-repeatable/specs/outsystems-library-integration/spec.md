# Spec Delta

## MODIFIED Requirements

### Requirement: Integration plans are complete and release bound

Generated plans SHALL identify target, component/version, contract and artifact hashes, all resources and dependencies, Block inputs/events, Client Actions, native or JSON type mappings, lifecycle wiring and error behavior. ODC plans SHALL additionally identify public and private elements and provide exact executable glue with native parameter and resource bindings for the supported template. Changing a bound artifact or template SHALL invalidate the prepared plan.

#### Scenario: Nested values and auxiliary assets are required

- **WHEN** a component uses structured payloads, a worker and an external dependency
- **THEN** the plan provides explicit JSON/native mappings and the complete asset-loading responsibilities without requiring Mentor to infer them

#### Scenario: Package changes after plan generation

- **WHEN** any bound artifact differs from the prepared plan
- **THEN** plan validation rejects execution against that package until the plan is regenerated and reviewed

#### Scenario: ODC callbacks are generated

- **WHEN** an ODC plan maps declared component events
- **THEN** it uses Block-private callback registration with positional Text payload forwarding and does not require a public ClientAction-reference input

#### Scenario: Generated glue violates the browser boundary

- **WHEN** a candidate wrapper passes an object instead of serialized configuration, adds an unsupported bridge argument, or forwards an event using the wrong native parameter convention
- **THEN** executable contract checks reject it even when its plan digest matches the generator

#### Scenario: Consumer controls address an instance

- **WHEN** a generated consumer command targets one of two component instances
- **THEN** its supplied Block root determines the instance and an absent or ambiguous instance fails visibly without using a global first match

#### Scenario: Historical or unknown plan format is supplied

- **WHEN** a plan predates the executable ODC contract or declares an unknown format
- **THEN** historical inspection cannot grant the new readiness level and unknown formats are rejected without rewriting the plan or its bound package

### Requirement: Native plans are repeatable and conflict aware

Before mutation, the workflow SHALL classify each planned native asset as create, update, unchanged or conflicting using complete inspected content, established ownership, prior applied state and release identity. Desired fingerprints alone SHALL NOT establish observed state. Reruns SHALL NOT duplicate Blocks, resources or actions, and user-owned or unexpectedly changed content SHALL require a decision before overwrite.

#### Scenario: Same plan is run twice

- **WHEN** read-back shows the same release is already wired correctly
- **THEN** the workflow reports unchanged assets instead of creating duplicates

#### Scenario: Partial failure or conflicting edit exists

- **WHEN** execution stops partway or an existing asset differs unexpectedly
- **THEN** the workflow re-inspects actual state, reports the completed and unresolved work and requests direction before destructive replacement or uncertain retries

#### Scenario: State contains only desired fingerprints

- **WHEN** a supplied snapshot repeats expected fingerprints without the required inspected source, mappings and identity evidence
- **THEN** reconciliation remains read-back-required and cannot report the native implementation unchanged

#### Scenario: User edits an integration-owned element

- **WHEN** observed content differs from its last confirmed applied state without an accounted-for integration operation
- **THEN** the element is conflicting even if it retains an integration ownership marker

#### Scenario: Resource bytes have not been independently established

- **WHEN** a Script resource exists but no independently captured content-byte evidence is available
- **THEN** its mapping can be reported as observed while byte identity remains unverified and an all-assets-unchanged claim is withheld

#### Scenario: Observed native state is unchanged but package identity differs

- **WHEN** inspected mappings and captured served bytes match their previously reviewed native snapshot but the served bytes differ from the qualified package
- **THEN** the workflow reports that native state as unchanged relative to the snapshot and separately retains the failed exact-package comparison

### Requirement: Native success is established through read-back and host smoke evidence

OutSystems verification SHALL require independent native read-back and matching create, update, command, event, repeated-render, navigation-overlap and disposal smoke results. Evidence SHALL record target, platform version, asset/environment identity, artifact hashes and suite version; a Mentor success summary alone SHALL NOT qualify a release. Required read-back SHALL enumerate exact source, signatures, mappings and lifecycle branches with revision provenance and explicit missing or conflicting entries.

#### Scenario: Mentor reports completion without smoke results

- **WHEN** native editing succeeds but host tests have not run
- **THEN** the release retains its prior readiness and the missing verification is explicit

#### Scenario: First ODC integration passes

- **WHEN** the existing command palette passes read-back and all required smoke cases in an authorized ODC environment
- **THEN** evidence qualifies only that exact release and ODC lane, without promoting O11 or mobile-webview status

#### Scenario: A source request receives only a rule summary

- **WHEN** a required native JavaScript element is returned as prose or an assurance rather than source
- **THEN** its source review remains incomplete regardless of the reported native validation count

#### Scenario: Read-back snapshots disagree

- **WHEN** source and wiring observations refer to conflicting content or unreconciled revisions
- **THEN** they cannot be combined into a verified implementation and the affected entries require fresh inspection

## ADDED Requirements

### Requirement: Manual resource transfer has an observable completion boundary

The workflow SHALL distinguish ingestion capability from resource-transfer completion. Unsupported automated ingestion SHALL yield an exact manual handoff with files, hashes, destinations and required read-back. Inspected completion through that route SHALL permit dependent authorized native work when its other prerequisites pass; document attachment success alone SHALL NOT complete transfer.

#### Scenario: Manual import succeeds without an upload tool

- **WHEN** an authorized user imports the planned resources and inspection confirms their identities and mappings
- **THEN** transfer is recorded as completed manually, byte identity is reported separately, and automated-ingestion absence does not keep supported Mentor work blocked

#### Scenario: Imported resource belongs to another package

- **WHEN** read-back establishes a conflicting resource identity or mapping
- **THEN** the dependent step remains blocked and the discrepancy is reported without replacing user content automatically

### Requirement: Integration run records are portable and evidence bound

The workflow SHALL export and validate a versioned, redacted run record with package/plan identities, native keys and revisions, scoped authorization references, operation outcomes, attempts, unresolved work and an evidence inventory. Evidence paths SHALL be relative and content hashed. Missing attachments, identity conflicts or changed contents SHALL invalidate dependent conclusions while preserving historical observations.

#### Scenario: Work resumes on another machine

- **WHEN** the record and its evidence bundle are opened in a fresh context
- **THEN** the workflow verifies their bindings, identifies the correct native assets and next permitted step, and requires fresh observations for expired connection state or interrupted mutations

#### Scenario: Only the summary travels

- **WHEN** a record references evidence that was not transferred
- **THEN** it reports the missing files and cannot treat their summarized conclusions as complete read-back

#### Scenario: An export contains authentication material

- **WHEN** input includes credentials, session handles, signed private URLs or authentication callback data
- **THEN** the exporter excludes them before persistence and rejects evidence that cannot be safely exported without misrepresenting its completeness

### Requirement: Served asset identity preserves exact comparisons

Native records SHALL retain qualified and observed resource hashes separately and report byte identity as exact, mismatched or unverified. A diagnostic transformation comparison SHALL NOT change the original bytes or satisfy exact identity. Runtime success SHALL NOT override a mismatch or promote package readiness.

#### Scenario: Hosting adds a UTF-8 marker

- **WHEN** served JavaScript equals the qualified file only after removing a UTF-8 BOM
- **THEN** evidence reports the original mismatch and the bounded BOM-only finding while exact identity remains failed

#### Scenario: No consumer response has been observed

- **WHEN** imported resources exist but their actual served bytes are unavailable
- **THEN** served identity remains unverified rather than being inferred from model presence or a library URL

### Requirement: Preview verification uses explicit repeatable cases

The ODC handoff SHALL include a versioned preview sequence with named cases, preconditions, native entry points, observable expectations and per-case results. It SHALL cover mounting, configuration acceptance and rejection, declared commands/events, repeated renders and navigation/disposal. Form rejection SHALL NOT substitute for bridge rejection. Preview results SHALL remain separate from native qualification.

#### Scenario: Modal behavior makes page controls inert

- **WHEN** a command opens a modal and disables the surrounding demo controls
- **THEN** the sequence uses a prearranged native action sequence to exercise close and toggle-to-close without disabling modal accessibility behavior or substituting direct bridge calls

#### Scenario: Sample validation intercepts an invalid input

- **WHEN** the sample rejects malformed input before invoking the native update path
- **THEN** only the form-validation case is satisfied and bridge rejection, error forwarding and recovery retain their own results

#### Scenario: A smoke case has not run

- **WHEN** a named case lacks an observed result or required context
- **THEN** it remains not-executed or blocked, and aggregate passing counts cannot make the sequence complete

#### Scenario: Preview works with an identity mismatch

- **WHEN** the observed component passes the preview sequence but served bytes differ from the package
- **THEN** the record can report a working preview with that limitation and cannot report exact-package or OutSystems verification
