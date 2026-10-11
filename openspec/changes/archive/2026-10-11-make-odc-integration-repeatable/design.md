# Design

## Context

See [proposal.md](proposal.md) for motivation and [the trial record](../../../docs/odc-integration-pain-points.md) for PP identifiers. This design is required because generation, native evidence, workflow state and version migration cross several modules.

The current implementation provides useful foundations but incomplete enforcement:

- `native-plan.ts` emits format `2.0` plans with exact bridge-call descriptions, generic lifecycle prose and an ODC `ForwardToBlockEvent:ClientAction` input. The successful trial used eight public palette wrappers and private callback registration instead.
- Plan validation regenerates the same structure. It proves binding and drift, not native support. Reconciliation accepts caller-supplied `owner` and `fingerprint` fields, and tests construct observations from desired output.
- `integrationPreflight` requires automated static ingestion. It cannot express a completed manual import independently of that capability.
- Reviewed glue and native checks exist in ignored `.build/odc-live/` files. Their coverage is useful, but they contain palette-specific choices and incomplete or conflicting read-back snapshots. They are reference material, not a source-of-truth implementation to copy wholesale.
- The successful consumer is revision 4. Retained CSS bytes match; retained JavaScript is the qualified file plus a UTF-8 BOM. Native qualification remains incomplete.
- The previous preparation changes are archived. Existing durable specs already require conflict-aware reruns, read-back, authority separation and evidence-based readiness; this change makes those requirements operational and adds explicit continuation and preview contracts.

The agreed prioritization is retained here so future implementation does not turn every observation into a defect:

| Disposition                                    | Trial observations                    | Treatment in this change                                                                                                        |
| ---------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Fix generation and review enforcement          | PP-08–10, PP-23, PP-26                | Generated native contract, independent checks, exact read-back and observed reconciliation                                      |
| Fix workflow continuity and delivery reporting | PP-03–04, PP-11–15, PP-17–19, PP-27   | Early published shell, scoped authorization, independent outcomes, bounded recovery and portable evidence                       |
| Improve the minimum preview path               | PP-20, PP-22, PP-24–25                | Named cases, native modal sequences and authoritative acceptance; validator parity remains unproven, not a claimed deployed bug |
| Accommodate external constraints               | PP-05–06, PP-16                       | Authentication, manual import and quota continuation; no unsupported automation promise                                         |
| Observe and defer a policy/fix decision        | PP-07, PP-21                          | Exact served comparison and BOM diagnosis, without a transformation exception                                                   |
| Defer broader work                             | PP-01–02 and remaining PP-25 coverage | Portable setup automation and full native qualification; retain the already completed host-baseline work                        |

PP-14's original publication root cause and PP-27's isolated pointer failure remain unknown. Recovery and observation improvements do not claim to fix those underlying incidents.

## Goals / Non-Goals

**Goals:** Make the supported ODC mapping reproducible from governed inputs; make each continuation decision explainable from validated evidence; prove local behavior across the palette and explicit non-palette fixtures; and define a live pilot that can demonstrate repeatability without requiring full native certification.

**Non-Goals:** Build an MCP client or background orchestrator; guarantee Mentor determinism; add a general demo application generator; change bridge v1 or component behavior; standardize unsupported O11 mappings from ODC observations; automate upgrades, rollback or platform account recovery. Offline models consume observations and never manufacture live evidence.

## Decisions

### 1. Generate an ODC implementation contract, with an explicit format boundary

Introduce ODC native-plan format `3.0`, with a separately versioned template identifier. Keep O11 plan format `2.0` and its historical behavior; use a target/format discriminated representation so the ODC contract cannot silently become an O11 claim. Adapter/resource format `2.0`, bridge v1 and component configuration remain unchanged unless an independently justified format change is required.

An ODC plan contains:

- Public wrappers for resource registration, create, update, each declared command, callback unregistration and disposal. Callback registration is private to the Block. Generate names and schema mappings from the manifest and reject native name collisions, including case-insensitive collisions and unsupported mappings.
- Private registration/forwarding elements for every declared event. Callbacks close over the intended instance and forward serialized payloads as positional Text arguments.
- Exact JavaScript snippets, their input/output types, native expression placeholders, and required binding slots for the host Container, Block root and imported resources. Resolve slots from inspected native identities; never bake a tenant URL or a `PaletteHost` name into generic output.
- Lifecycle wiring for resource readiness, creation, callback ownership, full configuration updates, commit-only deduplication, explicit recreation, initialization failure and disposal during loading. Every declared output, including any recreation indicator, is assigned on every applicable branch.
- Root-scoped instance resolution that rejects zero or multiple matches, an element-by-element read-back inventory, and a minimal preview recipe.

