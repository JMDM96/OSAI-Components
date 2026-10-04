# Design

## Context

See `proposal.md` for motivation and scope. The workspace already separates contract schemas, SDK, runtime bridge, adapters, target profiles and build tools. Keep these boundaries.

Observed implementation constraints:

- `runtime-bridge/src/index.ts` calls update preparation before recording the event-queue boundary and stores the caller's mutable component definition at registration. Managed cleanup cannot account for allocations that bypass the SDK.
- `component-sdk/src/index.ts` accepts generic JSON command/configuration values and string event names. Generated distribution types are not the implementation's compiler-enforced contract.
- `build-tools/src/cli.ts`, the browser harness and evidence collection assume one configured command palette. Reusable conformance and capability-observation functions exist but are not universal release gates.
- Extra local manifest assets are copied, whereas the principal JavaScript bundle is compiled and scanned. Adapters describe only the principal script and stylesheet; Mentor recipes are generic instructions.
- The workbench's apparent tabs are anchors into a single demonstration page. CI already runs verification on Windows and should be extended, not replaced.
- The completed bootstrap contains the existing capability specifications, but `openspec/specs` is empty. These deltas are dependent on first synchronizing that baseline; the original command-palette behavior remains unchanged.

## Goals / Non-Goals

**Goals:**

- Make correctness claims bounded, independently testable and specific to each component, capability profile, artifact set and target.
- Let a new component use the full supported path without changes to platform source, browser routes or evidence validation.
- Support safe internal asynchronous operations and explicitly supported providers while preserving synchronous host calls.
- Separate deterministic package preparation from authorized, evidence-producing native integration.

**Non-Goals:**

- Do not sandbox hostile JavaScript, support every framework, introduce a generic virtual DOM/data-diff engine, or equate resource instrumentation with proof of zero heap retention.
- Do not add a product widget, hosted catalog, server-side business logic, browser automation that silently authenticates to tenants, or automatic publication.
- Do not add separate ODC/O11 component implementations without demonstrated target differences.

## Decisions

### 1. One component registry and selection contract

Discover `components/*/component.manifest.json` through a shared registry with deterministic ordering, unique identifiers, repository-bound paths and explicit fixture inclusion. Add a consistent `--component <id>` selector to validate/build/inspect/verify/release/preview/reproduce and `--all` where meaningful. Preserve no-argument command-palette defaults for developer convenience; evidence always records the resolved selection. Missing, duplicate, conflicting or unknown selectors fail before output changes.

Scaffolding creates a component-local manifest, source, styles, generated authoring bindings, sample configuration and certification scenario descriptor. Workspace globs already cover component packages; any required project-reference registration is automated by scaffolding rather than left as edits to platform source. A clean temporary-workspace acceptance test scaffolds a new ID and runs its complete selected pipeline without touching SDK, verifier or harness source. Fixtures never enter the production release catalog by default.

Alternative rejected: copying the palette and hand-editing shared harness/tests for every component. It would preserve the audit's coupling and allow borrowed evidence.

### 2. Compile-time bindings plus runtime validation

Generate component-local bindings from the normalized schema before source typechecking. Distinguish host input configuration (optional/defaulted and read-only semantics) from the complete, deeply read-only normalized configuration supplied to implementations. Bind configuration, command arguments/results and event names/payloads to the component definition and context generics. Keep runtime schema validation for constraints TypeScript cannot express, including numeric ranges and cross-field checks.

Generation is deterministic and has a check-only drift mode. Positive compile fixtures and expected-failure fixtures cover missing/extra commands, incorrect events/results, Promise returns and non-JSON values. Do not treat metadata copied from the manifest as proof of behavioral parity. The command palette and minimal fixture migrate to the same generated authoring path.

Alternative rejected: replacing runtime schemas with TypeScript-only guarantees. OutSystems sends runtime JSON, and third-party or generated implementations can circumvent types.

### 3. Immutable contracts and explicit failure states

Registration owns a normalized, deeply immutable contract snapshot and captured implementation entry points; later mutations of the supplied manifest/definition cannot alter accepted behavior. Configuration and queued payload snapshots are independent of caller/provider aliases.

