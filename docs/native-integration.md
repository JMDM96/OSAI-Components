# Native integration preparation and live checkpoint

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

In a separately authorized live session, consult actual tool descriptions and input
schemas. Authenticate lazily and resolve real environment/app keys, inspect current
state, and review the exact reconciliation result. Use context lookups and keep OML
server-side. Mentor needs a terminal successful result and its newest session token
before resumption or publication. Poll immediately while a cursor advances; when
drained, use the harness background continuation mechanism and the tool's cadence.
An unavailable capability is a Studio/manual handoff, not permission to invent a
tool. Browser asset ingestion must be supported explicitly; .NET external-library
upload cannot ingest UI assets. Manual imports also require native mutation authority.

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
