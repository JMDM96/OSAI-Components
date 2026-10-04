---
name: outsystems-library-integrate
description: Prepare or apply an OSAIComponents native OutSystems integration plan using actual inspected identities and available live tools. Use for adapter integration, not generic browser component authoring.
---

Read [native integration protocol](../../../docs/native-integration.md) and
[resource lifecycle](../../../docs/integration.md). Generate the detached plan
with `npm run native-plan -- --component <id>` after building and inspecting the
release. Local planning does not authenticate, mutate a tenant, publish, or deploy.

For an explicitly requested live operation, inspect the current tool catalog and
follow each description/input schema. Before the first OutSystems call, call
`authenticate`, share its returned URL, and wait for the user's confirmation.
If a remote localhost callback cannot load, use the user's full callback URL with
`complete_authentication`; never store it in files, plans, logs, or evidence.
On `data.category: AuthError`, authenticate again and retry the original call once.
Surface an authenticate error verbatim without guessing server internals.

Resolve app/environment/asset keys with actual inspection or ask for the missing
identity. Never infer opaque IDs from names. Pass the environment per scoped call.
Use context lookups for inspection and server-side Mentor sessions for OML edits;
OML bytes stay server-side. Reconcile against read-back state, protect user-owned
conflicts, and read back after any partial failure before retrying. Echo refreshed
session tokens only to the tool that requires them; exclude secrets from evidence.

Confirm the available tool can ingest browser static assets. If not, provide the
concrete Studio/manual import handoff from the plan. `extlib_upload` is for .NET
server libraries, never UI scripts/styles/images. Native edit authority does not
authorize publication or deployment. Obtain missing authority only after the
concrete result is reviewable. Poll long-running tools per their live cursor and
cadence instructions; do not invent success or retry non-auth failures blindly.

Record the live ODC checkpoint using the linked template. Leave O11 and mobile
unexecuted unless those exact lanes were actually exercised and evidenced.
