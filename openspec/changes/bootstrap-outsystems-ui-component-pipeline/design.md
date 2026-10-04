# Design

## Context

The repository is greenfield apart from OpenSpec configuration. The relevant platform seam is a browser script loaded by an OutSystems Block, with host lifecycle actions responsible for initialization, updates, event forwarding, and disposal.

The official `OutSystems/outsystems-ui` repository is the reference architecture: one TypeScript/SCSS source tree emits one JavaScript and CSS bundle per O11 and ODC target; a public namespace hides internal/provider implementations; instances are keyed by string ID; JSON crosses the platform boundary; and target differences are removed at build time. We will adopt those boundaries, not its legacy Gulp implementation or internal APIs.

ODC and OS11 Reactive/Mobile are similar enough to share component source and public contracts, but they are not treated as an indistinguishable deployment target. Separate target packages give us a controlled place for platform-specific metadata, adapters, exclusions, browser targets, and future compatibility changes. Identical core bytes may be reused when the capability matrix shows no difference.

OutSystems OML remains platform-managed. The local pipeline can produce browser assets and adapter metadata, but native Library Blocks must be created in ODC Studio/Service Studio or through a later, explicitly authorized Mentor session.

## Goals / Non-Goals

**Goals:**

- Make contract conformance a hard gate for AI- and human-authored components.
- Keep one implementation and one public contract while producing independently verifiable ODC and OS11 Reactive/Mobile packages.
- Provide a small, stable lifecycle bridge modeled on proven OutSystems UI boundaries.
- Generate enough metadata for documentation, tests, manual adapters, and future Mentor-assisted adapter creation from the same source of truth.
- Prove the complete path with an accessible, themeable command palette.
- Make target and release claims evidence-based rather than inferred from a successful JavaScript build.

**Non-Goals:**

- Converting arbitrary React, Vue, Svelte, or TypeScript projects heuristically.
- Supporting OS11 Traditional Web, legacy Internet Explorer, or native mobile plugins in this change.
- Implementing a Gantt/timeline, general component catalog, or public Forge publication.
- Generating or editing OML binary files locally.
- Requiring Shadow DOM, Custom Elements, ES modules, workers, CDN access, or dynamic imports in the OutSystems runtime baseline.

## Decisions

### 1. Use a workspace with explicit architectural layers

The initial repository will use npm workspaces and a locked toolchain with this logical layout:

```text
packages/
  component-sdk/       Authoring types and lifecycle contract
  contract-schemas/    Manifest and payload schemas
  runtime-bridge/      Global API, registry, responses, events
  build-tools/         Validation, generation, bundling, release checks
  adapter-schema/      Platform-neutral OutSystems adapter description
  targets/
    odc/                ODC build capabilities and adapter mapping
    o11-reactive/       OS11 Reactive/Mobile capabilities and adapter mapping
components/
  command-palette/     First conforming reference component
tests/
  browser-harness/     Host and lifecycle simulation
  fixtures/            Valid and invalid contract examples
dist/                  Generated, untracked release output
```

Dependency direction is `adapter/build tools -> public SDK/bridge -> component implementation -> private providers`; component public contracts never expose provider or renderer types.

Alternatives considered:

- A single application package is simpler initially but makes the SDK, bridge, and generated artifacts hard to version and test independently.
- One repository per component increases release overhead before the contract has stabilized.

### 2. Make `component.manifest.json` the source of public truth

Each component owns a schema-validated manifest plus referenced JSON Schemas. The manifest declares identity, semantic and contract versions, targets, properties, events, commands, theme tokens, capabilities, dependencies, assets, entry points, and adapter mappings. Properties declare access and `live` or `recreate` update behavior; commands declare argument/result schemas and execution mode; events declare payload schemas; theme tokens declare accepted values and defaults. Generated TypeScript types, normalized metadata, documentation, compatibility diffs, and release manifests derive from it.

