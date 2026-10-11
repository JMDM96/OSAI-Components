# Command palette and SDK integration completion

**The command palette implementation and repeatable ODC pilot are complete.**
OS AI Components Demo is published and deployed to Development at revision **7**,
referencing OS AI Components **0.2.1 / revision 6**. All 17 native preview cases
have passing runtime evidence, including all five Block events and actual SDK
validation rejection. A fresh-context, read-only wrap established complete
source/wiring read-back, reviewed ownership and an independent unchanged rerun.

OpenSpec change `make-odc-integration-repeatable` has **32/32 tasks complete**.
It is archived at
`openspec/changes/archive/2026-10-11-make-odc-integration-repeatable/`, and its
contracts are synchronized into the durable specifications. The command
palette is the reference component for the shared SDK integration pipeline.

Full native certification remains outside this completed milestone: the formal
preview evaluator still reports `missing:platformVersion`, and served JavaScript
has a three-byte UTF-8 BOM absent from the qualified package. CSS matches exactly.
The bundle reports `native-state-unchanged` and `assetIdentity: mismatched` together;
neither runtime success nor operational repeatability promotes native qualification.

## Delivered behavior

- `command-palette@3.0.0` is the new candidate. ODC plan `3.0` supplies exact
  `odc-block@1.0` JavaScript, public wrappers, private native event forwarders,
  signatures, identity/resource bindings and lifecycle wiring. O11 retains plan
  `2.0`; historical ODC `2.0` is inspection-only.
- Read-back completeness is derived from an explicit source/wiring/resource
  inventory. Reruns compare desired, observed and confirmed prior content, require
  explicit adoption and protect user edits. Native state and exact served-byte
  identity are reported independently, including BOM-only mismatches.
- Offline `native-run init`, `inspect`, `validate` and `export` commands provide
  run-record `1.0`, scoped request references, independent outcomes, preserved
  attempts, relative hashed evidence and screened, non-overwriting exports.
- Manual import completion, an accessible deployed shell, library release/reference
  prerequisites, bounded diagnostic retries, quota checkpoints, pagination and
  authentication/browser continuity are documented and exercised as supplied-state
  workflows. Cold starts resolve identities first; interrupted mutations require
  fresh read-back before evidence-backed recovery.
- Preview suite `1.0` separates form rejection from bridge rejection and covers
  commands/events, accepted configuration, rendering, navigation and siblings.
  Native Close and Toggle sequences preserve modal accessibility.

## Actual validation

All final checks pass after the load-order, continuation and workbench corrections.
Earlier passing and failing reports are preserved.

| Check                                                | Final result                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Formatting, generated bindings, lint and type checks | Passed                                                                                         |
| Unit suite                                           | 347 passed                                                                                     |
| Command palette browser qualification                | 300 passed                                                                                     |
| Explicit resource fixture                            | 120 passed                                                                                     |
| Explicit minimal fixture                             | 78 passed                                                                                      |
| Workbench behavior, accessibility and visuals        | 48 passed                                                                                      |
| Clean reproduction                                   | All three packages byte-identical in two independent workspaces each                           |
| OpenSpec                                             | Eight durable specs validate strictly; completed change archived with 32/32 tasks              |
| Native read-back and reconciliation                  | 36 entries unchanged; zero conflicts; portable export validates after relocation               |
| Native runtime preview                               | 17 cases have passing observations; aggregate gate remains limited by missing platform version |

Final qualification logs are `test-results/wrap-*-complete-verify.log`; the workbench
result is `test-results/wrap-workbench-routing-fix.log`. The assembled local handoff
is `.build/command-palette-wrap-2026-10-11/`, including the qualified package and
its archived reports.
The recorded execution host is macOS arm64 with pinned Chromium, Firefox and WebKit.
No Windows, O11 native or mobile execution is implied by local browser results.

The wrap preservation inventory covers **435 files**, including the release catalog,
retained 2.0.0 artifacts, the previous native export and every reviewed browser
baseline. All recorded hashes match. The registered 1.0.0 payload directory was
already absent and remains absent; no historical bytes were reconstructed.
Policy thresholds and reviewed screenshot files remain unchanged.

