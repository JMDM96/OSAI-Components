# Component certification

Certification descriptor format 1.0 selects one exact finite capability profile
and a component-owned scenario module. Every command and event needs a scenario;
accessibility and visual states are mandatory. Cases execute through the public
bridge, must assert behavior, and must actually invoke/observe their declared
member. The shared suite adds lifecycle, isolation, invalid contracts, accessibility,
CSP, 100-cycle cleanup, deliberately unmanaged and slow-input fixtures, and the benchmark protocol.
Profile cases add async supersession/disposal, actual worker lifetime, portal
ownership and provider partial-failure/lifetime checks. Palette behavior and its
existing visual baselines remain an additional suite, not a substitute for shared
conformance. New workbench baselines have a separate review and path.

Each non-base profile case has exactly one component-owned `kind: "capability"`
setup, whose `member` names the required profile case. This setup uses the scenario
driver and must assert its behavior; the shared suite then enforces independent
cleanup and declared observations. This keeps component command names and data
shapes out of shared platform code. The driver can resolve declared asset URLs for
real resource loading. A base profile cannot start managed async operations.

Evidence format 2.0 binds each scenario to component/version, target, pinned browser,
contract, descriptor/source, profile, policy, suite and every payload checksum.
Inventory comes from the suite and descriptor, not test annotations. Omitted,
duplicated, skipped, stale or sibling cases fail collection. The verifier recomputes
benchmark summaries and validates observations; a passing status string is not a
certificate. Format 1.0 remains readable for historical releases but cannot certify
the new platform. Readiness in the workbench also checks the archived browser report.

Instrumentation executes before component artifacts. It independently observes
EventTarget listeners (including once/abort identity), window timeouts/intervals,
animation frames, observed Mutation/Resize/IntersectionObserver instances, workers,
declared connected portals, network origins and post-disposal callbacks. A raw
document listener fails this measurement even with all SDK counters at zero.
The accessibility scanner allocates its own resources, so its case captures
component capabilities before the scanner executes and reports later allocations
separately. Missing pre-scanner observations fail evidence collection. Component
cleanup qualification uses the dedicated instrumented case
without scanner allocations. These measurements do not measure heap/GC, GPU,
browser threads or arbitrary framework internals. Provider adoption requires an
explicit cleanup contract and cannot certify an arbitrary third-party framework.

Runtime negative cases cover contract aliasing, preparation/rollback events,
rollback quarantine and stale operations. Asset tests scan auxiliary scripts,
workers and CSS and reject missing graph members, unsupported formats, undeclared
origins and dependency/license gaps. Opaque image/font signatures are admission
checks, not complete decoders; real browser fixture cases also load/decode them.

| Profile             | Capability boundary                                                          |
| ------------------- | ---------------------------------------------------------------------------- |
| base-ui             | Scoped DOM, bounded JSON/events, managed base resources                      |
| managed-async       | Keyed cancellable operations with synchronous acknowledgements               |
| workers             | Registered same-origin worker graph and managed termination                  |
| portals             | Explicit declared selectors and owned portal removal                         |
| imperative-provider | Synchronous adoption, registered partial cleanup, transactional updates      |
| combined            | The four capability lifecycles together, including overlap and busy disposal |

Profiles are qualification requirements; an available profile name alone is not
passing evidence for a package. See [benchmark protocol](benchmark-protocol.md) for
the fixed workloads, limits and unsupported performance claims. Oversized payloads,
slow reports and leaks fail; candidate runs do not calibrate acceptance thresholds.
All local outcomes are browser-only. Actual OutSystems host and mobile-webview
evidence is separate, release-bound and lane-specific; see
[the unexecuted native checkpoint](native-integration.md).

## Visual hosts and reviewed references

Suite and policy 2.1.0 support exactly `win32-x64` and `darwin-arm64`. The resolver
uses the actual process host; there is no override or cross-host fallback. Windows
keeps `tests/browser/baselines/<target>-<browser>/`; Mac uses
`tests/browser/baselines/darwin-arm64/<target>-<browser>/`. An unsupported host,
missing reference or stale review fails. Ordinary qualification sets snapshot
updates to `none`. Zero differing pixels and the existing comparison threshold
remain unchanged.

Before another run, copy failed `test-results/<component>/` to a distinct retained
run directory. Install the pinned browsers and build all selected packages first:

```sh
npm run build -- --all --fixture tests/fixtures/minimal/component.manifest.json --fixture tests/fixtures/resources/component.manifest.json
npm run test:visual:update
OSAI_COMPONENT=minimal OSAI_FIXTURE_MANIFESTS='["tests/fixtures/minimal/component.manifest.json"]' npm run test:visual:update
OSAI_COMPONENT=resources OSAI_FIXTURE_MANIFESTS='["tests/fixtures/resources/component.manifest.json"]' npm run test:visual:update
OSAI_WORKBENCH=true OSAI_COMPONENT=resources OSAI_FIXTURE_MANIFESTS='["tests/fixtures/minimal/component.manifest.json","tests/fixtures/resources/component.manifest.json"]' npm run test:visual:update
```

These examples use a POSIX shell. In PowerShell set each variable using
`$env:OSAI_COMPONENT = 'minimal'` (and likewise for the others), run the command,
then remove it with `Remove-Item Env:OSAI_COMPONENT`. Clear component, fixture and
workbench selectors between unrelated runs. `CI=true` and an unused
`OSAI_HARNESS_PORT` give a run its own preview server.

Collection selects every `@visual` test, including descriptor visual scenarios
whose titles are `component/default`, the palette states, and the separately
selected workbench. It accepts no CLI overrides. Reports are retained under
`test-results/reference-collection/<host>/<selection>/` and explicitly identify
collection; they are never qualification evidence. Inspect every new/changed PNG
for intended content, clipping, focus, responsive layout and browser differences.
Record the date, reviewer, conclusions and sorted `{path, sha256}` entries in
`tests/browser/baselines/reviews/<host>.json`. Never bless images merely because the
collection command exited successfully. Existing Windows review history is retained.

Then format/regenerate, rebuild, and qualify normally, sequentially:

```sh
npm run format
npm run bindings
npm run verify -- --component command-palette
npm run verify -- --component minimal --fixture tests/fixtures/minimal/component.manifest.json
npm run verify -- --component resources --fixture tests/fixtures/resources/component.manifest.json
OSAI_WORKBENCH=true OSAI_COMPONENT=resources OSAI_FIXTURE_MANIFESTS='["tests/fixtures/minimal/component.manifest.json","tests/fixtures/resources/component.manifest.json"]' npm run test:browser
```

The suite digest includes both supported image sets, their review files and host
selection rules on every build host. OS release/version, architecture, reference
set, complete baseline digest and pinned browser versions/revisions are recorded
in each browser report. Evidence collection and readiness validate the recorded
host without substituting the inspecting machine. Editing images or reviews
invalidates prior evidence for new outputs. Keep historical packages intact;
a Mac run does not certify Windows or a native OutSystems host.