Component source implements an SDK definition whose types are generated from or checked against the manifest. Drift in either direction fails validation: missing declared members, incompatible types, invalid runtime results, and undeclared emitted members are all errors. Schema versions are explicitly supported by the locked toolchain; an unknown version stops before compilation. Functions, DOM references, renderer instances, and provider-specific values cannot cross the public boundary.

Alternatives considered:

- TypeScript-only declarations are ergonomic for authors but are not directly consumable by adapter generators or non-TypeScript tooling.
- Inferring contracts from implementation makes AI output easy to start but unreliable to govern and version.

### 3. Expose a small versioned bridge and keep instances private

OutSystems target scripts expose `window.OSAI.Components.v1`. `OSAI` is the internal bootstrap default stored in build configuration rather than repeated in component source, so a future product-name decision can regenerate distributions without architectural changes. The bridge provides operations equivalent to:

```text
create(componentId, instanceId, hostElementId, configJson)
update(instanceId, configJson)
invoke(instanceId, commandName, argumentsJson)
registerCallback(instanceId, eventName, callback)
unregisterCallback(instanceId, subscriptionId)
dispose(instanceId)
getInfo(componentId?)
```

Exact TypeScript signatures belong to the SDK, but identifiers and names are strings, configuration and command arguments enter as JSON strings, and responses and events leave as JSON strings. Host callbacks are the only non-JSON boundary value. Operations produce a common serialized envelope containing contract version, success state, stable code, message, optional contract path, and optional value. Unexpected exceptions are scrubbed at the host boundary. The bridge owns a registry of JavaScript instances; OutSystems holds only identifiers.

Bridge contract v1 is deliberately synchronous for create, update, invoke, registration, unregistration, inspection, and disposal. Command handlers returning a Promise fail conformance; asynchronous business work remains in OutSystems and feeds results back through a later full update. A future asynchronous ABI requires a new compatible contract decision rather than an accidental mix of return types.

`update` is complete normalized configuration replacement, not a merge patch. Missing optional values regain their declared defaults, missing required values fail, and `null` is meaningful only when its schema permits it. Validation and application are atomic. Changing a `recreate` property returns `recreation-required` without mutating the instance; the adapter then performs an explicit dispose/create sequence. A failed create rolls back partial DOM, subscriptions, and resources before releasing the identifier.

The adapter lifecycle is:

```text
Block On Ready / first Render  --> create + register callbacks
Parameters Changed / Render    --> update (deduplicated by adapter state)
Block On Destroy               --> dispose
OutSystems Client Action       --> invoke
Component event                --> registered $actions callback
```

Create, update, and dispose must be safe under repeated renders, overlapping old/new screens during navigation, and host DOM removal. A duplicate live instance ID is an error rather than an implicit replacement. Exact-version duplicate bridge loads reuse the registry without resetting it; an incompatible namespace occupant fails visibly.

Alternatives considered:

- Returning live JavaScript objects leaks renderer details and cannot cross the low-code boundary safely.
- One global function per component grows an unstable API and complicates version coexistence.

### 4. Use a root-owned renderer as the compatibility baseline

The SDK gives a component an explicit host element and disposable runtime context. Baseline components render only inside that root, use scoped classes and tokens, and register global resources through context-managed disposables. A declared portal is allowed only when its owner and cleanup strategy are explicit.

Custom Elements, open Shadow DOM, React, or another renderer may be used internally after capability checks, but none is part of the mandatory OutSystems-facing ABI. Framework runtimes must be private and bundled; ambient page React, jQuery, or other globals are prohibited by default.

This preserves a path to standards-based components without making an undocumented platform feature the only integration mechanism.

### 5. Emit separate target packages from one build graph

The build produces a development ESM artifact for local tooling and classic self-contained browser scripts for OutSystems. The initial browser compatibility target is ES2017, matching the conservative target used by the reference OutSystems UI repository. Production OutSystems builds use no code splitting or unresolved dynamic imports.

```text
dist/<component>/<version>/
  odc/
    <component>.js
    <component>.css
    manifest.json
    adapter.json
    schemas/
    integration.md
  o11-reactive/
    <same artifact classes>
  shared/
    types/
    licenses.txt
    sbom.spdx.json
    checksums.sha256
```

