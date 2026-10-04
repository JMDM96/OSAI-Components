# Browser benchmark protocol 1.0

Threshold review, 2026-10-04: the capability profiles use fixed limits before the
first hardening qualification. This is an implementation policy review, not a
tenant performance sign-off. No candidate measurement is used to choose or raise
these numbers. Create and update allow p95 1,000 ms and worst 3,000 ms; input allows
p95 250 ms and worst 1,000 ms. These bounds catch sustained stalls on the supported
Windows CI runner; they are not claims that those latencies are desirable UX.
Every profile retains the original 60 KiB JS and 12 KiB CSS gzip ceilings, now summed
over its graph. Resource growth after disposal must be exactly zero.

For each target and pinned Chromium/Firefox/WebKit browser, use deterministic
1,000-record and 10,000-record corpora (`item-N`, `Record N`), five warm-up runs and
30 measured runs per size. Run at least 100 lifecycle cycles, including hidden,
resized and detached hosts and disposal during work. Measure synchronous create,
full update and input dispatch with `performance.now()`. Report every sample,
nearest-rank p95, maximum, profile limits, browser version, user agent, platform,
viewport and hardware concurrency. Tests retain their measurements on failure.

The palette and resource fixture receive the entire corpus through their array
configuration. A component without an array property is labelled
`bridge-lifecycle-with-fixed-input-corpus`, with `configurationRecords: 0`:
its results measure bridge admission and its normal view, not large-list rendering.
Such a result must never be presented as large-data capability. Component-specific
interaction scenarios remain necessary; synthetic dispatch does not measure human
input latency, paint completion, network time, mobile webviews or native hosts.

Independent live-resource observations cover supported listeners, timer handles,
animation frames, observed observer instances, workers and connected portals.
They are not heap, GPU, browser-internal thread, GC or arbitrary-framework memory
measurements. Pending promises are checked through cancellation and post-disposal
effects. Treat unsupported observations as unmeasured, never zero-byte proof.

Any threshold or protocol change requires a deliberate documented policy review,
new version/hash and fresh qualification. A failing candidate must remain failed;
never auto-calibrate limits from the failing run or rewrite a visual baseline to
make the candidate pass. Workbench and component visual reviews are separate.