The current native handoff is
`.build/command-palette-wrap-2026-10-11/qualified-export/run.json`.
It includes 36 complete inspected entries, reviewed ownership, a confirmed baseline,
two independently retrieved library graphs, the fresh consumer graph, exact default
literal inspection, original served bytes and the earlier runtime/failure history.
The export is screened and validates offline. All operations reconcile as unchanged,
with no conflicts and the original served-JavaScript mismatch retained.

The final qualified package artifact digest is
`a8faf37282b314dadbf02f97670a68414d71fe3efc3c6ea71243ba2fe44039f5`, with ODC plan
`3804ceab37ff0fb0c080f1a65ffdf76ffb212eadee2c23868fca29506661aa9a`.
The native pilot originally used package
`52859e14a3c79274c51b507a1b44c22bd68340636728823bfb84ce7ecbaee44f`.
Only `shared/certification.json` changed for the final workbench suite provenance;
all executable native templates, browser resources and their hashes are identical.
The export retains the earlier plan and a checked comparison, and keeps the baseline's
original observed identity instead of rewriting historical evidence.

The plan now describes the actual native load order: host script, resource registration,
managed stylesheet completion, then component creation. This correction changes no
browser bundle or native source bytes. The original local handoff and every earlier
run/export remain preserved under `.build/odc-handoff/` and
`.build/odc-event-binding-2026-10-09/`.

## Independent replay result

The isolated agent received repository guidance, a generated package and six
relocated synthetic bundles without this conversation's history. It correctly
identified manual-import continuation, quota pause, fresh inspection after partial
mutation, protection of unexpected source changes, missing evidence and an unchanged
rerun. Its [original report](../.build/repeatable-odc-evaluation/final/agent-evaluation.md)
and [follow-up](../.build/repeatable-odc-evaluation/final/agent-evaluation-addendum.md)
are retained separately from deterministic test evidence.

The replay identified two reporting improvements: expose attempted operations in
the CLI summary and identify the native element involved in a conflict. Both were
implemented and independently rechecked. Nine focused workflow tests, type checks
and lint passed after these reporting changes. Missing evidence reports an unknown
conflict check (`null`); a completed check without conflicts reports an empty list.
All 106 recorded input files remained unchanged. The handoff's `agent-replay/`
directory includes the reports, prompt, input inventory, guidance snapshots,
relocated fixtures and a content-hashed evaluation record.

All 29 local OpenSpec tasks are complete. The subsequent native runtime, complete
read-back and unchanged real-bundle reconciliation complete tasks 8.1–8.3 as well.

## Live pilot checkpoint — 2026-10-08

The user authorized the Development pilot. After restoring the MCP connection,
live inspection confirmed Development (`1f9d2491-b5ae-4415-8993-31f17583b2d5`),
OS AI Components (`e13398dc-01ec-4955-a60b-2a6d7d99f357`) revision 4 / release
`0.1.0`, and OS AI Components Demo (`f5aec50e-0cd1-4cc3-997f-0867943275fc`)
at source and deployed revision 4. The existing demo screen was accessible.
Its reference lookup covered entities only; it did not establish the library
Block dependency or provide a complete native baseline.

The read-only Mentor inspection reached `succeeded` with `attemptedChange: false`
and `changeApplied: false`. Retrieving its remaining result pages failed with
`OAuth token refresh failed: Server returned error response: invalid_scope: Invalid scopes:`.
One normal authentication-recovery retry returned the same error. Complete
source/wiring read-back, resource import, publication, deployment and 3.0.0 preview
are still pending. No tenant mutation was attempted.

The screened checkpoint is `.build/odc-live/2026-10-08-command-palette-3.0.0/`;
the validated portable export is
`.build/odc-live/2026-10-08-command-palette-3.0.0-auth-checkpoint-export/`.
It preserves the partial result, failure and scoped human-request reference without
credentials or session handles. Resume by restoring sign-in and retrieving the
inspection result; if the session expired, reinspect the same unchanged library.
Reuse the existing pilot authorization within its scope. All three live OpenSpec
tasks remain open.

On resumption, read-only calls worked and a smaller Mentor inspection completed
without changes. Mentor reported that the existing Script text and CSS resource
could be replaced through the model editor; actual candidate ingestion and exact
byte read-back have not demonstrated that route yet. A subsequent exact-source
inspection started, but token refresh failed again before its terminal result
could be retrieved.

