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
