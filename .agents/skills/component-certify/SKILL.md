---
name: component-certify
description: Qualify an OSAIComponents package against its exact profile, artifact graph, browser matrix, and negative tests. Use for local component readiness or release verification.
---

Read [release gates](../../../docs/releasing.md),
[certification boundaries](../../../docs/certification.md), and
[benchmark protocol](../../../docs/benchmark-protocol.md).
Run `npm run verify -- --component <id>`; add `--fixture <manifest>` for an explicit
test fixture. This command does not register a production release. Release/catalog
mutation is a distinct requested action, and fixture packages cannot be registered.

Require every mandatory scenario in both targets and all three pinned browsers.
Check exact component/version, contract/profile/descriptor/policy/suite hashes and
the complete payload checksums. A label or annotation is not measured coverage.
Inspect independent observations even when SDK counters report zero.

Adversarial checks include aliased contracts, failed-update events, rollback
failure, stale operation completions, raw listeners, auxiliary executable scans,
missing/duplicated scenarios, sibling proofs, and profile/hash drift. Preserve a
failed report and diagnose its cause. Never remove the failing scenario, raise a
limit from candidate measurements, mark skipped cases passed, or fabricate proof.

New visual baselines need an explicit visual review. Changes to an existing
baseline or policy need a documented review of the intended behavior and fresh
qualification; snapshot-update commands alone do not constitute that review.
Report unsupported measurements and browser-only readiness plainly. Native host
and mobile-webview claims require matching evidence from those actual lanes.


Use the actual supported host: Windows x64 references keep their original paths;
macOS arm64 references use `tests/browser/baselines/darwin-arm64`. Other hosts fail
without fallback. Ordinary runs never create/update references. Preserve failed
runs before rerunning. Follow the linked certification guide's explicit
`npm run test:visual:update` commands for the selected component/fixtures and
separate workbench; all descriptor visuals are included. Inspect every candidate
and record sorted paths/hashes and conclusions in the host review JSON before
normal qualification. Collection grants no readiness. Do not alter thresholds.

Validate archived OS/version, architecture, reference set, corpus digest and browser
pins. The complete supported corpus/reviews bind suite provenance independently
of the build host. Report only the host actually measured; cross-machine inspection
retains the report's host. Rerun full qualification after baseline/review changes.
