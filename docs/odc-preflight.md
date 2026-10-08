# ODC preparation checkpoint — 2026-10-06

This is the historical preflight checkpoint from October 6. The subsequent
[live ODC demo checkpoint](odc-live-demo.md) records the published sample and its
observed behavior and remaining verification limits. The
[ODC trial pain-point record](odc-integration-pain-points.md) captures the difficulties
encountered along the way.

Local preparation for `command-palette@2.0.0` is complete under OpenSpec change
[prepare-odc-mentor-handoff](../openspec/changes/archive/2026-10-07-prepare-odc-mentor-handoff/tasks.md).
At this checkpoint, native import and runtime smoke
were unexecuted; the later outcome is recorded in the live demo checkpoint above.

## Local qualification

The checkout uses Node 26.3.1, npm 11.16.0 and Playwright 1.63.0. On this Mac,
`source .cache/activate.sh` selects the pinned local toolchain. That ignored helper
is specific to this checkout; other machines should install the versions pinned
in `.node-version` and `package.json`.

Formatting, generated bindings, lint, types and all 321 unit tests passed. Complete
browser runs passed on macOS 26.6.2 / Darwin 25.6.0, arm64, for both ODC and O11
browser target packages in Chromium, Firefox and WebKit:

| Selection          | Passed | Failed / skipped / flaky |
| ------------------ | -----: | ------------------------ |
| Command palette    |    300 | 0 / 0 / 0                |
| Minimal fixture    |     78 | 0 / 0 / 0                |
| Resource fixture   |    120 | 0 / 0 / 0                |
| Separate workbench |     48 | 0 / 0 / 0                |

Each component reproduced byte-for-byte in two independently installed clean
workspaces. The palette package was inspected after qualification and its detached
ODC plan regenerated and validated. All 51 payload hashes and current certification
provenance match the retained passing evidence.

Suite and policy versions are 2.1.0. Numerical gates are unchanged. All 96 Mac
references were reviewed through 42 distinct image hashes; identical images share
the inspected pixels. The [Mac review](../tests/browser/baselines/reviews/darwin-arm64.json)
enumerates every image and finding. All 96 existing Windows PNGs and the registered
catalog remain byte-identical. Windows CI still uses its original paths; no Windows
execution of this change is claimed.

The earlier 234-pass/66-visual-failure report, logs and screenshot artifacts are
retained under `test-results/preserved/2026-10-06-before-macos/`. Collection reports
remain separate under `test-results/reference-collection/darwin-arm64/` and grant
no qualification. Current reports are under each `test-results/<selection>/` and
inside the qualified packages' `evidence/reports/` directories.

## Exact handoff retained locally

The ignored `.build/odc-handoff/command-palette-2.0.0/` directory contains the full
qualified package, current reports, `odc-plan.json`, `binding.json`, observed official
interface, final preflight states, workbench reports, and a concrete import/smoke
handoff in `README.md`. The full machine-readable result is also at
`.build/odc-preflight/result.json`. These local artifacts must travel with the package;
this tracked note alone is not portable verification evidence.

- Payload digest: `2ab9b412a982beaf6fcf7361566f20e2f43ddaf21d64b6ae0c1aa2b538153efb`.
- ODC plan digest: `3079f6837180b2f46db39db36fbcd9181ae70d0ca6ff7ec3587adfe4a12c9d70`.
- Library observed: **OS AI Components**, revision 2, `e13398dc-01ec-4955-a60b-2a6d7d99f357`.
- Environment observed: **Development**, `1f9d2491-b5ae-4415-8993-31f17583b2d5`.
- Development runtime domain: `personal-ypbfdmrf-dev.outsystems.app`.

## Live prerequisites remaining

The installed official OutSystems skill was read and the callable schemas inspected.
Successful read-only MCP lookups confirmed the connection and target identities.
Client OAuth was already configured by the user; no credentials or Mentor handles
were persisted. Repository guidance now follows the official skill and actual catalog,
with Mentor as the intended editing route.

The current catalog advertises document attachments, but no direct JS/CSS static
resource upload. Exact asset ingestion remains **pending**, rather than assumed
from attachment support. The handoff names the two delivered assets (59,117-byte
JavaScript and 6,199-byte CSS), their SRI/hash records and load order. Establish and
verify the supported transfer path in a live session; if unavailable, use the
concrete Studio resource-import step and continue supported native work via Mentor.
.NET external-library upload does not apply to browser assets.

Mentor session loading and complete native read-back remain to be exercised. The
catalog names a supported `Library` type while app inspection reports `LowCodeLibrary`;
that mapping has not yet been tested. Empty scoped context results do not prove an
empty library. A consuming web app/screen must also be selected for runtime testing.

Then prepare/reconcile the CommandPalette Block, six inputs, five events, nine
wrapper actions, resource mappings and lifecycle logic from the exact plan. Native
publication/deployment require their own authority after the edit is reviewable.
ODC native, O11 native and mobile-webview smoke are all **not executed**. Follow
[the native protocol](native-integration.md) to record actual host outcomes.