Open an update transaction before calling component preparation. Buffer emissions and provisional resources/operations across preparation, commit and rollback, publishing them only after successful commit. On preparation failure, discard provisional work and preserve the previously committed configuration and pre-existing event queue. Preparation remains contractually side-effect-free; independent conformance catches DOM/resource changes that violate this rule. On commit failure, discard transaction emissions and invoke rollback. On successful rollback retain the old state; on rollback failure, quarantine the instance, cancel pending work and attempt all cleanup. Return a stable `instance-faulted` result and retain an inspectable tombstone until explicit disposal acknowledges it; do not continue operating a potentially corrupted instance.

Reentrant lifecycle mutations of the same instance during a transition return a stable `operation-in-progress` failure. Other instances remain usable. Reentrant host callbacks run only after commit and outside the transition. Fault inspection excludes raw errors and payload secrets.

Alternative rejected: swallowing rollback errors and leaving the instance live, or pretending arbitrary provider side effects can always be undone.

### 4. Managed operations, resource ownership and bounded delivery

Extend resource scopes with child scopes and keyed asynchronous operations that provide an AbortSignal and generation identity. Starting a replacement cancels the prior generation for that operation key; disposal cancels all operations. A completion can affect state or emit only if its instance, scope and generation are still current. Provisional operations from failed updates are canceled; previously committed operations remain active unless a successful replacement supersedes them. Rejections are caught and scrubbed even after cancellation.

Keep host commands synchronous: they can start managed work and immediately return a schema-valid acknowledgement; completion uses declared events and application business work remains in OutSystems. No default network access is introduced.

Release profiles declare finite JSON byte/depth limits, event queue capacity and delivery batch limits. Validate limits before expensive normalization where possible. Preserve FIFO for accepted events; reject the newest event with a scrubbed diagnostic on overflow instead of silently dropping earlier events. Do not introduce implicit coalescing or partial updates. Large-data needs use separately reviewed profiles, not automatic limit increases.

Component source must use managed allocation APIs. Add rules for direct unmanaged listeners, timers, observers, workers, portals and global DOM mutation. Approved provider adapters have explicit ownership and cleanup exceptions, not blanket exemptions. Test real provider-owned DOM/listeners/timers through an adopt-and-dispose boundary, including partial initialization failure and hidden/detached hosts. This certifies an imperative-provider profile, not arbitrary framework compatibility. Further frameworks require their own profile evidence.

Independent browser instrumentation begins before artifact execution and attributes observable listeners, timers, observers, workers and owned DOM to instance/scoped activity. Compare external observations with SDK counters and manifest declarations. Check post-disposal side effects and retained DOM references using supported probes; report instrumentation limits honestly. Static checks and instrumentation are regression defenses, not a hostile-code security boundary.

### 5. Component-independent certification with an explicit suite inventory

Split mandatory platform tests from component behavior scenarios. A component-local descriptor supplies valid/invalid configurations, command/event expectations, accessibility interaction assertions and visual states. It cannot disable mandatory lifecycle, isolation, security, resource or contract scenarios. Every declared command/event needs an exercised case or an explicit reviewed reachability setup; empty scenario descriptors fail.

Generate a required scenario inventory from the suite version and capability profile before execution. Evidence must contain every required scenario ID exactly once per applicable target/browser, with matching component version, complete artifact hashes, contract hash, profile/policy hash and suite version. Gate annotations and a positive aggregate test count are insufficient. Fixture or sibling-component evidence cannot satisfy a production release. Preserve all existing palette-specific behavior coverage as its scenario module.

Profiles inherit non-waivable base gates and add capability tests for managed async, workers, portals and imperative providers. Use small fixtures, including deliberate defects, to prove the runtime prevents unsafe effects or the relevant gate rejects the violation; do not require rejection when containment already preserves the contract. At least one combined fixture exercises real worker results, overlapping operations, portals and disposal in the browser rather than mocking the worker interface. Keep fixture-only assets out of production packages.