Public OAuth discovery omitted resource scopes, and the local connection had no
explicit scopes. The identity provider advertised `openid`. The diagnostic login
`codex mcp login outsystems --scopes openid` succeeded, after which the chat's MCP
connection requested reconnection. This is a targeted recovery attempt, not a
confirmed fix: successful access and later token refresh still need verification.
No connection configuration or native model was edited. The latest validated
export is `.build/odc-live/2026-10-08-command-palette-3.0.0-scope-login-export/`;
earlier observations and failures remain preserved.

The next connection attempt remained usable through several complete inspections
and draft edits. Public and private legacy source/wiring were preserved, together
with the original deployed 2.0.0 script and stylesheet bytes. The script has a
leading UTF-8 BOM in its served response; the unchanged original bytes are retained
as baseline evidence, not candidate 3.0.0 verification. Token-refresh recovery has
not been independently proven permanent.

The eight public wrappers were updated in the in-memory library draft after an
exact comparison with their preserved old source. All eight actual source strings
were retrieved and matched the generated candidate, with their existing action
keys and native signatures preserved. The five private helpers were then created
with zero native validation errors. Their initial response omitted source and
reported three lengths different from the supplied contract. A focused read-only
retrieval returned all five actual source strings and confirmed exact matches;
the earlier length report was wrong, and no corrective edit was needed. The
generated lifecycle assembly is now in progress. The deployed revision remains 4. The partial draft must not be published as a completed integration.

The demo inspection confirmed explicit `"{}"` command arguments and the expected
Block/event references. It also confirmed that its existing form validator performs
semantic checks before the SDK, so the planned bridge-invalid preview path must
exercise the native SDK helper directly. A deeper read found the actual reference
key `3boLnylAvUKSAdZpK5SwTQ`, version `0.1.0`, revision `4`, fixed-version flag,
and specific-version hash `617708f7-a1da-5c58-ac1b-97b56269a510`. This corrects
the initial inspection's unsupported claim that no pinned version was visible.
Mentor reports a distinct library release capability, but no supported consumer
version-update operation. These capabilities have not yet been exercised. All
three live tasks remain open.

### Earlier checkpoint: library published, consumer update pending

The generated lifecycle was applied and reviewed. The first native assembly
forwarded a full envelope where the Block event requires an error payload, and
nested accepted-configuration updates under the readiness-change branch. Both
were corrected; the retrieved native keys, sources and branch edges show the
independent comparisons. Immediate Ready failures now also reach `Forward_error`.
The 3.0.0 Script patch applied with the expected two version replacements and one
release-ID replacement; CSS remained unchanged. This proves the observed patch
operation, not candidate served-byte identity.

Result pagination returned `not_found` after a successful correction run. A new
read-only inspection in the same session confirmed that the draft was intact;
the edits were not reapplied. The exposed `mentor_publish` tool was then rejected
as deprecated, with an explicit instruction to publish through `mentor_prompt`.
That supported route published library revision **5**. Independent `app_info`
confirmed model digest `1f968fb1-828e-36d3-e433-4c58599a33ca`.

The direct published-model graph independently contains all **14 exact generated
JavaScript sources**, matching the candidate. Curated graph nodes, edges and
unmodified source strings are saved separately in the live run. Author metadata
was excluded. The imported Script body is not exposed by that graph, so it cannot
replace a served-byte capture. A complete normalized read-back/baseline and the
fresh-context unchanged rerun remain pending.

The attempt to release revision 5 as **0.2.0** returned an ambiguous confirmation.
Independent `app_info` now shows tag `0.2.0` against revision 5, but availability
as a consumer reference has not been verified. Do not repeat the release merely
because its response was ambiguous. The demo still references `0.1.0`, revision 4,
and its actual Development deployment is still revision 4.

