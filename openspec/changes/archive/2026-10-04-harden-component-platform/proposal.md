# Proposal

## Why

The bootstrap verifies the command palette, but it does not yet establish a reusable safety and certification boundary for arbitrary AI- or human-authored components. The audit reproduced failed-update event delivery, unmanaged-listener leaks invisible to resource counters, and mutable registered contracts, and found palette-specific verification and incomplete auxiliary-asset and native-adapter coverage.

## What Changes

- Harden runtime registration, update transactions, failed rollback handling, resource ownership, managed asynchronous work, and bounded event delivery while retaining the synchronous JSON browser bridge.
- **BREAKING (authoring and certification):** require schema-derived implementation bindings, component-selected certification scenarios and reviewed capability/performance profiles; old source and test declarations require migration. Existing host create/update/invoke/callback/dispose signatures remain supported.
- Make discovery, scaffolding, build, preview, verification, and release operate on a selected component without editing platform source or borrowing command-palette evidence.
- Certify small infrastructure fixtures that exercise asynchronous cancellation, workers, portals, provider cleanup and large-data limits; do not build another product component.
- Compile and inspect every executable asset, resolve packaged resource URLs explicitly, and generate complete dependency/asset handoff metadata.
- Replace misleading preview navigation with a manifest-driven development workbench containing real component selection and bounded activity inspection.
- Add repository-specific authoring, certification, and OutSystems-integration skills backed by enforceable checks and documented durable contracts.
- Prepare a hash-bound, repeatable Mentor integration plan and validation protocol using the existing command palette. Live tenant access, native mutation, smoke execution and publication remain separately authorized follow-up work, not implied by applying this local change.

## Capabilities

### New Capabilities

- `component-certification`: Component-selected, capability-driven certification with independent observations, adversarial fixtures and measured limits.
- `component-workbench`: Local component discovery, configuration/command controls and observable activity using packaged artifacts.
- `component-ai-workflows`: Repository authoring, certification and integration guidance with executable acceptance checks and explicit authority boundaries.
- `outsystems-library-integration`: Complete native integration plans, repeatable Mentor handoff, read-back verification and separately gated platform evidence.

### Modified Capabilities

- `component-authoring-contract`: Schema-derived authoring types, explicit supported capability profiles and managed provider/resource contracts.
- `component-runtime-bridge`: Immutable registration, transaction-wide failure isolation, bounded asynchronous work and defensively observable cleanup.
- `component-distribution`: Component-selected builds and releases, complete executable asset graphs, adapter resource mappings and profile-bound evidence.

These three existing capability paths currently live in the completed, unarchived `bootstrap-outsystems-ui-component-pipeline` change; the durable spec inventory is empty. This change depends on synchronizing that completed baseline before its deltas are applied or merged. Planning does not synchronize or archive the bootstrap, alter its artifacts, or claim its browser evidence establishes platform verification.

## Impact

- Affects the SDK, schema/type generator, runtime bridge, adapter schemas, build/security/verification tools, browser harness, fixtures, release policy, CI, authoring documentation and future repository skills.
- Keeps one shared component implementation for ODC and O11 Reactive/Mobile, with target-specific metadata and evidence. Target-specific code requires a demonstrated platform difference.
- Existing release bytes and catalog entries remain immutable. Changed outputs require new versions; evidence remains tied to exact component, assets, suite and policy/profile versions.
- Local completion establishes hardening and browser evidence only. Actual ODC readiness remains a separate acceptance milestone requiring available tools, resolved identities, authorization and host tests; O11 host verification follows independently.
- Excludes Gantt/timeline development, additional product widgets, arbitrary-code sandboxing, arbitrary framework support, runtime server-side business logic, OS11 Traditional Web, public publication and a hosted component marketplace.
