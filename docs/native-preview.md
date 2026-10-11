# Native preview suite 1.0

The detached ODC plan's `preview.cases` is the authoritative case inventory. Every
case supplies preconditions, a native entry point and observable expectations.
Store results separately with case ID, actual native entry, passed/failed/blocked/
not-executed status, timestamp/context, evidence references and observations for
each expectation. `evaluatePreview` requires plan digest, platform version, app,
environment and matching expected/deployed revisions. Missing cases or metadata
remain explicit. Aggregate counts and a Mentor success summary cannot replace them.

Build only this minimal sample after the accessible shell and library reference
are verified:

1. Place two Library Blocks in separately identified roots with unique lifetime
   instance IDs. Bind full valid configurations. Show readiness via `ReadState`.
2. Keep editable draft JSON separate from last accepted JSON. Parse JSON for form
   feedback, then pass the serialized full configuration through native input/
   `ApplyConfiguration` wiring. Do not reproduce the package's semantic validator
   in the sample. On failure show envelope code and retain accepted JSON; during
   loading wait for `ReadState` instead of presenting the pending input as accepted.
3. Provide command controls routed through `ResolveInstance(BlockRootId)` and the
   generated `Command_<name>` wrappers, plus an event log populated by Block Events.
   Bind every event's positional `PayloadJson` Text to its matching event handler.
4. Provide separate malformed-form and bridge-invalid test paths. The former never
   reaches Update. The latter bypasses only the sample form parser and passes a
   schema-invalid JSON string through native `ApplyConfiguration`. For the palette,
   `{"commands":null}` exercises bridge rejection and the declared error event.
   Then apply valid JSON and verify recovery without losing the accepted state.
5. Exercise repeated Render, navigation away/back and overlapping sibling lifetime.
   Check cleanup of the detached instance and continued operation of its sibling.

For the palette, arm `SampleCloseSequence` before opening: resolve the intended
instance, invoke native `Command_open`, and when the matching Block `opened` event
arrives invoke native `Command_close`. `SampleToggleSequence` follows the same flow
but invokes `Command_toggle` after `opened`. Clear the armed sequence after the
single matching event or on navigation/disposal; reject errors and overlapping
sequences visibly. This makes Close-while-open and Toggle-to-close testable while
the modal correctly makes surrounding controls inert. Do not remove inert/focus
behavior or substitute direct browser-console bridge calls. The local executable
harness checks the wrappers and forwarding path; the live pilot must check the
actual native actions and record their entry paths.

The recipe covers every command and event declared in the manifest. Choose valid
witnesses from the component's package schemas/scenarios and record actual payloads;
the generic generator does not invent arbitrary application data. An undeclared
error event is never added for a fixture: use its native diagnostic local output.

Preview success and exact asset identity are separate. Capture served response
bytes unchanged, including any UTF-8 BOM, and compare their hashes with the package.
A working preview with mismatched bytes can be recorded as such. It cannot grant
exact-package identity or native qualification. O11 and mobile remain unexecuted
unless independently exercised.
