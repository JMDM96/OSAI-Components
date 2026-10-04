# Tasks

## 1. Establish the durable baseline and compatibility boundaries

- [x] 1.1 Use the OpenSpec sync workflow to promote the completed bootstrap specifications without archiving the change; verify all four baseline capabilities appear in `openspec list --specs` and strict validation no longer reports this change's missing runtime baseline.
- [x] 1.2 Record the authoring, adapter, evidence and policy format migration rules in the relevant developer documentation; verify they preserve existing host call signatures, identify breaking authoring requirements and prohibit overwriting registered 1.0.0 payloads.
- [x] 1.3 Add versioned schema tests for component certification descriptors and capability profiles, including finite limits, required scenarios and format compatibility; verify unknown versions, empty mandatory coverage and invalid numeric bounds are rejected.

## 2. Repair registration and update transaction guarantees

- [x] 2.1 Add isolated regression tests for post-registration manifest mutation, preparation-event delivery on failure and an unmanaged listener surviving zero managed counters; verify they reproduce the audit's failures before the corresponding fixes and keep the leak test as a negative certification fixture.
- [x] 2.2 Capture immutable normalized contracts and implementation entry points, plus independent configuration/event snapshots; verify alias mutation cannot change registration behavior, committed configuration or queued payloads.
- [x] 2.3 Buffer events from before preparation through commit/rollback and preserve pre-existing queue entries; verify preparation throws, commit throws, rollback emits and successful commit all produce the specified delivery behavior.
- [x] 2.4 Add provisional resource ownership for updates and complete cleanup on failed transitions; verify failed preparation/commit removes only provisional resources and does not release previously committed resources.
- [x] 2.5 Implement faulted-instance quarantine and same-instance transition guards; verify failed rollback, inspection, rejection of later commands, reentrant update/disposal, explicit disposal and identifier reuse without sibling impact.
- [x] 2.6 Update runtime API and error documentation with transaction, fault and recovery examples; verify examples run in runtime documentation tests and legacy host signatures remain accepted.

## 3. Bind authoring to generated types

- [x] 3.1 Generate deterministic host-input and deeply read-only normalized configuration types before implementation compilation; verify defaults, requiredness, read-only access, nullability and nested schema cases with positive and negative compile fixtures.
- [x] 3.2 Bind command maps, arguments/results and event names/payloads to component-specific SDK generics; verify missing/extra commands, wrong payloads, asynchronous results and non-JSON values fail typechecking while runtime constraint tests still run.
- [x] 3.3 Add regeneration and check-only drift commands and migrate the palette and minimal fixture; verify a schema edit makes drift checking fail until regeneration and repeated generation produces identical files.
- [x] 3.4 Update the authoring guide with generated binding usage and runtime-only schema constraints; verify its minimal example compiles without generic JSON casts used to bypass member typing.

## 4. Generalize component discovery, scaffolding and CLI selection

- [x] 4.1 Implement the shared manifest registry with explicit fixture inclusion and safe paths; verify deterministic discovery, duplicate IDs, escaped paths, missing manifests and unsupported target selection.
- [x] 4.2 Thread a consistent component selector through validate/build/inspect/verify/release/preview/reproduce while preserving documented defaults; verify component identity is not lost between stages and invalid selection changes no outputs or catalog records.
- [x] 4.3 Add a scaffold containing source, manifest, styles, bindings, sample inputs and certification scenarios, including automatic project-reference registration where needed; verify a generated package typechecks and validates in a temporary workspace without shared platform-source edits.
- [x] 4.4 Document and test selected-component and supported all-component commands; verify fixture-only components remain excluded from normal release discovery and packages contain no unrelated component implementations.

## 5. Add bounded managed operations and provider ownership