Mentor reports no supported operation to update that fixed consumer reference.
Computer Use access to ODC Studio was not approved; no Studio edit was performed.
The next concrete step is to open **OS AI Components Demo**
(`f5aec50e-0cd1-4cc3-997f-0867943275fc`) in Studio and update its **OS AI Components**
(`e13398dc-01ec-4955-a60b-2a6d7d99f357`) dependency to `0.2.0` / revision 5 if listed.
If it is not listed, preserve the ambiguous release checkpoint instead of trying
another version. The user was asked to perform this step or permit the specific
Studio interaction. Afterward, inspect the actual reference before building and
publishing the preview changes, running the native cases, and capturing candidate
served bytes. Existing authorization remains scoped to Development
(`1f9d2491-b5ae-4415-8993-31f17583b2d5`).

### Earlier checkpoint: consumer update verified, runtime wiring issue found

After the user reported completing the dependency update, fresh inspection confirmed
demo revision **5**, Development deployment `db68481c-e4a8-4ca6-8acd-7b1d7fe73830`,
and the actual `OSAIComponents` reference at **0.2.0 / revision 5**, with producer
digest `1f968fb1-828e-36d3-e433-4c58599a33ca`. The previous instruction to update
the dependency relied on stale inspection. The user's update is complete.

The deployed native Open action opens the palette, filtering works, and keyboard
selection closes it. However, the demo receives no Block events and its last
selected command stays unchanged. The published graph confirms that Ready has no
`ReferedClientActions` edges, although the generated source captures `$actions`.
The five correct action references still exist on the legacy callback node.
A focused library draft repair is adding these references to Ready without
changing generated source or resources. Demo test controls are being prepared in
a separate session on the user's latest revision; neither draft is published yet.

Original candidate response bytes were captured from the demo's observed URLs.
CSS is exactly **6,199 bytes**, matching the package. JavaScript is **59,120 bytes**,
SHA-256 `04feea24c0eeae7976f80e153739ecc34983e63bafd7cc2fe67425b6708bbaa6`.
Its UTF-8 BOM accounts for the difference from the **59,117-byte** package:
removing the prefix diagnostically produces package hash
`9318031d87cc770200769a423ab89a0ef368495443f3a7a3ca5d0dd6dee20535`.
The unchanged original response remains a recorded mismatch, not exact identity.
All three live tasks remain open.

### Earlier user pause checkpoint

Both in-flight Mentor runs had completed before the pause was received:

- Library **revision 6** publication was independently confirmed by `app_info`,
  model digest `f770a127-e009-5152-a1d7-ff88c000e7c6`. Ready now reportedly captures
  each named `$actions.Forward_*` explicitly. The native API could not edit the
  reference table directly. Whether the source change produced the five required
  native edges remains unverified. No new library version was released.
- The demo draft has two Blocks, generated helper copies, native command sequences,
  separate accepted-state diagnostics, a syntax-only form path and a bridge-invalid
  test. A correction replaced the erroneous nonempty-response success guard with
  parsed `ok === true` and `code === "ready"` checks. Mentor reports zero errors
  and warnings. Exact helper-source and full branch read-back remain pending;
  these edits have **not** been published. The session is idle and can expire.

The original plan and qualified package remain preserved. The revision 6 diagnostic
Ready source differs from that plan; it must not be called an exact match. On
explicit resume, first inspect revision 6. If the callback-reference hypothesis is
confirmed, update the generic generator/plan with appropriate validation before
establishing a new applied baseline. Then recover the demo draft, finish the
release/reference/deployment steps and run the native cases. Preserve the served
BOM mismatch. The three live OpenSpec tasks remain open. No commit or push occurred.

The screened run evidence is under
`.build/odc-live/2026-10-08-command-palette-3.0.0/`, including
`user-pause-after-library-revision-6.json` and the earlier failure observations.
Session handles are deliberately excluded.

### Earlier checkpoint — 2026-10-09: SDK event-binding repair

The user resumed event-binding work. Direct published-model inspection confirmed
library revision **6**, digest `f770a127-e009-5152-a1d7-ff88c000e7c6`, and all five
`ReferedClientActions` edges from Ready to its private forwarders. The generic SDK
generator now captures literal `$actions.Forward_<event>` references rather than
the whole `$actions` object. This lets ODC discover its native action dependencies.
All 14 JavaScript source strings exactly match the corrected plan; this does not
claim a complete normalized wiring baseline or successful runtime delivery.