The detached plan binds its template, all snippets and the package digest. Generated integration guidance and Mentor recipes reference the same contract. Native snippets receive syntax/target and applicable security checks before handoff. Execute them against the packaged bridge with a native-parameter/action harness; separately assert signatures and mappings so a permissive JavaScript callee cannot hide extra arguments. Preserve checks for load success/failure, sibling loading, disposal races and subscription cleanup.

Use the existing palette, minimal fixture, and resource fixture to prove generality. Add small fixture variations for recreation and name-collision rejection. Fixture changes remain explicit test opt-ins, not new production releases. Unsupported native mappings fail with a specific diagnostic rather than a plausible-looking plan.

Alternative considered: strengthen Mentor prose alone. It would leave the same unsupported signatures and absent executable oracle. Generating an OML compiler or bypassing Mentor would add an unproven platform integration and is outside scope.

### 2. Build reconciliation from observed content and a prior applied baseline

Represent each read-back item with its logical plan key, actual native key, owning asset/revision, observation time, evidence kind, source/signature/mappings as applicable, and evidence attachment references. Evidence kinds distinguish exact source, structured native wiring, reported summary and runtime observation. A completeness evaluator derives missing and conflicting entries from the plan inventory; a caller cannot set `readBackComplete: true` to bypass it.

Distinguish draft observations from published source and deployed observations. A draft item identifies its base revision and non-secret observation/run identity where available; it is not labelled as published merely because that base revision exists. Verify publication/deployment linkage separately and retain unknown provenance explicitly.

Canonicalize the structured comparison projection while retaining the original captured artifact hash. Do not infer JavaScript equivalence from prose or silently accept source rewrites. Unexpected source or wiring differences need review and contract checks before they become a confirmed applied baseline. Full OML remains server-side.

Reconcile desired plan, current observations and last confirmed applied observations:

| Observation                                                                                                 | Decision                                                                 |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Complete inspection establishes absence                                                                     | Create                                                                   |
| Current owned content matches the desired contract                                                          | Unchanged                                                                |
| Current owned content matches the previous applied baseline, but the desired contract changed               | Proposed update, subject to the existing native authority/conflict rules |
| Ownership is absent/ambiguous or current content changed unexpectedly                                       | Conflict                                                                 |
| Required content is absent, conflicting, from an unreconciled revision, or predates an interrupted mutation | Read-back required                                                       |

Matching names or an integration marker alone do not establish ownership. Initial adoption of the existing library requires an explicit reviewed mapping. A rerun compares observed content; it does not execute a second mutation to prove idempotence. General upgrade and rollback execution remain deferred.

Resource observations distinguish imported identity/mapping, captured model bytes where available, and actual served bytes. The observed native state can be unchanged relative to its reviewed prior snapshot while exact package identity still fails. Report both. Missing byte observations prevent an all-resources-unchanged claim; an observed BOM mismatch never becomes a matching qualified hash. This allows honest preview repeatability without weakening qualification.

Alternative considered: retain opaque supplied fingerprints. That cannot detect an invented snapshot or a user edit to an element still labelled integration-owned.

### 3. Use one portable run bundle with independent operation outcomes

Add an offline `native-run` CLI with `init`, `validate`, `inspect` and `export` operations. Each command takes explicit local paths, performs no network calls, and validates a versioned run-record schema. Mutation of records is limited to explicit creation/export; inspection and validation are read-only. Continue generating plans through `native-plan`.

The bundle contains `run.json` and a relative `evidence/` inventory. Format `1.0` records:

| Area              | Fields and meaning                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Binding           | Run ID, component/version, target/lane, package and plan digests, template and preview-suite versions                                        |
| Native identities | Library key/revision/release tag, consumer key/source revision, environment, publication/build/deployment keys and observed platform version |
| Authority         | Human request reference, target and operation scope, evidence of that request and any revocation; never a self-authorizing boolean           |
| Preconditions     | Connection observation, current interface identity, capability observations, resource-transfer route/completion, reference readiness         |
| Outcomes          | Separate draft mutation, validation, publication start/completion, release, deployment, preview-case and resource-identity observations      |
| Attempts          | Operation, route, time, outcome, hypothesis, evidence, next condition and bounded recovery budget                                            |
| Evidence          | Relative path, content hash, kind, observed time, asset/revision, completeness and unresolved conflicts                                      |

Use explicit `not-executed`, `pending`, `passed`, `failed`, `blocked` and `unknown` outcome states where applicable; do not collapse them into one success flag. A failed operation with possible effects sets the affected scope to read-back-required. Record a next action and the evidence needed to unblock it. Inspection reports the deployed usable result first, then pending work and requested intervention.

