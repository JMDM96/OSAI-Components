# Design

## Context

See [proposal.md](proposal.md) for motivation. This is a cross-cutting certification and workflow change, so the design artifact is required.

The preflight for `command-palette@2.0.0` established:

| Area                  | Observed state                                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local toolchain       | Node 26.3.1, npm 11.16.0, OpenSpec 1.14.0, and the locked Playwright browsers are installed. A new shell needs `.cache/activate.sh` in this checkout.                                                     |
| Core checks           | Formatting, lint, generated bindings, types, 315 unit tests, build, inspection, and two clean-workspace builds passed during setup.                                                                       |
| Browser qualification | 234 of 300 cases passed; all 66 failures were screenshot assertions, with 11 failures in each of the six target/browser cells. No skipped or flaky cases were reported.                                   |
| Package and handoff   | ODC package inspection and detached plan validation passed. Packaged contract/profile/descriptor/policy/suite provenance matches current source. Evidence remains `generated`.                            |
| Native tools          | ODC Studio 1.7.19.10579 is installed. No ODC/Mentor callable tools were exposed, plugin discovery found no match, and the user confirmed that the official MCP/skill has not been installed or connected. |
| Native execution      | Tenant identities are unresolved; authentication, tenant edits, publication, deployment, and host smoke tests have not been performed.                                                                    |

Existing observations live in `test-results/command-palette/`, and the validated local ODC plan is `.build/native-plans/command-palette/2.0.0/odc.json`. These are ignored local artifacts, not portable evidence just because a completion document is tracked.

`playwright.config.ts` currently selects references only by target/browser, even though the README says they were recorded on Windows. `certification.ts` hashes the runner configuration and suite source, but not the referenced PNG corpus. The snapshot update command greps `visual`, which does not include descriptor visual cases named `component/default`. The existing native integration skill already respects inspected identities, server-side OML, separate publication authority, and explicit browser-asset capability checks, but it hard-codes authentication tool names and does not first require the installed official skill.

## Goals / Non-Goals

**Goals:** Make certification reliable on this Mac while preserving Windows qualification, and make the repository handoff compose explicitly with the user's intended official MCP/Mentor workflow. Keep local readiness and live connection readiness independently observable.

**Non-Goals:** Implement a custom OutSystems connector, guess official MCP schemas, redesign the palette or public bridge, register a release, authenticate, create native assets, publish, deploy, or claim native host support. A macOS run does not establish a Windows, O11-host, or mobile-webview result.

## Decisions

### 1. Resolve a supported visual host before running tests

Use a small shared host resolver with explicit `win32-x64` and `darwin-arm64` reference sets. Keep the existing Windows images at their current paths; use a dedicated `darwin-arm64` subtree for new macOS references. Never fall back from one set to another. Record the actual OS version, architecture, pinned browsers, and reference-set identifier in runner metadata, so qualification claims remain limited to the measured environment. Other architectures/platforms require a separate reviewed addition.

Ordinary runs disable reference updates and fail on missing references. An explicit collection command can produce candidates only for the current supported host, including descriptor-declared visual cases, the palette state suite, and the separate workbench suite. Each new image needs review and a recorded hash before a normal qualification run can pass. Existing Windows review records and image bytes remain unchanged.

Keeping Windows as the only qualification host would leave this Mac dependent on an external runner for every component. Overwriting the Windows corpus or increasing tolerances would hide the portability issue. Neither approach meets this change's acceptance criteria.

### 2. Bind the reviewed corpus without making builds host-dependent

Extend the existing suite hash with a canonical, sorted inventory of supported baseline paths and content hashes, host-selection configuration, and review metadata. Hash the same complete governed corpus on every machine; do not include the executing machine's identity or only its chosen subset in packaged certification metadata. This preserves deterministic unsigned build inputs across hosts.

Keep actual execution-host observations in archived browser reports. Evidence collection and readiness validation must verify that the reported host uses a supported, reviewed set and the exact browser pins, and reject missing or inconsistent host metadata. Inspecting archived evidence on another OS must use its recorded host rather than relabeling it or requiring the inspecting machine to have been the execution host. Workbench reports retain the same host/reference context separately from component evidence.