Performance profiles contain reviewed numeric thresholds for create/update/input latency, queue/data limits and resource growth alongside existing size budgets. The benchmark protocol fixes environment metadata, warm-up, sample count and datasets (1,000 and 10,000 synthetic records) and reports p95 and worst observed values. Establish and review threshold values in a dedicated policy task before qualification runs; do not auto-calibrate passing thresholds from the candidate run. Run at least 100 lifecycle cycles for every supported resource profile. Performance failures cannot silently relax policy; optional engine-specific heap diagnostics cannot stand in for mandatory cross-browser resource tests.

Alternative rejected: declaring all future components safe because the palette passes, or forcing every future component into the palette's size/performance profile.

### 6. Treat auxiliary executables as part of the release graph

Declare typed logical assets and compile executable entries, including workers, with the same locked toolchain, dependency inventory and security restrictions as the main entry. Scan all shipped executable/style outputs, reject unresolved imports and missing graph edges, and include every artifact in checksums, size measurements and evidence. Copy only validated non-executable assets verbatim. Unknown executable formats fail closed.

Provide a scoped SDK resource resolver backed by a validated logical-asset URL map. Do not derive worker/font/image URLs from the screen URL or assume a Required Script has an accessible `currentScript` URL. The adapter configures resource locations through an additive asset-registration operation before creation; it does not pollute the component's public configuration schema. Bind maps to component version/artifact identity, validate against declared origins/CSP, and reject incompatible re-registration while live instances exist. Assets with no entries require no extra host call.

Adapters and integration plans include logical-to-physical assets, hashes, MIME/usage, load order, dependency versions/licenses/integrity, required CSP, native resource mapping and initialization requirements. Version the expanded adapter/recipe formats explicitly; old release inspection stays available, but incomplete legacy handoffs cannot claim the new certification level.

Avoid self-referential hashes: finalize the unsigned payload and its ordered checksum inventory first; the inventory excludes itself and detached evidence. Generate a resolved integration plan afterward as detached metadata bound to that inventory's digest, not as a file inside its own hash domain. In-package recipes can describe the deterministic workflow without embedding a checksum of themselves. Verify plan integrity separately from payload integrity.

Alternative rejected: treating worker files as opaque copies or asking Mentor to infer missing loading instructions.

### 7. A real, local workbench using release artifacts

Keep the existing preview server but generalize its manifest discovery, routes and asset serving. Implement genuine Library, Preview/Workspace and Activity views, including active navigation and deep-link restoration. Use an isolated preview document per selected component/target so different versions and styles do not contaminate each other or the workbench shell. This isolation improves test fidelity; it is not a security sandbox guarantee.

Provide schema-derived configuration/command controls with a validated JSON fallback, create/update/dispose actions, event subscriptions and a bounded diagnostic timeline. Show generated/browser-verified/OutSystems-verified status from exact matching evidence; show stale or absent evidence honestly. Switching components disposes the previous instance and clears subscriptions. Default display redacts payload values; explicit local inspection can reveal synthetic data, while exports redact values unless separately requested. Never persist user-entered payloads by default.

Serve only registered release files from a loopback-bound server with safe paths and restrictive CSP; support worker/font/image fixtures and nested resource paths. Preserve existing command-palette visual/behavior tests as component tests; workbench navigation has its own tests and baselines.

### 8. Skills teach the enforced workflow

Add repository-owned `component-author`, `component-certify` and `outsystems-library-integrate` skills and concise tracked repository guidance. They point to durable contracts, generated templates and CLI commands rather than duplicate implementation contracts in prose. They forbid invented bridge APIs, unmanaged resource shortcuts, unrelated package changes, unreviewed threshold reductions, silent visual-baseline acceptance and fabricated host evidence.

Create versioned positive/negative workflow examples and a fresh-context authoring exercise using a small fixture. Deterministic tests validate paths, commands and template compatibility; record the human/agent evaluation separately rather than promising deterministic LLM behavior. Apply the skill-creation workflow when implementing these files. Do not overwrite unrelated/untracked OpenSpec skills or embed credentials, tenant IDs or transcripts in repository skills.

