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