Use the existing evidence provenance fields and archived-report channel; no new authoring, capability-profile, adapter, or public evidence schema is needed for the planned design. Advance the suite and release-policy versions to 2.1.0 to identify the additional acceptance inputs, while preserving every numerical threshold. Preserve historical evidence and require fresh qualification under the new suite. If implementation requires a serialized format change beyond this design, revise the plan and apply the corresponding format/component version rules before building.

### 3. Treat the official MCP skill as the live interface authority

The repository integration skill owns component-specific preparation: verified artifacts, schemas, Block mappings, lifecycle rules, reconciliation, and host smoke evidence. The installed official OutSystems skill and actual exposed schemas own the supported authentication and Mentor interaction procedure. Load them before any live call; do not copy an assumed interface into repository implementation.

Extend the existing offline integration-protocol model with explicit observations for official-skill availability and MCP connection. Missing setup returns a distinct pending prerequisite and no tenant calls. Simulated inputs test workflow branching only and cannot certify a real connection. Keep existing identity, inspection, static-asset capability, conflict, and native-authority checks after those prerequisites.

Once installed, record only non-secret interface identity/version and capabilities needed for the handoff. Follow the official skill's real authentication, callback, session-token, polling, and error rules while retaining user authority and secret-handling boundaries. No tool names or opaque IDs are assumed in this plan.

The default route remains Mentor. An inspected lack of JavaScript/CSS transfer yields a specific Studio step for those assets; supported Mentor work can continue in a later authorized session. .NET external-library upload remains invalid for UI assets. Missing installation alone does not select Studio as the primary route.

### 4. Present an explicit preflight result before native work

Document separate states for package integrity, matching browser certification, official skill/connection, inspected app/environment identity, browser-asset ingestion, and native smoke execution. Local plan generation remains useful at `generated` status; it is not approval to execute a verified handoff. The live workflow requires matching passing certification before claiming readiness for native edits.

After local qualification, retain the full exact package and reports together and regenerate/validate its detached ODC plan. The next live request resolves the real tenant target and performs native read-back and smoke checks. Publishing or deployment requires its own authority. This change can complete its local implementation while reporting the external official connection as pending; it cannot mark the overall import ready until that prerequisite is actually satisfied.

## Risks / Trade-offs

- Host fonts/rendering can vary across OS releases → record the measured OS version, preserve zero-diff policy, and require reviewed changes when an OS update alters rendering.
- The complete baseline corpus changes certification metadata → version the suite/policy, rerun qualification, and never rewrite registered releases. The current 2.0.0 candidate is unregistered; recheck the catalog before rebuilding it.
- Candidate snapshot collection can resemble a passing test run → keep collection distinct from review and ordinary verification, and retain its artifacts without granting readiness.
- Official MCP capabilities are not yet observable → implement only explicit pending states and generic composition now; verify the installed interface in the later live session before invoking it.
- A missing remote Windows run can be mistaken for cross-platform proof → validate Windows path/hash preservation locally and report Windows qualification only if a real Windows run is available.

## Migration Plan

1. Preserve the current failed Mac report, screenshot diffs, registered catalog, and Windows reference hashes before generating new output.
2. Implement host selection, complete reference collection, baseline provenance, report validation, and suite/policy version updates. Update tests, certification guidance, and native workflow guidance together.
3. Generate and explicitly review the macOS reference set; retain the existing Windows set byte for byte.
4. Format, regenerate bindings, run focused checks, then qualify the palette and both explicit fixtures sequentially across both targets and all pinned browsers. Run workbench qualification separately. Each component qualification includes independent clean-workspace reproduction.
5. Keep the Windows CI workflow using its preserved references. Exercise it when a Windows runner is available and distinguish pending remote execution from local results.
6. Regenerate and validate the ODC plan from the exact passing palette package. Archive matching reports with the package and record official MCP setup as pending until observed.

Rollback restores the previous source/configuration and suite version without deleting failed reports, candidate references, or historical evidence. It restores the former Windows-only qualification behavior and does not imply that the Mac is certified.

## Open Questions

- Which official MCP/skill identity and version will the user install? Resolve from that installation before live work; the local prerequisite behavior does not depend on its name.
- Which ODC app/library and environment will be used for the first smoke test? Resolve in the later live session, never from an invented identifier.
- Does that official interface ingest browser static assets? Inspect the actual capabilities after connection and use the specified fallback only if absent.
