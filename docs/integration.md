# OutSystems integration boundary

The repository produces browser assets and a precise adapter contract. Creating a native Library Block remains a Studio or separately authorized Mentor workflow. No local build downloads OML, invents asset/environment keys, contacts a tenant or publishes an application.

Use the target's generated `integration.md`, `adapter.json`, schemas and checksums together. A target label records the intended host; it does not prove that a tenant has executed the package. Start with ODC, then repeat the same smoke tests independently for OS11 Reactive/Mobile. Traditional Web is excluded.

## Native Library wrapper

1. Import the target JavaScript as a Required Script and its CSS into the Library's styles/resources. Preserve the packaged bytes and record their checksums.
2. Create a Block with one empty Container. Pass its actual runtime DOM ID to `create`; use an instance ID unique for that Block lifetime, including overlapping screen navigation.
3. Map primitive Block inputs and complex Structures/Lists into the complete configuration JSON described by `schemas/config.schema.json`.
4. On Ready, once the container exists, call `create`, check the returned envelope, and register callbacks for the declared events. Store subscription IDs and the last accepted serialized configuration in Block state.
5. On Parameters Changed or a guarded Render, skip identical accepted configurations; otherwise call `update` with the complete next configuration. Only update the remembered state after success.
6. Expose declared synchronous commands as Client Actions through `invoke`. Their arguments and results follow the generated schemas.
7. Forward callback `value.payload` data to named Client Actions/Block Events. Delivery is asynchronous and ordered per instance; application business logic stays in OutSystems.
8. On Destroy, call `dispose` even when conditional rendering or navigation already removed the host DOM. Unregister individual callbacks when their consuming action is no longer needed.

The bridge input boundary is strings and JSON strings; the only non-JSON argument is the host callback function. Every operation returns a serialized envelope with `contractVersion`, `ok`, `code`, `message`, and optional `path` and `value`. Branch on stable codes. Raw exceptions and internal implementation objects never belong in Block inputs or events.

## Full updates and recreation

An update replaces the complete normalized configuration. Omitted optional values regain their manifest defaults; omitted required values and invalid `null` fail. Invalid payloads preserve the last valid state. Keep the complete configuration in the adapter; do not send a merge patch.

If a future component declares a property with `updateMode: recreate`, a valid change to that property returns `recreation-required` without changing the current instance. The wrapper must then explicitly dispose, create using the new configuration, and re-register callbacks. Check every outcome. Other update errors do not authorize recreation. The command palette's current inputs are all live.

## Mentor recipe

Each target contains `mentor-recipe.json`, including the exact assets and lifecycle steps. Its required inputs are the real asset and environment identifiers and its `publish` field is false. Read-only app context can resolve user-supplied names to canonical keys; opaque IDs must never be inferred from examples.

For later authorized native edits, provide Mentor the adapter and schemas, then ask it to create the Library wrapper, Inputs, Structures, Client Actions and Events. Import binary/static assets through Studio or a supported, authorized transfer mechanism if Mentor cannot ingest them. OML stays server-side. Mentor does not replace compilation or contract validation. Publishing and real-environment testing require the user's specific target and authorization.

## Platform smoke evidence

Run these checks on the exact checksummed release in the named platform version:

| Area                 | Required observation                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Assets and readiness | Required Script and stylesheet load before Block initialization under the tenant's CSP.                |
| Creation             | One owned root appears inside the supplied Container; duplicate live IDs fail without replacing it.    |
| Update               | Complete valid configuration changes live; invalid updates preserve the prior view.                    |
| Commands             | Open, close and toggle return synchronous envelopes and remain idempotent.                             |
| Events               | Selection reaches the intended Block event once, with its originating instance ID.                     |
| Lifecycle            | Repeated Render, Parameters Changed, conditional rendering and overlapping navigation remain isolated. |
| Disposal             | Destroy releases roots, callbacks, shortcuts and modal locks after normal or removed-host navigation.  |

Record target, platform version, environment and asset identity, suite version, artifact checksums, lane (`reactive-web` or `mobile-webview`) and each measured result. A real mobile-webview run is separate evidence from desktop Reactive Web. Failed or absent smoke results leave artifacts at most `browser-verified`.

The local evidence validator rejects an OutSystems-level claim without the required host checks and matching hashes. It validates report structure and consistency; an evidence record itself is not a cryptographic attestation of who performed a test. Keep raw reports and any organization-required approvals with the named environment's release records.
