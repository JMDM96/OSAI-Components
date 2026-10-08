# Tasks

## 1. Preserve the preflight evidence

- [x] 1.1 Retain the current failed Mac browser report, gate logs, and screenshot artifacts under a distinct run directory before any new run; verify that the retained summary still reports 234 passed and 66 visual failures with no skipped or flaky cases.
- [x] 1.2 Record hashes of the existing Windows baseline corpus and `releases/catalog.json`, and confirm whether the 2.0.0 candidate remains unregistered; verify that subsequent work leaves the recorded registered-release and Windows-reference hashes unchanged.

## 2. Select and review host-specific visual references

- [x] 2.1 Implement a shared supported-host resolver for Windows x64 and macOS arm64, preserve Windows paths, and select a dedicated macOS subtree in Playwright; verify resolver tests cover both hosts and reject unsupported combinations without a fallback.
- [x] 2.2 Disable reference creation/update during ordinary qualification and provide actionable missing-reference diagnostics; verify a missing image fails without writing a baseline or producing passing evidence.
- [x] 2.3 Make explicit reference collection include descriptor visual cases such as `component/default`, palette visual states, and the separately selected workbench suite; verify its discovered inventory covers all applicable visual scenarios and cannot target another host's corpus.
- [x] 2.4 Collect macOS candidates for the palette, minimal/resource fixtures, and workbench across both targets and all pinned browsers; inspect every new image, record review conclusions and hashes, and verify existing Windows images remain byte-identical. Snapshot collection alone does not complete this task.
- [x] 2.5 Update README, certification/release guidance, and the component-certify skill with host selection and collection/review/qualification commands; verify the documented commands resolve and clearly preserve failed runs and mandatory thresholds.

## 3. Bind visual inputs and validate report provenance

- [x] 3.1 Include a canonical inventory of all supported baseline paths/content hashes, host-selection rules, and review metadata in the existing suite provenance; verify that changing a reference invalidates the digest and that changing only the executing host does not change packaged provenance.
- [x] 3.2 Record execution OS/version, architecture, selected reference set, and browser pins in archived component/workbench reports and enforce their consistency in evidence collection/readiness; verify missing metadata, incompatible sets, and stale baseline hashes are rejected, and valid cross-machine inspection retains the recorded host.
- [x] 3.3 Advance suite and release-policy versions to 2.1.0, update matching tests and migration documentation, and preserve all numerical thresholds and existing serialized formats; verify version consistency, legacy inspection, and rejection of old evidence for newly built certification inputs.
- [x] 3.4 Add regression checks for ordinary missing-reference failure, complete descriptor visual coverage, baseline tampering, host-independent build metadata, and Windows-reference preservation; run the focused certification/evidence/workbench configuration tests and verify each negative case fails for its intended reason.

## 4. Align repository integration with the official MCP skill

- [x] 4.1 Update the repository integration skill and native protocol docs to load the installed official OutSystems skill and actual callable schemas before live work, replacing unconditional assumptions about authentication tool names; verify that the documented default is Mentor and that missing installation does not automatically select Studio.
- [x] 4.2 Extend the existing offline integration-protocol model with distinct official-skill and MCP-connection prerequisites before identity/capability/authority checks; verify simulated missing-skill, missing-connection, unresolved-identity, unsupported-asset-transfer, and ready-path cases return the correct state without tenant calls.
- [x] 4.3 Preserve and test the static-asset fallback, server-side OML, read-back/conflict handling, secret redaction, and separate publication/deployment authority; verify the tests continue to reject .NET external-library upload as a UI asset transport.
- [x] 4.4 Update executable workflow examples and preflight guidance to report package, certification, official interface, identity, asset transfer, and host-smoke readiness separately; verify reference/command tests pass and a valid local plan without browser qualification or MCP setup remains explicitly pending.
- [x] 4.5 Record the official interface's observed availability in the local preflight result. If installed, read its actual skill and capability schemas and reconcile guidance without authenticating; otherwise record setup pending and defer real-interface validation. Verify that no guessed package identity, tool signature, tenant key, or live verification claim appears in the result.

## 5. Requalify and prepare the exact ODC candidate

- [x] 5.1 Format and regenerate bindings, then run the selected lint/type/unit checks followed by full palette, minimal-fixture, and resource-fixture qualification sequentially on this Mac; verify both targets and all three pinned browsers pass with complete evidence, unchanged thresholds, and successful clean-workspace reproduction for each package.
- [x] 5.2 Run the workbench qualification separately against the explicitly built fixtures and reviewed macOS references; verify all required navigation, lifecycle, accessibility, and visual cases pass with host metadata retained.
- [x] 5.3 Confirm the Windows CI configuration continues to select the original paths and hashes, and record whether a real Windows qualification run is available; verify any unavailable Windows execution is reported as unexecuted rather than inferred from local checks.
- [x] 5.4 Inspect the exact passing palette package, regenerate the detached ODC plan, and retain the package plus matching reports together; verify plan validation, complete artifact hashes, current certification provenance, and an unchanged registered catalog.
- [x] 5.5 Produce the final local preflight result with the official MCP/skill and target identity prerequisites still pending unless actually observed; verify ODC native smoke execution, O11-host execution, and mobile-webview execution remain unexecuted. Authentication and native import belong to the subsequent live request.