The local execution harness now supplies only explicitly referenced actions. It
reproduced the original missing-event failure before the fix. Independent static
validation rejects missing action references even when comments contain their
names, and rejects whole-object capture. The 29 focused native tests pass. The full
unit run passed 344 cases with one scaffold case blocked by the sandbox's local
IPC restriction; that case passed on its isolated retry outside the sandbox.
Bindings, type checks and lint pass. All 186 historical files remain unchanged.
Failure reports are preserved alongside passing reports.

The corrected detached plan digest is
`94d3bd8d466bad7caec6be8148f0b725f8f3ee3bf61aaa5150295de7e68364fb`.
Its unchanged package artifact digest is
`52859e14a3c79274c51b507a1b44c22bd68340636728823bfb84ce7ecbaee44f`.
The new run is `.build/odc-event-binding-2026-10-09/run/run.json`; the screened,
validated portable export is `.build/odc-event-binding-2026-10-09/export/`.
Both include the earlier observations and original plan as historical evidence,
plus exact revision 6 source/reference observations. The earlier run and exports
were not overwritten. The BOM mismatch remains recorded.

The demo's preserved session accepted a read-only inspection request, but retrieval
failed twice with `OAuth token refresh failed: Server returned error response:
invalid_scope: Invalid scopes:`. Its terminal result has not been retrieved. The
user was asked to reauthenticate. The proposed library release `0.2.1` has not
been attempted, and no demo publication has been attempted on this resumption.
Continue by retrieving that run without discarding the demo draft, then release
revision 6, verify and preserve the demo changes, update its consumer reference,
and verify the Development deployment and native events. All three live OpenSpec
tasks remain open.

### Earlier checkpoint — 2026-10-09: release 0.2.1 confirmed

The user approved the targeted authentication recovery. Only
`mcp_servers.outsystems.scopes = ["openid"]` was added to the shared user Codex
configuration. The fresh scoped CLI login succeeded, and application inspection,
Mentor release and subsequent verification calls worked. This does not yet prove
that refresh remains reliable after a later token expiry. No OAuth credentials
or session handles were saved in the run evidence.

The release operation returned an ambiguous response. It was not repeated.
Independent `app_info` confirmed **OS AI Components**
(`e13398dc-01ec-4955-a60b-2a6d7d99f357`) at revision **6**, tag **0.2.1**, unchanged
digest `f770a127-e009-5152-a1d7-ff88c000e7c6`. No model edits or extra publication
were requested. The new release session was closed after verification.

Fresh inspection still showed **OS AI Components Demo**
(`f5aec50e-0cd1-4cc3-997f-0867943275fc`) at source/deployed revision **5**, deployment
`db68481c-e4a8-4ca6-8acd-7b1d7fe73830`, and the existing demo screen was accessible.
The user's earlier update to `0.2.0` remains verified and complete. The new request
is specifically to update that dependency to **0.2.1** and publish Development.
The MCP reference-update route remains unsupported; no Studio access was assumed.
Inspect the actual consumer reference and deployed revision after the user's
update, then exercise events through native screen controls.

The earlier unpublished preview draft cannot be retrieved using the session
handles currently available. Its report is retained without claiming those
controls were published or tested. Reinspect the published demo before recreating
missing preview controls for the broader suite. The current screened portable
export is `.build/odc-event-binding-2026-10-09/released-021-export/`; the original
authentication-failure export and prior run remain preserved. All three live
OpenSpec tasks remain open.

### Earlier checkpoint — 2026-10-09: four native events verified; error test quota-blocked

The user's dependency update is independently verified. The published demo graph
contains `OSAIComponents` version **0.2.1**, producer revision **6**, specific-version
digest `f770a127-e009-5152-a1d7-ff88c000e7c6`. Demo source revision **6** has digest
`3fbf06e6-c242-596d-45a9-cedc46650d6e`; Development deployment is
`1a865905-8c62-45f9-b9e3-37d12bd130d9`, build
`a6ee2e64-eeb8-4644-a276-854b68b2dfe6`. A transport failure on graph retrieval was
preserved; one bounded retry succeeded. All five consumer Block-handler bindings
are present.

