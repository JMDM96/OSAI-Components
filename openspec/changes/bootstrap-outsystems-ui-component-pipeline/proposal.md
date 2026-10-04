# Proposal

## Why

OutSystems teams need a repeatable way to turn AI- or human-authored TypeScript UI components into governed, reusable ODC and OS11 assets without rebuilding each component by hand. A strict authoring contract and deterministic build pipeline will make sophisticated web UI practical while preserving OutSystems lifecycle, security, theming, accessibility, and maintainability expectations.

## What Changes

- Introduce a mandatory component SDK and manifest contract; arbitrary TypeScript or framework projects are not accepted until they conform to that contract.
- Add a deterministic pipeline that validates, tests, bundles, documents, and versions components from one shared source tree.
- Produce target-labelled ODC and OS11 Reactive/Mobile distributions from the shared implementation, allowing build-time divergence only where the platform capability matrix requires it.
- Add a stable OutSystems browser bridge with instance registration, serialized configuration and responses, event forwarding, commands, and symmetric create/update/dispose behavior.
- Define generated adapter metadata and integration guidance suitable for native OutSystems Library Blocks and later Mentor-assisted setup.
- Add a command palette as the first reference component and end-to-end compatibility test.
- Add release gates for accessibility, CSP compatibility, dependency governance, bundle size, multiple instances, rerendering, navigation overlap, and cleanup.
- Defer Gantt/timeline functionality, arbitrary source conversion, OS11 Traditional Web support, public Forge publication, and general-purpose component catalog expansion.

## Capabilities

### New Capabilities

- `component-authoring-contract`: Defines the SDK, manifest, supported inputs, events, commands, styling surface, and conformance validation required of every component.
- `component-runtime-bridge`: Defines the stable runtime API and lifecycle/event boundary between generated browser components and OutSystems Blocks.
- `component-distribution`: Defines reproducible ODC and OS11 target artifacts, compatibility evidence, release metadata, and quality gates.
- `command-palette`: Defines the functional, interaction, accessibility, and integration behavior of the initial reference component.

### Modified Capabilities

None.

## Impact

- Establishes the initial TypeScript workspace, component SDK, schemas, build tooling, test harnesses, and release layout.
- Introduces a versioned browser-global API and generated metadata intended for ODC and OS11 Reactive/Mobile Library adapters.
- Uses OutSystems UI as a reference architecture for target builds, instance identity, provider isolation, serialized boundaries, lifecycle cleanup, and CSS token layering without coupling this project to its internal implementation.
- Requires Node-based development tooling and browser automation dependencies; runtime dependencies must be bundled or explicitly declared and governed.
- Actual ODC/OS11 asset creation and publication require a supplied tenant asset and environment and remain a separate, explicitly authorized integration step.