Exports use an allowlisted structure and screen attachments before writing. Exclude OAuth data, Mentor handles, cookies, signed draft/upload URLs and raw tool logs. Reject escaping paths, duplicate evidence identities and digest mismatches. Sensitive content that cannot be removed without invalidating source review is omitted and marked incomplete. Hashes establish file integrity, not the truth of a Mentor statement. A summary-only export remains resumable context but is not a complete evidence bundle.

Default working bundles stay under `.build/native-runs/<run-id>/`. Export to an explicit destination so the user can carry the directory with the package/plan. Do not automatically commit native evidence. Checked-in synthetic bundles exercise portability and secret rejection. This avoids adding an evidence service or silently treating ignored paths as durable delivery.

### 4. Separate transfer, identity and authority gates

Resource transfer uses states such as pending-manual, pending-automated, imported-awaiting-readback, observed-complete and conflicting. Capability answers how transfer can occur; it does not describe whether a user already completed it. An exact handoff names files, qualified hashes, native destinations, load order and the read-back required to continue.

Observed manual completion can unblock supported Mentor edits when package certification, identity, capability and authority prerequisites are met. Source/served byte verification remains separate, so missing served bytes before consumer deployment do not create a circular prerequisite. A known mismatch remains visible and prevents exact-package qualification.

Authorization references preserve the human's granted scope across pauses. The executing agent must be able to verify that authority from trusted conversation evidence; a copied JSON assertion grants nothing. Reconfirm only missing or changed scope, after the concrete proposed operation is reviewable. Record technical restrictions and approval-system blocks separately from missing user permission.

### 5. Establish the smallest published path and bound recovery

The integration skill guides this sequence, using the installed official MCP skill and actual live schemas:

```text
qualified package + plan
          |
          v
connection + identities + scoped authority
          |
          v
accessible consumer shell + verified deployment
          |
          v
resource import + native library read-back
          |
          v
library publication + referenceable release
          |
          v
consumer reference + minimal component wiring
          |
          v
read-back + publication + verified deployment
          |
          v
preview cases + served bytes + exported checkpoint
          |
          v
fresh-context inspection and unchanged rerun
```

Existing verified shells or library releases satisfy the relevant steps; do not recreate them. Access mode follows the intended user and tenant, with no default change to anonymous access. Before full demo construction, verify the shell's actual asset identity, default route and deployed revision. If the supported route cannot establish it, give the concrete user-created-shell handoff early. Verify release tags and actual consumer reference bindings rather than inferring them from publication or display names.

Record capability rejections with interface/tenant context and time. Refresh on a new connection or relevant interface change; catalog presence alone does not overturn an observed deprecation. Keep polling mechanics in the official skill. Consume event pages only while its current schema indicates more pages and provides a usable cursor; operation-status polling is a separate activity.

Default recovery budget: the initial operation plus at most two diagnostic retry attempts for that unresolved operation. Each retry requires new relevant evidence and fresh read-back after possible mutation. Repeating the same rejected request is not a diagnostic attempt. Authentication follows the official recovery route and one read-only tenant-readiness check; a failed readiness check leaves connection blocked. A quota response checkpoints immediately and is reconsidered only after relevant availability evidence, not repeated submissions. Reset the budget only for an explicitly changed recovery plan or a resolved external condition. No retry budget grants authority to alter dependencies or user-owned content.

Alternative considered: keep building the draft while publication is uncertain. The trial showed that substantial draft progress can remain inaccessible; the shell milestone exposes that blocker earlier.

### 6. Keep the preview sequence small but explicit

Generate a manifest-derived checklist and a versioned palette sample recipe, not a general-purpose demo framework. Use existing sample input and declared commands/events. The minimum sequence has separate case IDs:

- Expected revision/screen readiness, one scoped instance and loaded styles.
- Valid full configuration update, observed acceptance and retained instance identity.
- Sample syntax rejection if a sample form provides it; native bridge rejection, error forwarding and recovery as separate cases.
- Each declared command and event, including native Close while open and Toggle from open to closed for the palette.
- Repeated render/update without duplicate roots or duplicate subscriptions.
- Navigation away and return, with observed disposal and a new working instance.
- Scoped routing with two siblings, including disposal of one while the other remains usable.

For modal commands, a screen action started before opening orchestrates the native Open/Close or Open/Toggle sequence and captures the intermediate native result and final event/DOM outcome. It never removes `inert` or calls the browser bridge directly to stand in for a native wrapper. If native sequencing cannot expose a required intermediate state, the case remains blocked until a supported sample control exists.

