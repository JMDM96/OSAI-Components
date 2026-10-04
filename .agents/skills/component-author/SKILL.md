---
name: component-author
description: Create or change a browser component in OSAIComponents using its manifest, generated SDK bindings, managed resources, and certification scenarios. Use for this repository's component packages, not tenant OML edits.
---

Read [authoring](../../../docs/authoring.md) and the relevant contracts in
[durable specs](../../../openspec/specs). Scaffold a new ID with
`npm run scaffold -- <id>`; it registers workspace metadata and project references.
Use the generated `src/generated.ts` bindings with `defineComponent<Bindings>`.
Edit the manifest first, run `npm run bindings`, and leave generated files generated.

Keep DOM/CSS scoped to the component. Allocate listeners, timers, observers,
workers, portals, and operations through managed ownership. Updates prepare
provisional work and provide commit/rollback; a rollback failure quarantines the
instance. Commands return synchronous JSON acknowledgements; long work completes
through declared events. Select only a profile the implementation can qualify.

Implement every declared command/event scenario plus accessibility and visual
states in the component's certification module. Add valid and invalid input
witnesses; assertions must exercise the public bridge. Use
`npm run validate -- --component <id>`, `npm run typecheck`, and
`npm run build -- --component <id>` before certification.

For a realistic authoring evaluation, use an isolated copy of the repository.
Record the agent's decisions separately from deterministic test results. Shared
platform edits are not an acceptable shortcut for making a new component work.
Preserve user changes and existing release bytes.
