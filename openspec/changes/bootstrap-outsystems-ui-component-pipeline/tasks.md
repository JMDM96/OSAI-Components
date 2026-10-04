# Tasks

## 1. Establish the locked workspace and release policy

- [x] 1.1 Create the root npm workspace, pin the supported Node and npm versions, commit the lockfile, and verify a clean `npm ci` succeeds.
- [x] 1.2 Create the package, target, component, fixture, and browser-harness directories from `design.md`, add workspace metadata and TypeScript project references, and verify `npm query .workspace` discovers every intended workspace.
- [x] 1.3 Configure strict TypeScript with an ES2017 runtime baseline, ESLint, Stylelint, Vitest, Playwright, esbuild, and JSON Schema tooling; add root `lint`, `typecheck`, `test:unit`, `build`, `test:browser`, and `verify` scripts and verify the empty baseline passes.
- [x] 1.4 Add repository ignores and deterministic-build settings for generated output, caches, source maps, path separators, timestamps, and line endings, and verify two clean baseline builds produce the same tracked inputs.
- [x] 1.5 Define and schema-validate `release-policy.json` version 1 with the browser, WCAG 2.2 A/AA, keyboard, viewport, zoom, RTL, reduced-motion, lifecycle, leak, visual, JavaScript-size, CSS-size, CSP, and dependency thresholds from the design; verify valid and invalid policy fixtures pass and fail as expected.
- [x] 1.6 Document workspace setup, the standard root commands, artifact status meanings, and the explicit exclusion of tenant publication in the root README; verify every documented local command runs as written.

## 2. Implement the manifest contract and component SDK

- [x] 2.1 Implement manifest schema version 1 for identity, versions, targets, entries, assets, and contract references, and add fixtures proving missing fields and unsupported schema versions fail with stable paths and codes.
- [x] 2.2 Implement schemas for property access and `live`/`recreate` updates, command arguments/results and synchronous execution, event payloads, theme-token values/defaults, and referenced JSON Schemas; verify defaults and non-JSON public values are validated before compilation.
- [x] 2.3 Implement capability, dependency, external-origin, browser-API, worker, portal, global-style, and asset declarations, and verify observed undeclared capabilities and incomplete external declarations fail fixture tests.
- [x] 2.4 Implement deterministic manifest loading, reference resolution, default application, and canonical normalization, and verify repeated normalization produces byte-identical JSON and ordered diagnostics.
- [x] 2.5 Implement machine-readable contract diagnostics with stable codes, JSON Pointer-compatible paths, scrubbed messages, and aggregate reporting, and verify malformed JSON and multi-error fixtures never leak parser stacks.
- [x] 2.6 Implement the component SDK types for synchronous create, complete-config update, command invocation, event emission, owned host access, managed resources, and disposal; verify a minimal conforming fixture compiles while arbitrary TypeScript and asynchronous command fixtures fail.
- [x] 2.7 Generate or check implementation types from the normalized manifest and implement bidirectional manifest/implementation parity checks; verify missing members, undeclared events, incompatible arguments, and invalid command results fail at the exact contract path.
- [x] 2.8 Implement behavioral conformance helpers for two-instance lifecycle isolation and post-dispose callback/resource detection, and verify deliberately cross-talking and leaking fixtures fail.
- [x] 2.9 Implement CSS contract checks for root scoping, prefixed public tokens, valid defaults, and declared portal/keyframe/font/global exceptions; verify sibling token isolation and undeclared global selector fixtures.
- [x] 2.10 Write the component-authoring guide and a minimal fixture component covering its manifest, schemas, source, styles, validation command, and failure diagnostics; verify the guide's end-to-end example passes conformance.

## 3. Build the versioned runtime bridge

- [x] 3.1 Implement bridge-version-1 response-envelope types, JSON parsing/serialization, schema validation, contract paths, and scrubbed internal errors; verify success, malformed JSON, validation failure, and unexpected-throw unit tests.
- [x] 3.2 Implement the configurable `OSAI.Components.v1` global bootstrap and component registration, and verify exact-version duplicate loads preserve live state while incompatible namespace occupants fail without mutation.
- [x] 3.3 Implement the private instance and container registries with stable string IDs, ownership checks, and component routing, and verify duplicate IDs, claimed containers, unknown IDs, and two-instance isolation.
- [x] 3.4 Implement atomic container-scoped creation with managed DOM and resource rollback, and verify every injected initialization failure leaves no registry entry, owned DOM, listener, callback, or portal and permits retrying the identifier.
- [x] 3.5 Implement complete normalized configuration replacement, default restoration, required/null handling, atomic live updates, and the non-mutating `recreation-required` outcome; verify each branch against state snapshots.
- [x] 3.6 Implement synchronous declared-command invocation with argument and result validation, and verify unknown commands, invalid arguments/results, throws, Promises, and thenables return their specified stable envelopes.
- [x] 3.7 Implement callback registration tokens, unregistration, per-instance asynchronous event queues, payload validation, callback-error isolation, and cancellation on disposal; verify ordered delivery, cross-instance isolation, throwing callbacks, and no post-unsubscribe or post-dispose delivery.
- [x] 3.8 Implement a managed runtime context for listeners, observers, timers, animation frames, workers, portals, focus/background locks, and DOM references plus idempotent defensive disposal; verify repeated disposal and host removal return success with zero instrumented resources.
- [x] 3.9 Document the complete bridge API, envelope codes, lifecycle mapping, full-update semantics, recreation flow, callback behavior, and synchronous-command limitation; verify executable documentation examples against the built bridge.