- [x] 5.1 Implement versioned profile loading and runtime enforcement for JSON bytes/depth, event capacity and delivery batch limits; verify oversized/deep inputs, oversized results/events and event floods fail or yield as specified without silent FIFO loss.
- [x] 5.2 Add child resource scopes and keyed cancellable operations with generation guards; verify supersession, late success/rejection, disposal and independent operation keys with controlled asynchronous tests.
- [x] 5.3 Integrate provisional operations with update transactions; verify failed updates cancel provisional work without superseding old committed work and successful replacements suppress stale completions.
- [x] 5.4 Add an explicit provider adoption/cleanup boundary and scoped unmanaged-allocation rules; verify direct listeners/timers/observers/workers/portals are rejected outside approved boundaries and partial provider initialization cleans up.
- [x] 5.5 Document limits, synchronous acknowledgements, completion events, provider responsibilities and unsupported framework claims; verify runnable examples demonstrate cancellation and disposal without introducing default network access.

## 6. Govern the complete asset graph and adapter metadata

- [x] 6.1 Compile declared worker/script entries as governed graph members and scan all emitted executable/style assets; verify forbidden evaluation, undeclared origins, unresolved imports and unsupported executable formats fail in auxiliary files as well as the main script.
- [x] 6.2 Extend dependency/license inventories, size accounting and checksums to the complete graph; verify worker-only transitive dependencies, absent graph members and changed auxiliary bytes are detected.
- [x] 6.3 Add release-bound logical asset registration and scoped resolution without changing existing lifecycle call signatures; verify mismatched mappings, disallowed origins, nested host URLs and incompatible re-registration with live instances.
- [x] 6.4 Generate versioned adapter/resource metadata with complete loading order, integrity, CSP and native mapping requirements; verify worker/font/image/external dependency fixtures produce complete metadata and legacy packages remain inspectable without rewriting.
- [x] 6.5 Update distribution and integration guides with the resource-registration lifecycle and format migration examples; verify generated examples and metadata round-trip tests match the documented contract.

## 7. Make certification reusable and independently observed

- [x] 7.1 Split shared conformance from palette-specific behavior and define a required scenario inventory from suite/profile/target/browser inputs; verify a non-palette fixture runs the shared suite and empty or gate-disabling descriptors fail.
- [x] 7.2 Integrate reusable behavioral conformance and observed-capability validation into selected-component verification; verify missing command/event scenarios and undeclared worker/origin/portal observations block readiness.
- [x] 7.3 Add browser observations for supported listeners, timers, observers, workers, DOM ownership and post-disposal effects before artifacts execute; verify the raw-listener negative fixture fails even with zero SDK counters and document unsupported measurements.
- [x] 7.4 Require scenario completeness and component/contract/profile/policy/suite/full-artifact provenance in evidence collection; verify omitted/duplicated scenarios, forged annotations, sibling evidence, stale profile hashes and changed auxiliary files are rejected.
- [x] 7.5 Integrate negative fixtures for failed-update events, contract aliasing, rollback failure, stale async results and auxiliary scanning; verify each unsafe effect is prevented or rejected and any undetected violation fails platform verification.
- [x] 7.6 Update certification/release documentation with the coverage inventory and evidence boundaries; verify reported readiness remains browser-only without actual matching tenant evidence and existing palette behavior assertions remain present.

## 8. Prove supported capability and performance profiles

- [x] 8.1 Add small fixture scenarios for real workers, portals, imperative-provider DOM/resources and managed async operations, including a combined fixture; verify both targets in Chromium, Firefox and WebKit without substituting fake worker objects.
- [x] 8.2 Exercise hidden/resized/detached hosts, overlapping generations, partial failures and disposal while busy for at least 100 cycles; verify independent observations return to baseline and sibling state/callbacks remain isolated.
- [x] 8.3 Establish the benchmark protocol and review finite numeric profile thresholds before qualification, using fixed 1,000-record and 10,000-record datasets; verify reports include warm-up/sample settings, environment, p95/worst create/update/input timings, resource growth and explicit limits without candidate-run auto-calibration.
- [x] 8.4 Document the supported capability matrix and benchmark limitations; verify oversized workloads and deliberately slow/leaking fixtures fail their assigned profiles, and no fixture claims arbitrary framework or native-host support.

