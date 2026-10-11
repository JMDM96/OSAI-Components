# Native integration preparation and live checkpoint

The [first ODC trial pain-point record](odc-integration-pain-points.md) captures
observed difficulties, assistant/process mistakes, open questions and the latest
recorded pause state. Continue that record during the trial; its brainstorming
questions are not new integration requirements or agreed implementation tasks.

`npm run native-plan -- --component command-palette` writes detached plans under
`.build/native-plans/command-palette/3.0.0/`. For the resource fixture, add
`--component resources --fixture tests/fixtures/resources/component.manifest.json`.
Each target plan binds the complete immutable payload digest, resource graph and
SRI, native mappings, Block inputs/events, commands, lifecycle and error paths.
The plan digest excludes itself; plans and smoke evidence are outside the payload
checksum domain. Regenerate and validate after any artifact change.

The local reconciliation model accepts supplied inspected-state fixtures. It
classifies owned assets as create/update/unchanged and protects user-owned conflicts.
Missing identities are unresolved, never guessed. Incomplete read-back or a partial
failure blocks retry until the state is inspected again. Local tests exercise this
model with simulated capabilities and responses; they make no authentication,
Mentor, tenant, publication, or deployment calls.

For live work, first read the complete installed official `outsystems-mcp` skill
from the host's available skills and then the actual callable catalog/schemas.
The repository skill supplies component contracts; the official skill supplies
authentication, Mentor sessions, polling and error procedures. In the currently
observed interface OAuth belongs to the MCP client, with no server `authenticate`
tool. Do not copy assumed tool names, callbacks or opaque IDs into implementation.
Missing skill or connection is a pending setup prerequisite; Mentor remains the
default route, and an installed Studio does not automatically replace it.

Resolve actual environment/app keys and inspect current state with context lookups.
Keep OML server-side and local filesystem paths out of remote instructions. Reconcile
against complete read-back, protect user-owned conflicts and inspect again after
any partial failure. Keep one Mentor session per app/task and use its newest handle.
A terminal successful run still needs its applied/validation results inspected.
Follow the official skill and live poll schema for cursors, timing and retries.

Confirm a real capability can transfer the exact browser assets and preserve their
bytes; document attachments or natural-language acceptance do not prove static
resource ingestion. If unsupported, provide the exact JS/CSS/resources from the
plan for a Studio import, retaining Mentor for supported native edits. The server's
.NET external-library upload is never a UI asset transport. For the observed 2026-10-06
interface, document uploads accept `.txt .pdf .json .xml .docx .md`; they do not
advertise `.js`/`.css` resource ingestion. Reinspect capabilities in each live session.

Native edits, publication, and deployment have separate human authority. The local
plan grants none. Keep OAuth headers, callback queries, cookies and Mentor tokens
only in the live tool exchange; redact them from persisted read-back/smoke evidence.
The redaction helper is a backstop, not permission to log raw responses first.

## Live ODC palette checkpoint template

Initial state: **not executed**. Local browser results cannot complete this table.
Store a detached, redacted checkpoint alongside the native plan only after the
actual run. Record real inspected keys without credentials and retain read-back
evidence for each change. A publish step needs its own explicit authorization.

| Field or exercise     | Evidence required                                                               |
| --------------------- | ------------------------------------------------------------------------------- |
| Identity              | Actual ODC app/environment keys, platform version, reactive-web lane            |
| Binding               | Plan digest, component/version, full artifact checksums, suite version          |
| Authority             | Human request references for native edits, publication, deployment separately   |
| Static resources      | Read-back URL and SRI mappings, load order, CSP, complete graph                 |
| Block and actions     | Read-back inputs/events, action signatures and logic/error branches             |
| Create / update       | Valid state, invalid-input preservation, replacement configuration              |
| Commands / events     | Every declared member, payloads redacted, ordering and callback isolation       |
| Repeated renders      | Guarded update without duplicate instance/subscriptions                         |
| Navigation / disposal | Busy cancellation, return navigation, zero owned resources, sibling isolation   |
| Outcome               | Per-exercise pass/fail with actual timestamps; partial failures remain failures |

O11 Reactive Web and mobile-webview stay **not executed** after an ODC checkpoint.
They require their own matching artifact, target and lane evidence. The preparation
work in this change does not modify a tenant or claim any native-host verification.

## Preflight states

Report these independently before a verified handoff:

| Condition              | Required observation                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| Package                | Exact artifact checksums and validated detached plan                             |
| Certification          | Passing current browser evidence for that exact package, including host metadata |
| Official interface     | Installed skill read, live schemas inspected and connection actually observed    |
| Identity               | Actual inspected app/library and environment keys                                |
| Browser asset transfer | Demonstrated supported ingestion or a concrete Studio step pending read-back     |
| Native smoke           | Actual named host exercise; otherwise `not-executed`                             |

`integrationProtocol` and `integrationPreflight` are offline models with supplied
observations, not MCP clients or proof of a live connection. A valid plan with
`generated` evidence stays pending. Browser certification with no MCP connection
also stays pending for live work. Preserve local results while resolving external
prerequisites. Neither preflight function grants publication or deployment authority.

## Executable ODC plan 3.0

The current candidate produces `.build/native-plans/command-palette/3.0.0/odc.json`.
Its `implementation` contains `odc-block@1.0` source, native signatures, expression
bindings, named identity/resource slots, lifecycle branches, load order, and a
required read-back inventory. Use those exact nodes. Required scripts load in the
recorded order before Ready; the generated style loader waits for successful CSS
loading, shares links between siblings, and cancels listeners on disposal.
`ReadState` establishes readiness and the accepted configuration after asynchronous
loading. Treat the Ready `loading` acknowledgement as pending.

Public command wrappers accept JSON Text and return envelope Text. Event
registration is Block-private: `Forward_<event>(PayloadJson)` receives positional
Text. No public ClientAction-reference input is supported. Bind Block inputs using
the generated native/JSON mapping; assign default inputs in the native model.
Ready captures each `$actions.Forward_<event>` by its literal name so ODC can
discover the native dependencies. Capturing the whole `$actions` object loses
this information: the live pilot opened the palette but silently lost all Block
events. The static validator requires every generated forwarder (including a
diagnostic forwarder where applicable) and rejects whole-object or dynamic
access. Still inspect Ready's actual `ReferedClientActions` edges and action keys;
local source checks do not prove that ODC created those references.
Use a unique instance ID for each Block lifetime. Resolve consumer commands from
the intended Block root; absent or ambiguous roots must stop the command.

`ApplyConfiguration` commits its accepted JSON only on bridge success. It deduplicates
unchanged inputs and assigns `RequiresRecreation` before explicit disposal,
creation and re-subscription. Rejected ordinary updates preserve accepted state.
`Dispose` releases subscriptions, listeners and styles even after the host detaches.
Components without a declared error event use a native diagnostic local value;
never invent a public Block error event.

## Read-back and safe reruns

Capture one `NativeReadBack` format `1.0` document using the exported types in
`packages/build-tools/src/native-readback.ts`. Identify ODC app, environment,
revision and layer (`draft`, `published`, or `deployed`), observation time and the
last operation inspected. Fill every named slot from actual native inspection.
Every entry carries its native ID, same revision and evidence reference:

- `source:<node>`: exact JavaScript text (`exact-source`). A prose summary or a
  desired fingerprint cannot satisfy this entry.
- `wiring:<node>`: visibility, input/output signatures and every parameter/expression
  binding (`structured-wiring`). Include recreation and error branches in the Block
  lifecycle entry, plus inputs/events and required script load order.
- `resource:<id>`: actual URL/path/kind/integrity mapping (`resource-mapping`).
  Capture model bytes and served response bytes separately, with original hashes.
- A confirmed missing element uses `absent` with null content. Missing inspection
  is not the same as an inspected absence.

`evaluateReadBack` derives completeness from this inventory. Missing source,
summary-only responses, duplicate entries, mixed revisions, stale observations
following an interrupted operation, and incomplete wiring require fresh inspection.
For example, a recreation flow reported as three steps at revision A and source
with two steps at revision B must not be combined into a complete snapshot.

Prefer a direct published-model graph when the current live catalog provides one.
It can supply exact JavaScript-node source, identities, native expressions and flow
edges without a model paraphrasing them. It still observes the published revision,
not the current Mentor draft. In the live pilot, reported source lengths differed
from the supplied contract while later exact source retrieval proved all strings
matched. Treat lengths and equality claims as diagnostics, never source evidence.
For draft retrieval, use lossless source chunks and concatenate them before local
comparison. The observed graph omitted the imported Script body and represented
CSS bytes only as resource metadata; those fields do not establish package identity.

`reconcileNative` compares desired contract, current observed content, and the last
confirmed applied baseline. First-time adoption needs an explicit decision reference
for each existing native element. An ownership label alone is insufficient. Changes
relative to the confirmed baseline are conflicts, even for integration-owned code.
Review unexpected differences before replacement. Preserve the prior snapshot and
failure; inspect actual current content after partial mutations before continuing.