## 4. Produce deterministic ODC and OS11 distributions

- [x] 4.1 Implement the development ESM and production self-contained global/IIFE build paths with ES2017 output, no code splitting, no unresolved imports, and replaceable bundler configuration; verify both formats load in their intended harnesses.
- [x] 4.2 Implement thin `odc` and `o11-reactive` target profiles with capability matrices, explicit build-time overrides, and rejection of undeclared targets or runtime platform branching; verify a shared component emits both target labels from one revision.
- [x] 4.3 Implement component-isolated tree entry points so a requested package contains only that component plus the approved bridge, and verify sentinel code from an unrelated fixture component is absent from command-palette payloads.
- [x] 4.4 Assemble the versioned target layout with scripts, styles, normalized manifests, schemas, adapters, integration guides, types, checksums, and release metadata, and verify missing or contract-inconsistent files fail packaging.
- [x] 4.5 Generate direct/transitive dependency inventories, SPDX SBOM data, license conclusions, and notices from the lockfile and bundled graph, and verify an incomplete or disallowed dependency blocks readiness.
- [x] 4.6 Implement production scans for dynamic evaluation, inline handlers, unresolved modules, accidental Node APIs, undeclared globals, runtime fetches, and CSP origins/resource types; verify malicious fixtures fail with actionable findings.
- [x] 4.7 Implement byte-level reproducibility checks for unsigned payloads while keeping timestamps, signatures, and attestations separate; verify two clean builds have identical payload checksums.
- [x] 4.8 Implement public-contract diffing, semantic-version enforcement, and an append-only local release-catalog format, and verify breaking changes without a major bump and changed bytes under a registered version are rejected.
- [x] 4.9 Document target capability overrides, artifact anatomy, dependency policy, CSP reports, reproducibility, and internal registration commands; verify each documented inspection command succeeds on a fixture release.

## 5. Generate OutSystems adapter contracts and evidence records

- [x] 5.1 Define and validate `adapter.json` for target support, properties, events, commands, schemas, assets, lifecycle hooks, serialization, and recreation behavior, and verify it cannot drift from the normalized component contract.
- [x] 5.2 Generate distinct ODC and OS11 Reactive/Mobile adapter metadata from one manifest and the target profiles, and verify their public contract is equal while target-specific fields and assets remain independently identifiable.
- [x] 5.3 Generate target integration guides mapping Required Scripts, styles, Block host markup, Ready/Render/Parameters Changed/Destroy, Client Actions, callbacks, error envelopes, and explicit recreate flow; verify all referenced files and contract members exist.
- [x] 5.4 Generate manual Studio instructions and a Mentor-ready recipe without attempting OML editing or publication, and verify the recipe contains no inferred asset/environment IDs and passes its schema.
- [x] 5.5 Define compatibility evidence records for `generated`, `browser-verified`, and `OutSystems-verified` states, including target/platform/environment identity, artifact checksums, policy and suite versions, and measured results; verify elevation without required evidence is rejected.
- [x] 5.6 Document that tenant smoke testing and publication are a later authorized workflow, and verify locally generated releases remain at most `browser-verified` when no tenant evidence is present.

## 6. Implement the command-palette reference component