Avoid a second handwritten semantic validator. Basic parsing can help editing, but a native update's parsed envelope and observed component state determine acceptance. Keep draft values separate from last accepted configuration; an error does not produce a success message. Exact native wiring for this sample is part of read-back, not inferred from the recipe.

Error-event forwarding applies when the component declares the corresponding event. Components without that event retain bridge failures as envelope/native diagnostic outcomes; the generator must not invent a public Block event or change the manifest to satisfy a palette-specific test.

Each case records preconditions, action route, start/end time, browser identity/version where observable, expected and observed results, target/revision and evidence references. Missing required execution metadata is explicit. Wait for deployed revision and screen markers; reuse tab identity after redirects. These cases are a preview/repeatability suite, not the complete certification matrix. Forced loading races and recreation are covered locally here; their native qualification, full accessibility coverage, O11 and mobile remain separate.

### 7. Validate two milestones without conflating them

**Local readiness:** generated glue passes independent contract and lifecycle checks for palette/minimal/resource fixtures; malformed read-back and fabricated fingerprints are rejected; completed manual transfer can advance the offline workflow; records round-trip through a different directory; recovery/status fixtures identify the next permitted step; existing selected package gates pass. A fresh-context replay uses only repository guidance and the portable synthetic bundle. Record its actual outcome separately from deterministic tests.

**Operational repeatability:** a later separately authorized ODC pilot uses the new package/plan, performs the named preview cases, exports its real run bundle and resumes from it for an inspection-only rerun. The rerun establishes no duplicate assets, unchanged intended source/wiring and preservation of user content, while reporting resource identity separately. Missing evidence or a blocking capability keeps this milestone pending; it cannot be waived by completing local tasks. Repeatable handling of a known hosting mismatch does not mean the qualified browser bytes were deployed exactly.

## Risks / Trade-offs

- Mentor or Studio may format or expose source differently → preserve original read-back, reject automatic equivalence assumptions, and record reviewed deviations explicitly.
- Exact native source or signature inspection may remain unavailable → provide a concrete supported inspection handoff and keep required evidence incomplete; do not promise that local code can remove the limitation.
- More evidence can recreate the trial's verbosity → request only the required inventory, summarize operation outcomes and export bounded attachments instead of printing raw event streams.
- Generic templates may encode palette assumptions → test non-palette and resource fixtures, derive names/configuration from manifests and keep palette preview behavior in its recipe.
- Manual import may alter bytes → preserve qualified and served digests, diagnose the BOM difference and defer any transformation policy to a separate change.
- A run record can become stale or overstate permission → require current identity/read-back checks and trusted authorization references at execution time.
- Shared generation changes can affect O11 or historical packages → dispatch explicitly by target/format, preserve legacy inspection and test that O11 mapping semantics do not change.

## Migration Plan

1. Preserve the existing `command-palette@2.0.0` handoff and evidence plus every registered payload. Read the catalog again before implementation builds. Do not change the published library as part of local work.
2. Introduce ODC plan `3.0`, template `1.0`, run-record `1.0` and preview-suite `1.0`. Use a new component version before generating changed production handoffs; conservatively target `command-palette@3.0.0` because the generated native public contract removes the callback-reference action. Verify the current catalog has not made that candidate unavailable. Library release tags remain a separate later decision.
3. Generate and test new output, regenerate component bindings, then qualify the selected new package under existing gates. O11 output carries the new component identity but retains its existing native mapping contract. Keep legacy plan inspection read-only and do not retrofit format `3.0` onto the historical live package.
4. Ship the updated local integration skill, offline record commands and documented manual steps together. Transfer a complete package/plan/evidence bundle for the later pilot.
5. Execute the pilot and unchanged rerun only when separately requested and authorized. Keep its pending status explicit in the task list until actual evidence exists.

Local rollback returns to the previous source/tooling while retaining new and historical evidence; it does not relabel a new plan as an old format. Tenant rollback requires a separately reviewed and authorized library/consumer operation; no automatic downgrade or asset deletion is included.

## Open Questions

- Which live native source/read-back facilities will be available when the pilot starts? Resolve through the official skill and catalog then; the incomplete-evidence/manual-inspection path already covers absence.
- Where did the recorded BOM enter the transfer chain? Compare available import and served observations during the pilot, preserving unknowns. A byte-preservation fix or qualified transformation policy requires a subsequent scoped change.
- Which native keys, environment and library release tag will host the new pilot? Resolve from current inspected state under that live request; historical display names and version numbers are not defaults.
