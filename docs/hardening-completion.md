# Component platform hardening — local completion

Qualification date: 2026-10-04. Change: `harden-component-platform`.
The local platform is qualified for the recorded browser matrix. The live
ODC/Mentor checkpoint, O11 tenant execution and mobile-webview execution remain
**not executed**. No tenant authentication, edits, publication or deployment occurred.

## Passing evidence

Each package passed formatting, lint, generated-binding drift, TypeScript, the
315-test unit suite, contract/security/asset inspection, its complete browser
inventory, and two independently installed clean-workspace builds. Every browser
cell passed with zero failed, skipped or flaky tests.

| Package                   | Profile  | Browser tests | Unsigned payload files | Result           |
| ------------------------- | -------- | ------------: | ---------------------: | ---------------- |
| command-palette 2.0.0     | base-ui  |           300 |                     51 | Browser verified |
| minimal 1.0.0 (fixture)   | base-ui  |            78 |                     35 | Browser verified |
| resources 1.0.0 (fixture) | combined |           120 |                     45 | Browser verified |

Each row covers `odc` and `o11-reactive` in the pinned Chromium, Firefox and WebKit
versions. The workbench separately passed 42 tests across the same six cells,
including navigation, selection/disposal, schema forms, redacted activity, safe
asset serving and visual states. Its Firefox cleanup comparison uses a measured
pre-component instrumentation baseline; it does not exclude listeners by name.

The [machine-readable summary](../test-results/hardening/qualification.json)
records exact payload digests, provenance, browser versions, measurements and
reproduction directories. Full unit/browser reports and gate logs are archived
under each package's `dist/<id>/<version>/evidence/` and `test-results/<id>/`.
The local CI matrix validator accepted all three exact archived component reports.
The Windows workflow is configured; a remote GitHub Actions run was not performed.

## Independent authoring evaluation

A fresh-context agent used the repository authoring and certification skills in
an isolated governed-source copy to create `status-chip@0.1.0`. It passed 315 unit
tests and 84 browser tests (14 scenarios in six cells), plus two matching clean
builds. Its 12 new visual baselines were individually inspected before qualification.
Only component files and scaffold-required workspace/project registration changed;
existing shared implementation and baselines were preserved.

The separate [evaluation report](../test-results/authoring-evaluation/evaluation-report.json)
contains the actual commands, retained failures, source audits and visual review.
Agent judgments are distinct from deterministic test results. Earlier interrupted
evaluation attempts remain retained; they are not counted as passing qualification.

## Capability and performance boundary

The base-ui and combined profiles were exercised. The combined fixture covers
real local workers, owned portals, provider DOM/listeners/observers, partial
initialization failure, managed operation supersession and disposal while busy.
It runs 100 hidden/resized/detached/recreated lifecycle cycles and checks sibling
state, callbacks, independently observed cleanup and late effects. Individual
capability scenarios run within this combined fixture; profile names alone do not
certify an arbitrary implementation or framework.

Every benchmark uses fixed 1,000- and 10,000-record corpora, five warm-up runs and
30 measured samples per size, per target/browser. The largest p95 and worst
measurements across those runs were:

| Package         | Create p95 / worst (ms) | Update p95 / worst (ms) | Input dispatch p95 / worst (ms) |
| --------------- | ----------------------: | ----------------------: | ------------------------------: |
| command-palette |               220 / 227 |               245 / 245 |                           1 / 1 |
| minimal         |                   1 / 2 |                   1 / 1 |                         0 / 0.1 |
| resources       |                 42 / 42 |                 40 / 41 |                         0.1 / 1 |

Limits were fixed before qualification: create/update p95 1,000 ms and worst
3,000 ms; input p95 250 ms and worst 1,000 ms; retained component resources zero;
complete-graph gzip ceilings 60 KiB JavaScript and 12 KiB CSS. JSON is bounded to
8 MiB and depth 64, with event capacity 1,024 and delivery batches of 64.
Oversized inputs, real deliberately slow input, raw listener leaks and incomplete
or substituted evidence are rejected by retained negative checks.

These are synchronous lifecycle/input-dispatch measurements, not human interaction,
paint, network, heap/GC, GPU or native-host performance. The minimal component has
no array property and reports `configurationRecords: 0`; its corpus result does
not claim large-list rendering. See [benchmark protocol](benchmark-protocol.md).
The accessibility scanner's own resources are recorded separately from component
capabilities captured before scanning. Component cleanup remains a mandatory
independently observed scenario.

## Migration, preservation and native handoff

The palette moves to 2.0.0 for breaking authoring/certification requirements.
Existing lifecycle host call signatures and normalized contract/schema 1.0 remain
accepted. Generated bindings, descriptors and profiles use their own format 1.0;
adapter/resource and evidence formats use 2.0; policy and suite versions are 2.0.0.
Unknown formats are rejected. See [migration rules](distribution.md#hardening-format-migration).

The registered 1.0.0 payload passed read-only inspection. Its catalog entry and all
60 original palette visual baselines match Git HEAD. The 36 additional component
and workbench references have a separate [visual review](../tests/workflows/visual-review-v1.json).
No registered payload was rebuilt, and no candidate or fixture was registered.

Detached native plans for both targets of the qualified palette and resource
fixture are under `.build/native-plans/<id>/<version>/`. They bind the complete
payload and retain the live checkpoint as not executed. Native edits, publication
and deployment require their own authorization and actual host evidence; see
[the native integration protocol](native-integration.md).

Retained failures are under `test-results/retained-failures/`. They include the
scanner-attribution failure and earlier browser transport failures. Qualification
uses the later complete passing runs; acceptance thresholds and existing visual
references were not relaxed.