After browser reload, the native Open button opened the palette. Typing `find`
filtered to one command; Enter selected `find-project` and closed the palette.
The actual Block event log contains `opened`, per-keystroke `queryChanged`,
`commandSelected` with `query=find` / `source=keyboard`, and `closed` with
`reason=selection`, all for the same instance. The last-selected summary updated.
The exact DOM observation and screenshot are retained under
`.build/odc-event-binding-2026-10-09/`.

An unknown-property test was rejected by the demo form, so it is explicitly **not**
SDK-error evidence. The original form configuration was restored. A small demo
draft attempted to add `Test SDK Error` and exact generated helper copies to pass
`{"commands":null}` through native `ApplyConfiguration`, without assigning
rejected data to the screen's Draft/Applied values. The run terminated **failed**
with `attemptedChange=true`, `changeApplied=true`, one validation error
(`Invalid Expression`) and quota code **OS-AISA-42903**: "Mentor is currently
unavailable due to reached usage limits. Limit resets in 5h 16min." This is the
interval reported at failure, not a new timer on each read. No unchanged quota
retry or publication was attempted. Exact draft source, the invalid expression's
location, publication and the fifth-event runtime check remain pending.

Independent inspection after the failure confirmed the same working source and
deployed revision **6**, with unchanged digest and deployment key above. The
partial draft must not be published. After quota resets or changes, inspect the
held draft first if its session remains available; otherwise inspect the current
published model and reconstruct only missing test controls. No session handles
were persisted. The current screened, validated portable export is
`.build/odc-event-binding-2026-10-09/live-events-quota-export/`.

Fresh captures from the observed revision 6 resource URLs retain the same original
JavaScript BOM mismatch and exact CSS match. The run format permits one current
served capture per asset; earlier captures remain unchanged as historical
observations, with their original metadata preserved in earlier exports and a
saved duplicate-resource validation-failure snapshot. No response bytes were
normalized. The live milestone tasks remain open.

### Earlier checkpoint — 2026-10-10 UTC: runtime preview completed

The user requested an iteration wrap on October 9 local time. Published-model
inspection, scoped demo edits and a dedicated publication completed successfully.
The demo's final validation reported zero errors and zero warnings. Source revision
**7**, digest `dcda14c7-26ca-153a-b48d-4a856bc97855`, is deployed to Development
under deployment `50a5cec0-70cf-4025-aafc-2df3277115d8`, build
`dc785a88-2612-4bb6-88e0-65c9c8f13ccc`. Its published reference remains library
**0.2.1 / revision 6**, digest `f770a127-e009-5152-a1d7-ff88c000e7c6`.

The sample now calls exact generated BuildConfiguration, ApplyConfiguration,
ReadState and ResolveInstance helpers. Apply and Reset commit screen state only
after native acceptance. The isolated SDK rejection control sends
`{"commands":null}` through ApplyConfiguration and leaves Draft/Applied state
alone. Prearmed native Close and Toggle sequences run after the matching opened
event. A native If removes the primary Block for real disposal, a sibling remains
mounted, and a separate screen exercises navigation cleanup. These are test
controls for the SDK, not a change of product scope to the command palette.

Actual native UI interactions passed all 17 generated cases: mount; accepted
update; form and SDK rejection; Open, Close and Toggle; all five declared events;
repeated render; navigation/disposal; siblings; Close-while-open; Toggle-to-close.
Observed event payloads and command results passed their manifest schemas. The
checks also established accepted-state preservation, unchanged updates, stable
instance identities during rendering, new identities after remount/navigation,
targeted sibling delivery, keyboard shortcut cleanup and focus restoration.
Missing and ambiguous roots refused dispatch. Earlier unsettled observations and
one inconclusive click immediately after Apply remain preserved; later settled
observations are the passing witnesses.

Independent library graph review matched all 14 generated sources and signatures,
all 13 parent action signatures/output assignments, Ready's five native action
references and the five private forwarders. Critical lifecycle branches and
assignments were inspected. The first graph traversal incorrectly missed
`IAssignment` children; a correction is explicitly retained with the original
observation. This is not a platform inability to expose assignments. Some nonempty
native Text expressions really are exposed only as length/hash, and the inspected
Script metadata does not provide imported source bytes. The evidence has not yet
been converted into a complete coherent `NativeReadBack` and confirmed
`AppliedBaseline`; no broad unchanged-rerun claim is made.

