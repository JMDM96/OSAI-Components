---
name: outsystems-library-integrate
description: Prepare or apply an OSAIComponents native OutSystems integration plan using actual inspected identities and available live tools. Use for adapter integration, not generic browser component authoring.
---

Read [native integration protocol](../../../docs/native-integration.md) and
[resource lifecycle](../../../docs/integration.md). Generate the detached plan
with `npm run native-plan -- --component <id>` after building and inspecting the
release. Local planning does not authenticate, mutate a tenant, publish, or deploy.

Before live work, read the complete installed official `outsystems-mcp` skill from
the host's skill catalog. Then inspect the actual available tool descriptions and
input schemas. Follow that skill's client authentication, Mentor session, polling,
and error rules; do not assume authentication tool names or invent signatures.
The observed official interface uses client-managed OAuth, with no server
`authenticate` tool. Missing installation or connection is a pending prerequisite;
Mentor is the intended route and Studio is not an automatic substitute.

Resolve app/environment/asset keys with actual inspection or ask for the missing
identity. Never infer opaque IDs from names. Pass the environment per scoped call.
Use context lookups for inspection and server-side Mentor sessions for OML edits;
OML bytes stay server-side. Reconcile against read-back state, protect user-owned
conflicts, and read back after any partial failure before retrying. Echo refreshed
session tokens only to the tool that requires them; exclude secrets from evidence.

Require matching passing browser certification before claiming native readiness.
Report package, certification, official interface, identities, asset transfer and
host smoke separately, as described in the protocol.

Confirm the available tool can ingest the exact browser static assets. Document
uploads and a successful prompt alone do not establish resource ingestion. If not, provide the
concrete Studio/manual import handoff from the plan. `extlib_upload` is for .NET
server libraries, never UI scripts/styles/images. Native edit authority does not
authorize publication or deployment. Obtain missing authority only after the
concrete result is reviewable. Poll long-running tools per their live cursor and
cadence instructions; do not invent success or retry non-auth failures blindly.

Record the live ODC checkpoint using the linked template. Leave O11 and mobile
unexecuted unless those exact lanes were actually exercised and evidenced.

Use ODC native-plan `3.0` / `odc-block@1.0` and its exact nodes, signatures,
bindings and preview inventory. ODC plan `2.0` is historical inspection only;
O11 retains its existing mapping. Read-back completeness comes from every expected
source/wiring/resource entry at a coherent revision, never summaries or supplied
fingerprints. Compare actual content with desired and prior confirmed state;
require an explicit adoption decision and protect unexpected edits.
Check Ready's actual native referenced-action entries for every event forwarder.
The exact generated source captures `$actions`; matching that text does not prove
the native `ReferedClientActions` metadata exists or that Block events can fire.

When the live catalog offers a direct published-model graph, use it for published
JavaScript and structural read-back instead of repeatedly asking Mentor to quote
source. Keep draft inspection separate: a published graph cannot verify unpublished
edits. Check actual source strings, not reported lengths; request lossless chunks
when a draft response omits long source. Graph resource metadata does not prove
the imported Script body or served bytes. Exclude author metadata from curated
evidence without modifying source strings.

Use `npm run native-run -- init|inspect|validate|export` with explicit paths as
shown in the protocol. Preserve operation history, relative hashed evidence and
scoped human-request references. A record cannot authorize itself: read accessible
trusted human requests before reusing their scope. Do not ask again for an already
covered target/operation. Recheck current authentication through the official skill.
Never save raw session/OAuth responses. Screen evidence before persistence; source
that requires redaction cannot retain a complete-source claim.

Distinguish transfer support from inspected completion. A completed manual import
can unblock native editing; document attachment success cannot. Establish an
accessible published/deployed shell and a referenceable library release before
extensive demo construction. Manual instructions must name an accessible inspected
asset. Publication, release identity and selected-environment deployment are separate.

Use the initial operation plus at most two diagnostic retries, each justified by
new evidence. Stop unchanged quota failures and currently rejected routes. After
possible partial mutation, inspect current state before retrying. Stop pagination
when no usable new cursor remains; status polling follows the official skill
separately. Keep browser tab identity through redirects and wait for the expected
screen marker and deployed revision. Execute the native preview entry points in
[the preview protocol](../../../docs/native-preview.md), preserving modal accessibility.
An original served-byte mismatch remains a mismatch even when preview works.