ODC and OS11 outputs are created in the same invocation from the same revision. Platform adapters and manifests are always distinct; core JavaScript and CSS may be byte-identical. Target-only code is selected by explicit build entry points or configuration, never scattered runtime platform checks. The compatibility matrix records each divergence and its evidence.

The first implementation will use a classic global/IIFE-compatible output because Required Scripts guarantee ordinary global-scope JavaScript, while ESM and Shadow DOM are not documented integration contracts. The bundler boundary remains replaceable; an actual target spike may add an AMD wrapper without changing component contracts.

Alternatives considered:

- One unlabeled package hides compatibility assumptions and makes later divergence a breaking packaging change.
- Two source trees invite drift and undermine migration parity.
- Copying the reference repository's Gulp/`tsconfig` mutation approach would preserve historical behavior but is unnecessary for a greenfield pipeline.

### 6. Treat CSS and theming as versioned API

Each component emits a separate CSS bundle scoped under an SDK-owned root marker. Public custom properties use the `--osai-<component>-*` prefix and fall back through semantic OutSystems-compatible roles, then safe literal defaults. Internal classes and DOM shape are not public API.

The build checks selector scope, token declarations, contrast, reduced motion, RTL, and visual states. Light DOM is the baseline so application typography and semantic theme tokens can flow naturally; Shadow DOM remains an optional capability-tested renderer detail.

### 7. Bundle private dependencies and declare every exception

Component dependencies are bundled and namespaced by default to avoid global version collisions and manual load ordering. Externalization requires an explicit manifest entry containing version/range, expected global, origin, ordering, licensing, integrity, and CSP requirements.

Production scans reject dynamic evaluation, undeclared network/resource origins, unresolved imports, accidental Node dependencies, and unapproved global writes. Secrets, authorization, and trusted business decisions never reside in the client component.

### 8. Generate adapter metadata; use Mentor only at the platform boundary

`adapter.json` maps contract properties, events, commands, schemas, script/style assets, lifecycle hooks, sync/async behavior, and target support into an OutSystems-neutral description. Human-readable integration instructions are generated alongside it.

When an ODC or OS11 asset and environment are later supplied, Mentor may use these outputs to create or update the native Library Block, Client Actions, Events, Structures, Required Scripts, and lifecycle wiring. Mentor does not compile component source, infer contracts, or become the source of truth. If the MCP cannot transfer large script/CSS assets, those assets are imported through Studio or a separately authorized delivery mechanism before Mentor wires the wrapper.

### 9. Use the command palette as a vertical compatibility test

The reference component has no third-party runtime dependency. It exercises complex JSON input, configuration updates, commands, host callbacks, a global keyboard listener, focus management, filtering, multiple instances, theming, RTL, reduced motion, and disposal.

The host supplies command data and handles the `commandSelected` event; the component never executes application business logic. Its v1 commands are `open`, `close`, and `toggle`. Its events are `opened`, `closed`, `queryChanged`, `commandSelected`, and `error`, with selection identifying the command, query, instance, and keyboard or pointer source. Opening from closed resets the query; repeated open/close calls are idempotent; selection emits once and closes. Host commands remain the primary touch/mobile path.

Search is deterministic and intentionally modest: NFKC-normalize and lowercase the trimmed query, perform substring matching over similarly normalized labels and keywords, and preserve host order for every match. There is no ranking in v1. More sophisticated fuzzy ranking can be proposed later without making it a prerequisite for validating the pipeline.

Shortcuts are opt-in. The runtime bridge keeps one ordered ownership registry: the earliest live registration owns a normalized shortcut, later instances receive `shortcut-conflict` and remain contenders, and ownership transfers on configuration change or disposal. Shortcuts originating in editable controls outside the open palette are ignored. Command updates preserve the current query and active ID when it remains eligible, otherwise they choose the first enabled result. Host strings are rendered with text nodes, never injected HTML.