Alternative rejected: relying on a long prompt to compensate for missing compiler or release enforcement.

### 9. Mentor preparation is local; native execution is a later checkpoint

Generate a structured, artifact-hash-bound integration plan: target/component/version, resource manifest, Block inputs/events, JSON/native type mappings, Client Action signatures, lifecycle wiring, error handling and smoke scenarios. Primitive values have explicit native mappings; nested/list values use a documented JSON contract unless a validated native-structure mapping is selected. Event forwarding includes instance identity. Adapter version drift invalidates an existing plan.

The integration skill consumes this plan and the live server's tool descriptions. It resolves real asset/environment IDs, inspects existing assets and produces an idempotent create/update/no-op/conflict plan before any write. Existing user-owned assets are not overwritten on naming conflicts. Required Script/resource ingestion and Library creation are capabilities to verify, not assumptions; .NET external-library upload is not a UI asset transfer substitute. Missing capabilities produce a precise Studio/manual handoff, not invented tool calls.

Local tests simulate supported/unsupported tools, missing assets, reruns, conflicts, partial failure, token redaction and permission boundaries. No live credentials or auth preflight is needed for local completion. When separately requested, follow the supplied MCP authentication/session/polling rules and live tool schemas, request mutation authority for the resolved plan, perform read-back verification, and stop on uncertain outcomes before retrying writes. Publication/deployment remain separate authorization boundaries.

The first live validation uses the existing palette in ODC and records platform version, IDs, artifact hashes and create/update/event/command/navigation/disposal results. A successful Mentor response alone is not a host smoke test. If execution requires publication, request that authority first. O11 and mobile-webview evidence are independent; local completion leaves all unexecuted host lanes explicitly unverified.

## Risks / Trade-offs

- Broader instrumentation can create false positives or timing noise -> isolate the harness, attribute ownership, keep small adversarial fixtures and distinguish diagnostic-only measurements from blocking gates.
- TypeScript cannot represent every schema predicate -> retain runtime validation and document widened generated types instead of weakening schemas.
- Rollback cannot repair arbitrary unmanaged side effects -> enforce side-effect-free preparation, test observable mutations and quarantine unrecoverable instances.
- Stronger authoring and evidence contracts require migration -> migrate both existing examples, retain host ABI calls and legacy read-only release inspection, and document schema/profile versions.
- Windows runner/browser updates affect visual and timing results -> retain locked browser pins, record environment metadata and require explicit review of policy/baseline updates.
- Mentor/static-asset capabilities may be unavailable -> local plan generation remains useful; live work has a capability/authorization checkpoint and a documented manual fallback.
- Same-page component versions cannot always coexist -> retain explicit incompatible-registration rejection within one bridge; use workbench isolation and coordinated host upgrades instead of promising multi-version support.

## Migration Plan

1. On a later apply request, synchronize the completed bootstrap specs using the appropriate OpenSpec sync workflow; do not archive it implicitly. Verify these seven delta paths against the resulting baseline.
2. Add the three reproduced defects as regression tests, then migrate immutable registration and transaction handling before expanding other capabilities.
3. Introduce typed bindings, component selection and scenario descriptors; migrate the palette and minimal fixture without removing behavior tests.
4. Introduce versioned profiles, complete asset graphs and adapter formats, then certify stress/negative fixtures and add the workbench and skills.
5. Run all selected-component and full-matrix gates, clean-workspace reproducibility and fresh-scaffold acceptance. Generate new versioned payloads; never overwrite the registered 1.0.0 release. Compatibility classification determines the required release increment.
6. Deliver local hardening with an explicit `not-executed` Mentor/host checkpoint. A later authorized task supplies live context and carries out the ODC validation protocol; this change's local completion does not satisfy that checkpoint.

Rollback preserves existing distributions and catalog entries: revert source/tooling changes as a coordinated set, rebuild only unregistered outputs and continue consuming the previous verified package. Any future tenant rollback must use separately captured native state and explicit authority; no tenant rollback occurs in this change.