A resource mapping says nothing about served bytes. Missing captures keep exact
identity unverified. A UTF-8 BOM changes the original hash: a BOM-only diagnostic
may explain the mismatch, but never satisfies exact-package identity. Native state
may be unchanged relative to its prior snapshot while exact-package comparison
continues to fail.

ODC `implementation.loadOrder` records the executable native sequence: host-loaded
scripts, resource registration, managed stylesheet completion, then component
creation. The package's generic `resources.loadOrder` remains the standalone
browser import order; it must not be copied as the native runtime sequence.

## Portable offline records

Run-record `1.0` lives outside registered payloads. Initialize with explicit paths:

```sh
npm run native-run -- init --plan .build/native-plans/command-palette/3.0.0/odc.json --package dist/command-palette/3.0.0 --out .build/new-native-run
npm run native-run -- inspect --record .build/new-native-run/run.json
npm run native-run -- validate --record .build/new-native-run/run.json
npm run native-run -- export --record .build/new-native-run/run.json --out .build/exported-native-run
```

The new output directory must not exist. `init` binds an inspected local package
and plan but grants no tenant authority. Inspection is read-only and makes no
network calls. An exported bundle includes `run.json`, `plan.json`, and only the
allowlisted evidence inventory. Paths are relative and hashes bind the original
bytes; copying the entire directory to another machine preserves validation.
Copying only `run.json` reports missing evidence and cannot preserve readiness.

Collect structured observations, exact source/wiring, safe human-request references,
per-case preview results and resource bytes. Never persist raw tool logs, OAuth
headers, cookies, callback queries, signed private URLs or Mentor session handles.
Screen attachments before saving; the exporter rejects recognizable authentication
material and does not copy unlisted files. This is a backstop, not a guarantee that
arbitrary prose is safe. If exact source needs redaction, mark it incomplete and
obtain a safe independent source observation before claiming completeness.

Record outcomes independently: terminal run, possible draft mutation, native
validation, publication, referenceable library release, selected-environment
deployment, preview, exact resource identity. A successful Mentor run with failed
publication is not a deployed preview. A failed run may still have applied edits.
A published revision without a referenceable release ID does not establish a valid
consumer dependency. An old deployment cannot test a newly published revision.
Records retain history; current continuation is derived rather than asserted.

A confirmed library release for the same asset and published revision satisfies
its distribution step; a library is not an application deployment. The run keeps
library publication/release separate from the consumer application's environment
deployment. An older, failed or differently identified release does not satisfy
that prerequisite.

## Resumption, manual transfer and bounded recovery

Retain request references scoped to app, environment and edit/publish/deploy
operations. A live caller must independently read the accessible human request:
record fields cannot grant authority. Reuse valid same-scope authorization; request
only missing authority for expanded or revoked scope after making the work reviewable.
Recheck connection/authentication through the installed official skill on resumption.

Separate transfer capability from completion. When automation cannot import UI
assets, give the user the exact plan files, checksums, native destination and required
read-back. An inspected manual import unblocks supported native editing even if the
automated ingestion tool remains unavailable. Document attachments and uninspected
imports do not. Resource conflicts require a decision before replacement.

Establish an accessible consumer with a default route and a verified published and
deployed shell before extensive demo work. Verify the library release/reference ID
before wiring components. If the draft is inaccessible or unpublishable, stop adding
features; offer a recovery path to an actually accessible inspected app or Studio
asset, never an instruction to open an app that only exists as an unavailable draft.

Record each attempt's operation, route, hypothesis, condition and new evidence.
The budget is the initial operation plus two diagnostic retries. No new evidence
means no retry. A rejected route stays stopped until relevant conditions change;
another catalog listing alone is not such a change. Quota errors create a checkpoint
until the condition changes. Possible partial mutation requires read-back first.
Preserve inconclusive experiments without inventing a root cause.

For event pagination, stop on `hasMore=false`, a missing/empty cursor, or a repeated
cursor. Status polling is a separate operation and follows the official live schema
and cadence. Never repeat the final event page as a status poll. After browser
navigation, retain the tab ID through redirects and wait for the expected deployed
revision and screen marker before classifying the page. Authentication recovery,
quota recovery and browser continuity are distinct decisions.

The [preview protocol](native-preview.md) and [offline replay protocol](native-replay.md)
provide the remaining local handoff checks. Local replay and browser qualification
leave the authorized live ODC pilot and unchanged native rerun unexecuted.
