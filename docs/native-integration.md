# Native integration preparation and live checkpoint

The [first ODC trial pain-point record](odc-integration-pain-points.md) captures
observed difficulties, assistant/process mistakes, open questions and the latest
recorded pause state. Continue that record during the trial; its brainstorming
questions are not new integration requirements or agreed implementation tasks.

`npm run native-plan -- --component command-palette` writes detached plans under
`.build/native-plans/command-palette/2.0.0/`. For the resource fixture, add
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