Fresh served captures from the actual revision 7 URLs retained these original
hashes, without normalization:

| Asset      | Served bytes | SHA-256                                                            | Qualified-package comparison                                         |
| ---------- | -----------: | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| JavaScript |       59,120 | `04feea24c0eeae7976f80e153739ecc34983e63bafd7cc2fe67425b6708bbaa6` | Mismatched; removing the three-byte BOM matches only as a diagnostic |
| CSS        |        6,199 | `a5e08c940d69aeb1922d8fdcf439a0b59ac3fa759ae341f15f6236c24a656c89` | Exact                                                                |

The current screened export is
`.build/odc-event-binding-2026-10-09/wrap-demo7-export/run.json` (81 files,
8,230,274 bytes for the bundle). It validates with no problems. Copying the whole
bundle to a fresh temporary directory preserved every file hash; offline
validation and inspection succeeded there and correctly returned
`fresh-read-back-required`. This is a portability check in the existing context,
not the fresh-context real-bundle evaluation required by task 8.3. The consumer's
preview is attached as an observation to the library run, not mislabeled as
same-asset qualification. Earlier exports and failure evidence remain untouched.

Resume with the exported run, corrected library graph review and demo revision 7
graph. Resolve the remaining exact mappings and Block defaults, review ownership
and establish the complete baseline before an inspection-only reconciliation.
Record platform version if it becomes observable. Preserve the BOM discrepancy;
a byte-transfer fix or transformation policy is separate work. Do not duplicate
assets, overwrite unknown user content, repeat the resolved quota failure or
claim native qualification. The working implementation and preview evidence are
ready for review; OpenSpec remains open for the two outstanding proof tasks.

### Final checkpoint — 2026-10-11: complete read-back and unchanged resumption

This wrap started with repository guidance and the previous exported real bundle,
without the earlier integration conversation. The original bundle correctly required
fresh inspection. After the user restored MCP, current native identity checks confirmed
library revision 6 / release 0.2.1 and demo source/deployed revision 7. All operations
in this wrap were read-only; no assets were duplicated or overwritten.

The normalized read-back covers all 14 exact JavaScript sources and native signatures,
13 wrapper output assignments, Ready's five action references, five event forwarders,
Block inputs/defaults/events, lifecycle branches, root-scoped consumer resolution and
two resource mappings. Exact nonempty default literals came from a separate read-only
Mentor inspection; the graph's lossy ASCII hashes only corroborate those literals.
The normalization script asserts the actual native expressions before projecting them
into the plan vocabulary. Bridge schemas remain distinct from native Text types.

Reviewed ownership covers only those 36 inspected identities. The baseline contains
observed content, not desired fingerprints. A second independent library graph matches
it, and fresh HTTP captures match the preserved served hashes. The complete current
library graph (979 nodes / 2,064 edges) and consumer graph (13,061 nodes / 24,558 edges)
match the previous export after excluding author metadata and ignoring edge order.
This preserves unowned content as well as integration elements. One repeat consumer
graph request timed out with HTTP 504; that failure is retained alongside the successful
fresh graph and final stable publication/deployment identities.

The continuation fix recognizes a confirmed library release at the same asset/revision
without demanding an application deployment of the library. Consumer deployment stays
separate. A regression test keeps failed, older and differently identified releases
from satisfying that step. The workbench layout fixture now uses a fixed catalog
version; separate behavior tests assert the real 3.0.0 metadata. The original visual
failure showed only version text changing from 2.0.0 to 3.0.0, and its evidence is
preserved. No screenshot baseline or visual tolerance was changed. A subsequent
Firefox trace exposed fragment links resolving against the original URL after
`history.replaceState`, reloading the workbench and clearing live state. Ordinary
fragment clicks now update the current URL's hash directly, preserving the selected
version and session; modified clicks retain standard browser behavior. The existing
navigation, activity retention and reset scenarios exercise this correction.

The final screened export and its relocation check report zero problems,
`native-state-unchanged`, zero conflicts, `assetIdentity: mismatched` and
`nativeQualified: false`. Imported model bytes and platform version remain unavailable;
the recorded native comparison is explicitly scoped to inspected source/wiring and
captured served bytes. Resolving full native certification is separate follow-up work.