- [x] 6.1 Create the command-palette manifest, configuration/command/event schemas, theme tokens, empty external-dependency declaration, and SDK implementation skeleton; verify full contract and implementation-parity validation passes.
- [x] 6.2 Implement NFKC-plus-lowercase trimmed substring filtering over labels and keywords with original host ordering, and verify casing, Unicode normalization, keywords, whitespace-only queries, disabled items, duplicates, and no-result unit cases.
- [x] 6.3 Implement light-DOM rendering beneath the owned root with prefixed classes/tokens and text-only handling for every host string, and verify markup-like inputs cannot create elements, attributes, script execution, or sibling style changes.
- [x] 6.4 Implement idempotent `open`, `close`, and `toggle`, fresh-query opening, `opened`/`closed`/`queryChanged` events, prior-focus restoration, and host/body fallback; verify touch/host commands and repeated calls create one surface, listener set, and event sequence.
- [x] 6.5 Implement Arrow wrapping, Home/End, Enter, Escape, disabled-item skipping, scroll-into-view, `aria-activedescendant`, and IME composition handling; verify the complete keyboard table and no-op cases in component tests.
- [x] 6.6 Implement pointer/touch and keyboard selection with one schema-valid `commandSelected` event, activation source, query and instance IDs, default close behavior, and no business-logic execution; verify disabled and rapid duplicate activations emit nothing or exactly once as specified.
- [x] 6.7 Implement atomic live updates that preserve query and eligible active ID, fall back to the first enabled item, and handle an empty command collection without remounting; verify invalid updates retain the entire previous view and state.
- [x] 6.8 Implement opt-in normalized shortcut coordination with earliest-live ownership, contender diagnostics, editable-context exclusion, configuration transfer, and disposal transfer; verify two- and three-instance collision sequences never activate multiple palettes.
- [x] 6.9 Implement named modal-dialog, combobox, listbox, option, live-count, disabled, expanded, relationship, focus-trap, background-lock, and reduced-motion behavior; verify component-level accessibility assertions for open, empty, close, and disposal states.
- [x] 6.10 Implement defensive disposal while open and closed, including DOM, focus/background locks, global shortcuts, listeners, queued events, and subscriptions; verify navigation-style host removal leaves no post-dispose callback or resource.
- [x] 6.11 Document the command-palette contract, configuration, commands, events, tokens, shortcut rules, accessibility behavior, and host-owned selection example; verify all examples validate against its published schemas.

## 7. Exercise generated artifacts in the browser harness

- [x] 7.1 Build a browser harness that loads the exact packaged JS/CSS as Required Scripts and simulates Ready, repeated Render/Parameters Changed, Client Actions, overlapping navigation, host removal, and Destroy; verify the suite fails when any lifecycle call is omitted.
- [x] 7.2 Run the complete command-palette behavior suite against both ODC and OS11 packages in the lockfile-pinned Chromium, Firefox, and WebKit revisions, and verify each target/browser cell reports its artifact checksum and passes.
- [x] 7.3 Add automated WCAG 2.2 A/AA checks plus behavioral tests for keyboard, focus trapping/restoration, live announcements, disabled states, 320 CSS pixel width, 200 percent zoom, RTL, reduced motion, and representative OutSystems theme styles; verify policy-v1 accessibility evidence passes with zero violations.
- [x] 7.4 Add multi-instance, duplicate-bridge-load, shortcut-contention, recreation-required, conditional-render, navigation-overlap, invalid-payload, and callback-failure browser tests, and verify every operation remains instance-isolated and atomic.
- [x] 7.5 Add instrumented leak testing for at least 100 create/update/invoke/dispose cycles, and verify zero remaining registry entries, subscriptions, managed listeners, timers, observers, portals, background locks, and owned roots.
- [x] 7.6 Add visual baselines and policy-controlled comparison for closed, open, query, empty, disabled, grouped, RTL, narrow, zoomed, and reduced-motion states, and verify unapproved pixel differences block the relevant target.
- [x] 7.7 Generate machine-readable gate and compatibility reports from measured schema, test, browser, accessibility, visual, CSP, dependency, size, reproducibility, and leak results, and verify failures include the policy version, gate, threshold, and measured value.
- [x] 7.8 Mark successful local target artifacts `browser-verified` and explicitly not `OutSystems-verified`, and verify the evidence validator refuses the higher status without a named tenant/platform smoke result.

## 8. Wire the integration and release workflow

- [x] 8.1 Add continuous integration for clean install, formatting, lint, type checking, unit tests, contract fixtures, target builds, artifact checks, browser matrices, policy gates, and evidence generation, and verify a representative CI-equivalent local run succeeds from a clean checkout.
- [x] 8.2 Add a command-palette release command that validates the requested version, builds both targets, runs all applicable gates, writes checksums/evidence, and appends the local catalog only on success; verify a forced gate failure leaves no registered release.
- [x] 8.3 Run the release twice from clean workspaces and verify unsigned files are byte-identical, package contracts match across targets, unrelated component code is absent, and all checksums and evidence references resolve.
- [x] 8.4 Run `npm run verify` as the single final local acceptance command and verify it produces complete browser-verified ODC and OS11 command-palette packages while making no tenant, OML, publication, or OutSystems-verified claim.
- [x] 8.5 Update the root release and contribution documentation with the verified commands, artifact paths, support boundaries, known deferred tenant checks, and the path for proposing future components such as a Gantt timeline; verify a new contributor can follow the documented flow using only repository inputs.