## 9. Deliver the manifest-driven local workbench

- [x] 9.1 Generalize loopback artifact serving and CSP to the registry and declared resource graph; verify nested worker/font/image paths work and traversal, unregistered paths and absent target artifacts are rejected.
- [x] 9.2 Implement actual Library, Preview/Workspace and Activity navigation with active state, keyboard access and deep links; verify the two previously decorative navigation entries display their intended views after clicks and reloads.
- [x] 9.3 Load component/version/target selections into isolated preview documents and dispose prior instances/subscriptions; verify switching between the palette and fixtures does not retain resources or contaminate styles/version state.
- [x] 9.4 Add schema-driven inputs/commands with validated JSON fallback, lifecycle controls and bounded redacted activity; verify valid operations, invalid-input preservation, log truncation, session reset and safe diagnostic export.
- [x] 9.5 Display exact-evidence readiness and document the workbench controls; verify missing/stale/target-mismatched evidence never shows a verified badge, and review workbench baselines separately from preserved palette baselines.

## 10. Prepare the separately gated Mentor integration phase

- [x] 10.1 Generate and validate detached release-bound native plans covering all assets, mappings, Block inputs/events, Client Actions, lifecycle wiring and error paths; verify plans for the palette and resource fixture are complete, artifact drift invalidates them and checksum domains have no self-reference.
- [x] 10.2 Implement a locally testable native-plan reconciliation model for create/update/unchanged/conflict using supplied inspected-state fixtures; verify identical reruns are no-ops, conflicts protect user-owned assets and partial failure requires read-back before retries.
- [x] 10.3 Add capability/identity checks and explicit Studio/manual fallbacks to the integration protocol; verify simulated missing tools/IDs/static-asset ingestion never invent calls or misuse server external-library upload.
- [x] 10.4 Define and test authority and secret-redaction boundaries with simulated responses; verify local preparation makes no authentication or tenant calls, excludes tokens from outputs, and native edits do not authorize publication/deployment.
- [x] 10.5 Document the live ODC palette checkpoint and read-back/smoke evidence template for create/update/commands/events/repeated renders/navigation/disposal; verify the local result records this checkpoint as not executed and cannot promote O11 or mobile-webview status.

## 11. Add repository AI workflows

- [x] 11.1 Use the skill-creation workflow to add component authoring guidance and concise tracked repository instructions; verify references resolve to durable specs/scaffolding/generated bindings and unrelated existing skill files remain unchanged.
- [x] 11.2 Add the certification skill with adversarial checks and explicit policy/baseline review boundaries; verify negative examples retain failures instead of editing acceptance thresholds or fabricating evidence.
- [x] 11.3 Add the OutSystems integration skill referencing the structured plan and current live-tool protocol; verify examples resolve real identifiers, handle unavailable capabilities and require separate mutation/publication authority without storing secrets.
- [x] 11.4 Add executable command/template checks and a reproducible fresh-context authoring evaluation; verify a small compliant fixture passes the selected pipeline without platform-source edits and non-conforming examples are rejected, recording agent evaluation separately from deterministic tests.

## 12. Qualify the integrated local platform

- [x] 12.1 Extend the existing Windows CI workflow to run discovered production components plus explicit platform fixtures with component-separated reports; verify missing components, missing matrix entries or cross-component report reuse fail CI.
- [x] 12.2 Run full formatting, lint, generated-type drift, unit, contract, browser, accessibility, visual, security, resource and performance gates for the migrated palette and supported fixtures; verify every required scenario is accounted for without unreviewed baseline or policy changes.
- [x] 12.3 Run fresh-scaffold end-to-end acceptance and two clean-workspace reproducibility builds for the palette and resource fixture; verify identical unsigned artifacts per component, complete asset inventories and no required edits to shared platform source.
- [x] 12.4 Produce the local completion report with migration/version classification, exact passing evidence and supported capability limits; verify registered releases remain unchanged and the live ODC/Mentor checkpoint remains explicitly unexecuted pending a separate authorized request.