### 10. Separate generated, browser-verified, and OutSystems-verified status

Local gates include schema validation, strict TypeScript, linting, unit tests, artifact contract tests, accessibility checks, keyboard tests, RTL/theme visual tests, bundle/CSP inspection, size budgets, duplicate-load behavior, multiple-instance isolation, navigation overlap, repeated mount/update/dispose cycles, and leak checks. Browser tests run against the exact Chromium, Firefox, and WebKit revisions pinned by the lockfile using the same generated package a consumer receives.

The browser harness simulates OutSystems lifecycle behavior but does not confer OutSystems-verified status. That status requires a recorded smoke test against a named ODC or OS11 target version. Until tenant asset keys and environments are supplied, the initial release can be generated and browser-verified only.

The repository owns a versioned `release-policy.json`; reports record its version, every threshold, and every measured value. Policy v1 requires:

- zero schema, type, lint, unit, contract, CSP, or dependency-governance failures;
- zero automated accessibility violations mapped to WCAG 2.2 A/AA, plus passing specified keyboard, focus, 320 CSS pixel, 200 percent zoom, RTL, and reduced-motion behaviors;
- the lockfile-pinned Chromium, Firefox, and WebKit suites to pass for both generated target packages;
- at least 100 create/update/invoke/dispose cycles with zero remaining bridge instances, subscriptions, instrumented listeners, timers, observers, portals, or owned roots;
- command-palette target payload budgets of at most 60 KiB gzip for JavaScript including its bridge and 12 KiB gzip for CSS; and
- zero visual-regression pixels outside the explicitly approved baseline tolerance recorded in policy.

The exact policy file, not prose in CI, is authoritative and may change only through review. A threshold change affects future releases and is recorded independently from component SemVer.

## Risks / Trade-offs

- **Target packages could drift** -> Build both from one graph, compare normalized public contracts, and forbid independent source implementations.
- **The browser harness may miss platform behavior** -> Keep evidence levels explicit and require real target smoke tests before claiming OutSystems verification.
- **A global API can collide across versions** -> Use a versioned namespace, idempotent exact-version loading, and visible rejection of incompatible occupants.
- **Light DOM can suffer CSS collisions** -> Enforce root scoping, prefixed classes/tokens, selector linting, and visual tests inside representative OutSystems styles.
- **Bundling dependencies can increase size** -> Apply per-component budgets and permit reviewed externalization for large or licensed providers.
- **JSON boundaries add parsing overhead** -> Keep primitives directly mappable in generated adapters, use JSON for structured payloads, and benchmark large updates.
- **Global shortcuts can conflict** -> Centralize ownership in the runtime bridge, make shortcuts configurable, report collisions, and release ownership on disposal.
- **Mentor may not ingest generated assets** -> Treat asset transfer and wrapper generation as separate steps and preserve manual Studio instructions as a supported fallback.
- **ES2017 may omit a desired browser feature** -> Gate newer APIs through the capability manifest and include deterministic fallbacks or target exclusions.

## Migration Plan

This is a greenfield addition with no existing runtime consumers to migrate.

1. Establish the locked workspace, schemas, SDK, bridge, build graph, and browser harness.
2. Implement and certify the command palette through generated and browser-verified states.
3. When an ODC target is supplied, import the generated assets, create the native adapter, and record the first ODC verification evidence.
4. Repeat the adapter smoke suite in an OS11 Reactive/Mobile target and add only capability-backed target overrides discovered by that test.
5. Publish immutable internal versions; public Forge release remains a future change.

Rollback consists of removing an unconsumed generated release or reverting consumers to their prior Library dependency. The change introduces no persistent user data migration.

## Deferred Integration Inputs

- Tenant asset and environment identifiers are needed only for the later ODC and OS11 smoke tests. They do not change the local pipeline or browser-verified artifacts, and this change must not claim OutSystems-verified status until they are supplied.
- `OSAI` is the configurable internal namespace for this bootstrap. A final public product name is required before an external release, which is outside this change; changing it regenerates target artifacts and requires the normal compatibility review.
