# Command palette: final ODC runtime rerun

**All 17 native runtime cases passed on 2026-10-11.** The rerun exercised the
deployed ODC screen through its native controls, from 23:42:23 to 23:47:00 UTC
(19:42–19:47 America/New_York). No component or native implementation fix was
required. The browser reported no console warnings or errors.

The separate formal certification gate remains incomplete: `platformVersion`
is unavailable, and the served JavaScript includes a three-byte UTF-8 BOM absent
from the qualified package. These existing limits were reconfirmed and retained;
the passing runtime cases do not override them.

## Verified target

| Identity       | Observed value                                                                       |
| -------------- | ------------------------------------------------------------------------------------ |
| Component      | `command-palette@3.0.0`                                                              |
| Library        | OS AI Components — `e13398dc-01ec-4955-a60b-2a6d7d99f357`, revision 6, release 0.2.1 |
| Consumer       | OS AI Components Demo — `f5aec50e-0cd1-4cc3-997f-0867943275fc`, revision 7           |
| Environment    | Development — `1f9d2491-b5ae-4415-8993-31f17583b2d5`                                 |
| Deployment     | `50a5cec0-70cf-4025-aafc-2df3277115d8`                                               |
| Browser / host | Codex In-app Browser / macOS arm64                                                   |

Independent MCP identity checks before and after execution confirmed unchanged
source revisions, model digests, library release and consumer deployment.
The existing complete source/wiring inspection remains bound to those same
published identities. This rerun made no native edits, publications or deployments.

The final qualified package digest is
`a8faf37282b314dadbf02f97670a68414d71fe3efc3c6ea71243ba2fe44039f5`; the evaluated
ODC plan digest is
`3804ceab37ff0fb0c080f1a65ffdf76ffb212eadee2c23868fca29506661aa9a`.
As recorded in the [completion report](repeatable-odc-completion.md), executable
native sources and resources match the final package's implementation; only
certification provenance changed after the pilot package was assembled.

## All 17 cases

| Case                    | Result and observed behavior                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Mount                   | Passed: ready state, complete accepted configuration, one unique instance per Block.                                                           |
| Accepted update         | Passed: valid title update returned `updated`; identical reapply returned `unchanged`; instance identity persisted.                            |
| Form rejection          | Passed: malformed JSON returned `invalid-json` before SDK dispatch; accepted state and event log stayed unchanged.                             |
| Bridge rejection        | Passed: actual native SDK error control returned `validation-error` and one Block error; accepted state survived and a valid update recovered. |
| Close command           | Passed: declared result schema, `isOpen=false`, correct primary event and stable sibling.                                                      |
| Open command            | Passed: declared result schema, `isOpen=true`, addressed dialog and instance.                                                                  |
| Toggle command          | Passed: declared result schema, opening and closing transitions.                                                                               |
| Closed event            | Passed: schema-valid payload, source instance and selection/host/escape reasons.                                                               |
| Command-selected event  | Passed: `find-project`, query `find`, keyboard source and matching instance.                                                                   |
| Error event             | Passed: schema-valid validation error from the actual SDK rejection path.                                                                      |
| Opened event            | Passed: schema-valid payload identifying the addressed Block instance.                                                                         |
| Query-changed event     | Passed: query `find`, one result, correct source instance.                                                                                     |
| Repeated render         | Passed: three renders retained both instance IDs; subsequent sequence delivered one opened/closed pair.                                        |
| Navigation and disposal | Passed: removed primary rejected commands and shortcut; sibling remained usable; remount and navigation return created fresh lifetimes.        |
| Siblings                | Passed: independent primary/sibling commands and events; absent and ambiguous roots failed without dispatch.                                   |
| Close while open        | Passed: prearmed native sequence opened then closed, hid the modal and restored focus.                                                         |
| Toggle to close         | Passed: prearmed native sequence opened then toggled closed, hid the modal and restored focus.                                                 |

The evidence contains 36 timestamped observations. Its assertion script validated
46 event payload occurrences and 20 command-result occurrences against the
declared JSON schemas; these counts include repeated snapshots of the same logs.
Two complete demonstrations each contained exactly one delivery of all five events.
The final screen retained the accepted defaults and reported `ready` after the
intentional error test.

Navigation's immediate transitional snapshot is preserved alongside the settled
observation. Disposal was evaluated after both old hosts detached. An initial
evidence-assembly assertion required separating combined notes into one observation
per expectation; its script and diagnostic are retained. No runtime assertion or
repository evaluator was weakened.

## Evidence and limits

The local evidence directory is `.build/odc-rerun-2026-10-11/`:

- `browser-observations.json`, `browser-console.json` and `final-state.jpg` record
  the native screen execution.
- `identities-before.json` and `identities-after.json` bind the observations to the
  actual deployed consumer and published library.
- `evaluate-rerun.ts` and `preview-suite-results.json` contain the assertions,
  per-case witnesses and formal evaluation.
- `served.js`, `served.css` and `served-comparison.json` preserve fresh original
  HTTP bytes from the browser-observed URLs.
- `export/run.json` is the screened portable handoff. It retains the previous
  evidence and adds this consumer rerun without promoting the library's readiness.
- `relocation-validation.json` records successful validation from a separate
  temporary directory, with zero bundle problems and unchanged native state.

All 100 files in the previous qualified export remained byte-for-byte unchanged.
The new export has 116 evidence attachments. It retains the exact final package
and plan binding, reviewed native baseline, and historical failures.

Fresh CSS is exactly 6,199 bytes, SHA-256
`a5e08c940d69aeb1922d8fdcf439a0b59ac3fa759ae341f15f6236c24a656c89`.
Fresh JavaScript is 59,120 bytes, SHA-256
`04feea24c0eeae7976f80e153739ecc34983e63bafd7cc2fe67425b6708bbaa6`.
The qualified JavaScript is 59,117 bytes; the difference is solely the leading
UTF-8 BOM. Original bytes were not normalized to manufacture an exact match.

The final evaluator therefore records **17 passed cases**,
`issues: ["missing:platformVersion"]`, `previewPassed: false`,
`exactPackage: mismatched`, and `nativeQualified: false`.
This completes the requested ODC runtime rerun on the recorded browser/host;
full native certification remains a separate unresolved milestone.
