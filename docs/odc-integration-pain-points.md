# First ODC component trial: pain points and open questions

**October 7 update:** the existing demo is now published at revision 4 and its
component works in the live browser. See the [verified demo checkpoint](odc-live-demo.md)
for the URL, runtime observations and remaining qualification gaps. Earlier pause
states below are retained as historical evidence.

**For the next context:** start with [the exploration handoff](#exploration-handoff-for-the-next-context).
There are now **27 observations**. PP-22–PP-27 were added after reviewing the
successful run; they distinguish observed workflow problems from untested behavior
and possible contract differences. No new tenant operations were performed for
this documentation review.

The initial capture covered setup and integration work of October 6–7. The
historical pause table below describes **2026-10-07 06:54 UTC** (October 6,
23:54 America/Los_Angeles). The successful publication and browser checks took
place on October 7 local time (October 8 UTC), as recorded in the demo checkpoint.

## Purpose and how to continue this record

The user wants this first end-to-end trial to expose what makes component creation
and deployment difficult, so the pipeline and skills can become useful and reliable.
Capture assistant mistakes as well as platform and tooling limitations. This is
material for a later post-mortem and brainstorming session; the questions below
are not agreed fixes, an implementation backlog, or proven root causes.

When the trial resumes, append new observations and update outcomes against these
stable `PP` identifiers. Retain earlier failures even when a workaround succeeds.
Record what happened, its practical impact, what changed, and what remains unknown.
Later, use the agreed findings to plan changes through OpenSpec. No new OpenSpec
change or implementation tasks have been created for this record.

## State at the pause

| Deliverable                                    | Last verified state                                                                                                     | What this does not establish                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `command-palette@2.0.0` browser package        | Locally qualified on this Mac; exact payload and detached native plan retained                                          | Native ODC behavior or execution on another host                       |
| **OS AI Components** library                   | Published revision **4**, released as **0.1.0**                                                                         | Successful use by a deployed consumer                                  |
| **OS AI Components Demo**, created by the user | Existing app and Development deployment verified at revision **3**, with library references                             | Publication of the demo screens subsequently built by Mentor           |
| New demo implementation                        | Mentor draft has two screens, sample settings, native controls and events; validation reported zero errors and warnings | Browser execution; complete read-back of the latest partial correction |
| Latest correction                              | A review found a global instance lookup; the correction run reported changes applied before failing                     | Exact final code, because detailed read-back was interrupted           |
| Latest publication attempt                     | Mentor usage limit `OS-AISA-42903`; no publication identifier or publication-start event                                | Any new published demo revision                                        |
| Native smoke and served asset hashes           | **Not executed**                                                                                                        | Native certification for ODC, O11 or mobile webview                    |

Two apps have used the same display name. The current, user-created app is
`f5aec50e-0cd1-4cc3-997f-0867943275fc`; the earlier Mentor-only draft is
`d25fd8ab-b643-4476-a3d0-f9b064dc85dd` and never acquired a verified published
source revision. Continue with the user-created app.

The verified runtime address is
[OS AI Components Demo](https://personal-ypbfdmrf-dev.outsystems.app/OSAIComponentsDemo).
At the pause it serves the existing revision, not the new component demo. The
last quota response said 17 hours 7 minutes until reset; that historical estimate
is not a fresh availability check or a guarantee that the next attempt will work.

## Setup and local readiness

### PP-01 — Moving machines required more than installing Node

**Observed:** The new machine's Node minor version differed from the pinned
26.3.1; the retained working setup uses npm 11.16.0. A checkout-specific,
ignored `.cache/activate.sh` selects the local toolchain.

**Impact and outcome:** Setup required investigation before the existing pipeline
could run reliably. The helper works here but does not travel with a fresh clone.
See the [local preflight](odc-preflight.md) for the recorded environment.

**Question for later:** What should a fresh checkout explain, install or diagnose
automatically, including exact runtime selection and missing host dependencies?

### PP-02 — Visual evidence did not transfer unchanged between hosts

**Observed:** The initial Mac run produced 234 passes and 66 visual failures
against the existing references. Host-specific Mac references were subsequently
reviewed: 96 images with 42 distinct image hashes. Windows references were
preserved; numerical thresholds were not relaxed.

**Impact and outcome:** Portability work delayed native integration. The retained
failures and new passing runs distinguish a host baseline problem from an assumed
component defect. No Windows execution of the Mac preparation was claimed.

**Question for later:** How should setup expose supported baseline hosts and the
review effort required when another developer changes machines?

### PP-03 — Local completion was too easy to confuse with delivery

**Observed:** Local qualification passed 321 unit tests and 546 browser tests
across the recorded selections. The OpenSpec preparation change has all 21 tasks
complete, but its scope was preparation, not the live end-to-end trial.

**Impact:** Those milestones did not establish asset import, publication,
deployment or native behavior. The user's repeated requests for a clear completion
status show that my communication did not keep those distinctions clear enough.

**Question for later:** What evidence should accompany each readiness statement
so a user can immediately tell what they can actually open and try?

## Connection, capabilities and asset transfer

### PP-04 — Tool availability and the usable workflow disagreed

**Observed:** The official OutSystems MCP and skill were initially missing.
After setup, authentication belonged to the MCP client rather than a server
`authenticate` tool. The live catalog still listed `mentor_publish`, but invoking
it returned a deprecation rejection and directed publication through a Mentor
prompt containing `Publish`.

**Impact and outcome:** Assumed capabilities and a later retry of the deprecated
route consumed effort without advancing publication. Repository guidance was
aligned with the official interface; catalog discovery alone remained insufficient.

**Question for later:** How should a session remember observed capability limits
and detect stale catalog entries without repeatedly exercising failed routes?

### PP-05 — Successful sign-in did not mean the active connection worked

**Observed:** User/browser sign-in and normal CLI OAuth completion were followed
by `OAuth authorization required` in the active MCP connection. A refresh also
failed with `invalid_scope`. Restarting the connection eventually restored access.

**Impact:** Repeated authentication handoffs required user intervention and made
it hard to distinguish a connection problem from the separate Mentor quota.

**Question for later:** What single, read-only readiness check would establish
that this chat can use the correct tenant after sign-in or a restart?

### PP-06 — Browser asset import had no demonstrated automated route

**Observed:** Sending the roughly 59 KB JavaScript inline was blocked by the
gateway with HTTP 403 before a Mentor run began. A document upload returned
HTTP 200, but using its attachment reference was rejected; Mentor subsequently
reported an empty attachment directory. Studio automation could not open the
required Scripts import menu. The user imported the resources manually.

**Impact and outcome:** Several transport attempts preceded a manual handoff.
Published library revision 3 then contained the Script and CSS resource. Document
upload success had not proved static resource ingestion. The observed automation
failure does not establish that Studio's menu was unavailable to the user.

**Question for later:** Which asset-transfer steps can be supported consistently,
and what exact, minimal manual handoff is needed for the remaining steps?

### PP-07 — Asset presence still fell short of byte-for-byte runtime proof

**Observed:** The CSS model hash matched the qualified 6,199-byte file. The
59,117-byte Script was present, but its source hash was not independently verified.
The hashes of assets actually served by a consumer remain unchecked. Probing
library-only runtime paths returned 404 before a consumer was published.

**Later outcome:** served-byte comparison was completed after publication; see
PP-21 for the exact CSS match and the JavaScript BOM difference.

**Impact:** We cannot yet claim that the deployed consumer serves the exact
qualified package. A library URL returning 404 supplied no asset contents to hash.

**Question for later:** How should the handoff carry artifact identity through
import, library release, consumer publication and the actual browser response?

## Generated native implementation

### PP-08 — Valid native models still contained JavaScript contract errors

**Observed:** Read-back found objects passed where the bridge expects JSON
strings, extra `componentId` arguments in update/dispose calls, and native
callbacks forwarded as objects instead of positional Text arguments. CSS loading
depended on an untriggered continuation and used a hard-coded path. An earlier
demo parser also contained a bare `PayloadJson` reference.

**Impact and outcome:** These needed review and correction despite native
validation. Local checks against the exact bundle exercised creation, updates,
callbacks, disposal and CSS failure/race handling, but cannot prove ODC-generated
signatures or live lifecycle behavior. The library retained a potential OnRender
loop warning whose guard was reviewed; runtime verification remains pending.

**Question for later:** Which contract and lifecycle details need stronger
generation constraints or direct verification before Mentor reports completion?

### PP-09 — The conceptual adapter did not map directly to native actions

**Observed:** Native ClientAction-reference inputs were unsupported in the
attempted mapping. The result uses eight public actions plus block-private
`RegisterCallbacks`, rather than nine public wrappers. Host and resource bindings
needed actual native expressions such as `PaletteHost.Id` and
`Resources.commandpalette_css.URL`.

**Impact:** A detailed local plan still required platform-specific reconciliation.

**Question for later:** Which supported native patterns should the adapter plan
express explicitly, and how should deviations be recorded for the next component?

### PP-10 — Instance isolation regressed when building the consumer

**Observed:** The current demo's read-back used
`document.querySelector('[data-osai-instance-id]')` for native controls. This
selects globally instead of resolving within the intended `PaletteDemo.Id` root.
The requested correction run reported changes applied but hit quota before
returning the detailed code.

**Impact:** Zero errors and warnings did not establish component isolation. The
exact final resolver must be inspected before treating the correction as verified.

**Later outcome:** the resumed read-back confirmed the scoped resolver. The live
test exercised one instance; simultaneous sibling isolation remains untested.

**Question for later:** How can library contracts remain enforceable when Mentor
generates a consumer, particularly with several component instances on one page?

## References, publication and recovery

### PP-11 — Publication and a referenceable library release were separate

**Observed:** Empty public-element searches initially prompted an unconfirmed
index-lag explanation. Adding a reference by known identities then produced an
explicit version-tag requirement. Publishing revision 4 alone was insufficient;
releasing it as 0.1.0 enabled the versioned reference. A pre-release test-app
association was not available through the observed Mentor route.

**Impact:** Reference discovery, publication and release required additional
steps and user decisions. Limited search results were initially overinterpreted.

**Question for later:** What release/reference prerequisites should be established
before constructing the consumer, and which context queries cover Blocks/actions?

### PP-12 — Run success, applied changes and publication success diverged

**Observed:** A successful Mentor run could still contain a publication-failed
event with no publication identifier. Conversely, a failed review run reported
changes applied. Library release returned an ambiguous wrapper result containing
`released: True`; subsequent app and revision inspection verified tag 0.1.0.

**Impact and outcome:** A single status or Mentor's prose was not a reliable
transaction boundary. The ambiguous release was checked rather than blindly
retried. Partial failures require read-back before another edit.

**Question for later:** What result model would make draft mutations, validation,
publication start, publication completion and deployed revision unambiguous?

### PP-13 — The first sample existed only as an inaccessible Mentor draft

**Observed:** The original same-named sample was built in Mentor, but publishing
could not start and surfaced no detailed platform cause. App inspection returned
404 and no deployment. No separate supported first-save/register operation was
exposed. The user could not access this draft through their application list.

**Impact and outcome:** Describing it as a created app overstated what had been
delivered. My proposed manual inspection handoff was not usable. The user instead
created and published the current app with library references, which we reused.
The old draft was preserved, not proven deleted.

**Question for later:** How early should a minimal accessible app be established,
and what evidence is necessary before offering a user a manual recovery step?

### PP-14 — Diagnostics supported fewer conclusions than we suggested

**Observed:** Suspected causes included an all-zero reference hash and the lack
of a listed Release build. The library did have a finished Debug build and valid
release tag. Refreshing dependencies did not fix publication. Temporarily removing
the custom reference still produced the same failure to start publication; the
integration was then restored.

**Impact:** Recovery attempts did not identify the root cause. The experiment
showed that the custom reference was not the sole blocker; it did not prove a
particular platform registration defect. I should have kept those explanations
explicitly provisional throughout.

**Question for later:** What evidence and stopping criteria would make each
diagnostic attempt useful when the platform exposes no actionable error?

### PP-15 — Recovery work accumulated before a usable preview existed

**Observed:** Repeated read-backs, dependency refreshes, publication routes,
temporary removal/restoration and reconstruction in the user-created app occurred
before a live component demo was available.

**Impact:** The user spent time waiting and intervening. My approach contributed
through repeated routes and extensive draft work before securing a publishable
consumer. The record does not quantify time or cost per attempt, or prove how
much of the quota usage these operations caused.

**Question for later:** What smaller end-to-end milestone and bounded recovery
strategy would expose the decisive blocker earlier while preserving useful work?

### PP-16 — Quota interrupted both review and an already-approved publication

**Observed:** Mentor returned `OS-AISA-42903` across multiple stages. The latest
review stopped after reporting applied changes; a separate `Publish` prompt also
hit quota without starting publication. An earlier quota pause was followed by
authentication recovery, adding another independent interruption.

**Impact:** Work spans days, final code remains partly uninspected, and remote
draft/session continuity matters. No draft loss has been demonstrated; a retained
session should not be treated as a portable recovery artifact.

**Question for later:** What must be checkpointed before a pause, how can available
capacity be understood, and how should verification/publication effort be budgeted?

## Collaboration, reproducibility and the future pipeline

### PP-17 — Completion language and approval handoffs created avoidable friction

**Observed:** The user repeatedly asked whether we were done, whether the sample
was actually published, and how they could inspect an inaccessible draft. They
had authorized publication and offered manual help, but still had to clarify the
required outcome. A signed private-draft Studio handoff also encountered an
automatic approval rejection requiring separate action-time approval.

**Impact:** My updates emphasized intermediate activity without consistently
leading with the usable result. Approval boundaries and technical blockers were
not always explained clearly enough. Existing authorization should remain part
of the continuation context; unrelated handoff permissions are a separate issue.

**Question for later:** How should status updates state what is live, what is only
drafted, what is blocked, and precisely why any user intervention is necessary?

### PP-18 — Manual user work rescued the trial but is not yet a repeatable flow

**Observed:** The user imported browser resources and created the published
sample with references. Demo screens, default route, access settings, synthetic
inputs, commands, event logging and navigation checks were assembled during this
trial. The user wants a sample to become part of deployment eventually, but asked
to establish that it works before standardizing that process.

**Impact:** The eventual successful path must account for these contributions;
it cannot be reported as unattended automation. Repeating this for another
component would currently require interpretation and manual work.

**Question for later:** Which parts belong in component metadata, a reusable demo
recipe, native integration skills or an explicit manual handoff?

### PP-19 — Detailed evidence exists locally, but continuity is fragile

**Observed:** Raw checkpoints and read-backs live in ignored `.build/` paths.
The preflight document describes an earlier point before import. Some retained
Mentor narratives conflict with structured outcomes, and two app identities share
one display name.

**Impact:** A fresh checkout or resumed conversation can lose context, mistake
historical status for current status, or select the wrong draft. This note captures
the observed pain points durably in the repository, but is not a replacement for
the evidence artifacts or a claim that they are committed or portable.

**Question for later:** What compact, redacted run record should travel between
machines and conversations while keeping OAuth and Mentor session secrets out?

## Practices worth retaining

- Exact payload identities, preserved failures, reviewed host baselines and
  unchanged numerical gates kept local qualification credible.
- Inspected native identities and concrete JavaScript read-back exposed defects
  that native validation alone missed.
- Checking source and deployment state prevented a failed publication or an
  ambiguous release response from becoming a false delivery claim.
- The user's manual import and published-app workaround provided concrete progress.
- Before publication, native smoke was explicitly unexecuted. The subsequent
  browser checks retain their coverage limits; local tests are not equivalent evidence.

## October 7 continuation observations

**PP-05 / PP-16 outcome:** on resumption, MCP startup again reported OAuth
authorization required before a quota check was possible. Normal
`codex mcp login outsystems` succeeded and restored the active tools without
requiring another connection restart. Mentor accepted the existing session,
completed read-back and published successfully. This establishes availability
for this run, not a permanent authentication or quota fix.

**PP-10 / PP-12 / PP-13 outcome:** the interrupted root-scoping fix was present.
The two screens survived the pause. Mentor publication returned an actual
publication identifier; publication status, source revision and Development
deployment all confirmed revision 4 of the user-created app. The original
Mentor-only draft's first-publication failure remains unexplained.

### PP-20 — A working native sample still lacks controls for every command path

**Observed:** the deployed palette's modal makes the surrounding page inert.
The demo's external Close and Toggle buttons therefore cannot be used while it
is open. Open, toggle-to-open and close-while-already-closed worked; Escape and
selection also closed the palette. Close-while-open and toggle-to-close through
the native wrappers remain untested.

**Impact:** the sample demonstrates the component but does not yet make every
declared native command transition accessible for manual testing. My generated
demo recipe did not account for this interaction between modal behavior and the
test controls.

**Question for later:** What controls or test sequence should a component demo
provide when exercising an action makes other controls intentionally inaccessible?

### PP-21 — Served JavaScript differs from the qualified file by a UTF-8 BOM

**Observed:** the served CSS matches the qualified file byte-for-byte. The served
JavaScript has a three-byte `EF BB BF` prefix; removing that prefix yields exactly
the 59,117-byte qualified JavaScript. Both assets returned HTTP 200 and the component
worked during the browser checks. The point at which the marker was introduced
has not been established.

**Impact:** runtime success does not satisfy the current exact-byte identity
expectation. The original and served hashes are retained separately; no gate was
relaxed and no registered payload was rewritten to hide the difference.

**Question for later:** How should the import path preserve original bytes, or
explicitly document and qualify a native hosting transformation if required?

**Additional observation:** one automated pointer activation of the About screen's
return link did not navigate; Enter on the same link worked. No console error was
observed. Preserve this as an unclassified observation until it can be reproduced.

**PP-15 recurrence in my own tooling:** the first resumed read-back printed a large
raw event payload. Its pagination helper then repeated terminal status reads because
it checked only for a null cursor, while the final response omitted the cursor.
Subsequent polling checked both `hasMore` and a present cursor and summarized events.
This added avoidable calls and output; it was an assistant orchestration mistake,
not evidence of a Mentor failure.

## Additional findings after the successful run

### PP-22 — The demo maintains a second validator whose parity is unproven

**Observed:** the component has a JSON schema and runtime cross-field validation;
Mentor also built a separate `ValidateSettings` action in the sample. The runtime
lowercases shortcut modifiers, normalizes `Control` to `Ctrl`, rejects duplicate
modifiers and rejects combining `Mod` with `Ctrl` or `Meta`. Mentor's retained
summary lists allowed modifier names but does not describe these normalization
and combination rules.

**Impact and uncertainty:** duplicated validation creates another place for the
contract to diverge. Examples such as `mod+k`, `Ctrl+Control+K` and `Mod+Ctrl+K`
would distinguish the described rules, but were not tested in the live sample.
The summary is insufficient to establish a deployed validator bug. The read-back
also describes assigning the Applied fields and showing “Settings applied” after
the sample validator passes; that statement alone does not prove the Block
subsequently accepted the update.

**Evidence:** [configuration schema](../components/command-palette/schemas/config.schema.json),
[runtime validation](../components/command-palette/src/configuration.ts), and
`2026-10-07/demo-readback.json` under the local evidence root.

**Question for later:** How should a demo validate inputs and report successful
application while staying consistent with the component's authoritative contract?

### PP-23 — Requested exact read-back sometimes became a prose assurance

**Observed:** the final review requested exact JavaScript and mappings for the
validator, parsers and resolver. The reply included code for the resolver and
parsers, but only a rule summary for `ValidateSettings` and a description of log
capping/default initialization. I proceeded to the approved publication and
tested selected runtime behavior without closing those source-review gaps.

The older evidence has a further reconciliation gap: `native-readback.json`
describes a `DoUpdate.RequiresRecreation` output and recreation branch, while the
retained `reviewed-glue.json` version of `DoUpdate` does not assign that output.
Those snapshots do not establish which exact code reached the published library.
This does not demonstrate a live failure; the palette's current inputs use live
updates rather than requiring recreation.

**Impact:** a heading such as “JavaScript,” a clean validation count or an assurance
that everything is confirmed can make incomplete evidence look complete. The
record needs to distinguish returned source, reported wiring, inferred behavior
and directly exercised behavior. This is also a review discipline issue for me.

**Question for later:** What constitutes sufficient read-back for each native
element, and how should missing source or conflicting snapshots remain visible?

### PP-24 — The invalid-input check did not exercise the Block's error path

**Observed:** the malformed JSON case was rejected by the sample's own validation
before the Applied values changed. That proves the sample preserved the previous
working configuration. It does not exercise rejection by `bridge.update`, native
error forwarding, or the Block's behavior after a bridge-level failure. The error
handler was reported as wired, but no component error event was deliberately
triggered during the live smoke run.

**Impact:** “invalid update passed” is broader than the evidence unless the layer
being tested is named. The same distinction matters for reported error callbacks,
CSS-load failures, initialization failure and disposal during loading. Local
checks cover some of these; their actual ODC wiring remains a separate question.
These are coverage gaps, not observed runtime defects.

**Evidence:** the invalid-update observation in `2026-10-07/live-verification.json`,
the sample validator read-back, and the distinct native error branches in the
October 6 glue evidence.

**Question for later:** How should the smoke plan distinguish sample-form validation,
bridge rejection, native event forwarding and recovery without counting one as all four?

### PP-25 — Live verification is an execution record, not a reusable test suite

**Observed:** the native trial used an expectation list, manually orchestrated
browser actions, visible event/DOM inspection, a screenshot and a separately
written result JSON. Eight broad checks passed and one was partial. This was not
an execution of the local browser suite against ODC, and the record does not supply
a replayable native test runner, exact browser build or timestamps for every case.

**Impact:** another context cannot reproduce the native result with one recorded
command. Counts such as “eight passed” obscure how many branches were exercised.
For example, the run did not exercise `closeOnSelect=false`, changing/removing the
shortcut, simultaneous siblings, navigation while open, forced loading failures,
or the full keyboard/accessibility matrix. Empty captured console results are a
bounded observation, not proof of every failure path. No failure is inferred from
an untested case, and not every case is necessarily required for a simple preview.

**Evidence:** `2026-10-06/smoke-plan.json`, `2026-10-07/live-verification.json` and
the [native verification requirements](../openspec/specs/outsystems-library-integration/spec.md).

**Question for later:** Which checks define a useful preview versus native
qualification, and what repeatability and evidence should each level require?

### PP-26 — Successful native corrections are not yet reflected in generation

**Observed:** the live wrapper uses eight public actions plus private callback
registration because the attempted ClientAction-reference input was unsupported.
The current [native plan generator](../packages/build-tools/src/native-plan.ts)
still emits `RegisterCallback` with `ForwardToBlockEvent:ClientAction`. The
corrected native glue and sample read-backs are retained under ignored `.build/`
paths; this successful trial did not update their generation workflow.

**Impact:** regenerating a plan still exposes a known reconciliation requirement
from PP-09. The final native implementation cannot yet be assumed reproducible
from the generic plan without the session's accumulated knowledge. Package version
2.0.0, library release 0.1.0, library revision 4 and demo revision 4 are separate
identities, joined in a manually curated checkpoint. Their numbers do not imply
compatibility with future changes.

**Not demonstrated:** a second execution that reports everything unchanged, an
upgrade preserving user edits, or rollback of a changed library/consumer pair.
The durable specification already calls for repeatable, conflict-aware integration;
the local reconciliation model uses supplied fixtures. This trial has not proved
those properties against the tenant. Standardizing the workflow was intentionally
deferred until a working preview existed.

**Question for later:** Which observed native decisions belong in generated plans,
skills or explicit manual steps, and how would a rerun or upgrade prove it preserved
the intended component version and user-owned content?

### PP-27 — Browser automation sometimes obscured the application state

**Observed:** I opened the demo before the new publication completed. Navigation
timed out and the tab redirected to an error URL explaining that the old shell
had no default entry. Resolving the tab by the original URL then failed because
the URL had changed. After publication, the real default screen loaded normally.

Later, accessibility snapshots immediately after navigation still showed the
previous screen while a subsequent DOM snapshot showed the new one. One pointer
activation of the return link did not navigate; Enter on that link worked. This
single event remains unclassified.

**Impact:** timing, changed URLs and differences between observation surfaces can
look like application defects or lost tabs. I added avoidable browser recovery work
by opening the preview before verifying its deployment. For the return-link event,
the evidence does not yet distinguish automation behavior from an application issue.

**Question for later:** What observable condition should each browser check await,
and what evidence is needed before classifying a UI interaction as a product defect?

## Exploration handoff for the next context

The user's immediate preview objective succeeded: demo revision 4 is published
and the real component works. Full native qualification remains incomplete. The
user now wants to explore which lessons, if any, should become improvements. No
new change, implementation backlog, severity ranking or remediation commitment
has been agreed. This review changed documentation only.

Read [the live checkpoint](odc-live-demo.md) first, then this record. For contract
context, read the [native integration specification](../openspec/specs/outsystems-library-integration/spec.md)
and [AI workflow specification](../openspec/specs/component-ai-workflows/spec.md).
Use the local evidence map below when a statement needs deeper inspection. If the
ignored evidence is missing in a new checkout, identify that gap rather than
treating these summaries as exact source read-back.

The following groups are discussion lenses, not priorities or proposed changes:

| Discussion                                           | Relevant observations             |
| ---------------------------------------------------- | --------------------------------- |
| Fresh-machine setup and local proof                  | PP-01–PP-03                       |
| Authentication, capabilities and manual boundaries   | PP-04–PP-07, PP-11, PP-16, PP-18  |
| Native generation, contract parity and source review | PP-08–PP-10, PP-22, PP-23, PP-26  |
| Publication, recovery and assistant efficiency       | PP-12–PP-17, PP-27                |
| Demo testability and what verification proves        | PP-20, PP-21, PP-24, PP-25        |
| Evidence portability and clear handoffs              | PP-03, PP-17, PP-19, PP-23, PP-25 |

Separate demonstrated failures, assistant mistakes, limitations, untested scenarios
and hypotheses before prioritizing. A closed incident can still reveal a repeatable
workflow problem; an untested scenario does not automatically require a fix. Some
requirements already exist, so distinguish missing enforcement/evidence from a
genuinely missing contract. Plan agreed changes through OpenSpec only after that
discussion. No live authentication, Mentor edits or publication are needed merely
to begin the exploration.

Suggested opening prompt for a new context:

> Use OpenSpec explore to review docs/odc-integration-pain-points.md and
> docs/odc-live-demo.md. The first ODC preview works. Help me assess the evidence,
> group underlying causes and decide which improvements are worth pursuing now.
> Distinguish confirmed problems from hypotheses and coverage gaps. Discuss first;
> do not implement or turn every observation into an action item automatically.

## Evidence map and limits

Repository context:

- [Local preflight and qualification](odc-preflight.md).
- [Native integration protocol](native-integration.md).
- [Preparation proposal](../openspec/changes/prepare-odc-mentor-handoff/proposal.md)
  and [completed preparation tasks](../openspec/changes/prepare-odc-mentor-handoff/tasks.md).
- [Mac baseline review](../tests/browser/baselines/reviews/darwin-arm64.json).

Local evidence is under `.build/odc-live/2026-10-06/`. These ignored files are
present on this checkout and may be absent after cloning elsewhere:

| Evidence                                                                                                                                                                           | Observations supported                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `checkpoint.json`                                                                                                                                                                  | State at pause, asset transfer, authentication, publication/release, quota and recovery history |
| `native-readback.json`, `reviewed-glue.json`, `reviewed-wrappers.json`, `check-glue.mjs`                                                                                           | Adapter review and the scope of local glue checks                                               |
| `published-identities.json`, `release-proposal.json`                                                                                                                               | Library identities and release context; verified outcome is in the checkpoint                   |
| `demo-restored-readback.json`, `demoReferenceRecovery-readback.json`, `libraryArtifactAudit-readback.json`, `demoShellPublish-readback.json`, `demoCanonicalPublish-readback.json` | Original draft, reference diagnostics and failed publication recovery                           |
| `existing-demo-build-readback.json`                                                                                                                                                | Current draft structure, zero native validation errors/warnings and the global resolver finding |
| `sample-inputs.json`, `smoke-plan.json`                                                                                                                                            | Synthetic data and pending native checks, not runtime results                                   |

The successful continuation evidence is under `.build/odc-live/2026-10-07/`:

| Evidence                                                          | Observations supported                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `demo-readback.json`                                              | Retained draft, scoped resolver and parser code; validator/logging descriptions are summaries      |
| `live-verification.json`                                          | Source/deployment identities and the bounded manual smoke observations, including partial coverage |
| `served-assets.json`, `command-palette.js`, `command-palette.css` | Observed served bytes, hashes and exact BOM comparison                                             |
| `demo-live.jpg`                                                   | Appearance of the real palette in its published consumer                                           |

The source/spec links in PP-22 and PP-26 support the additional local contract
comparison. The conversation's tool results support the browser timing and
pagination observations. No fresh live reproduction was attempted in this review.

The conversation supplies the user's reported difficulties, approvals and manual
contributions. Read-back summaries contain Mentor claims as well as observations;
they are not all independent proof. Root causes remain unknown where identified
above. No OAuth material, signed draft links or Mentor session handles belong in
this record.
