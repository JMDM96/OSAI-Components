# Proposal

## Why

The first ODC import should exercise a repeatable, verified component pipeline through the official OutSystems MCP and Mentor skill. The new Mac can build the palette and passes all 315 unit tests, but certification stops at 66 Windows-versus-macOS screenshot differences; the official MCP and its skill are not yet installed or connected.

## What Changes

- Select reviewed visual references for the actual qualification host, preserving the existing Windows references and adding a separately reviewed macOS Apple-silicon set for components, fixtures, and the workbench.
- Keep both targets, all three pinned browsers, negative cases, and existing visual/performance/resource thresholds mandatory. Unsupported hosts and missing references fail clearly instead of falling back or creating passing references automatically.
- Bind reviewed baseline contents into certification provenance and retain the actual host and selected baseline set in archived browser reports. Historical evidence remains historical; changed certification inputs require fresh qualification.
- Make the official OutSystems MCP and installed official skill the primary live integration path. The repository skill supplies the component contract and handoff plan, while actual authentication, Mentor sessions, tool calls, and polling follow the installed official skill and current schemas.
- Report missing connection, unresolved tenant identities, absent browser-asset transfer, and missing matching browser evidence as separate prerequisites. Studio is a specific fallback for a capability the official tools demonstrably lack, not the default because the MCP has not been connected yet.
- Requalify locally and regenerate the detached ODC handoff against the resulting exact package. Actual authentication, tenant edits, publication, deployment, and native smoke execution remain subsequent explicitly requested operations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `component-certification`: Host-specific reviewed visual references and baseline-bound qualification evidence.
- `component-ai-workflows`: Certification host guidance and explicit composition of the repository integration skill with the installed official OutSystems MCP/skill.

## Impact

Affected areas include `playwright.config.ts`, certification/provenance and browser-report validation in `packages/build-tools`, the checked-in visual references and review records, repository certification/integration skills, and setup/release/native-integration documentation. Targeted tests must cover host selection, missing or changed references, and offline integration prerequisites. Windows CI continues to use its existing references.

The palette's browser API, OutSystems public contract, SDK authoring contract, dependency versions, and runtime implementation do not need to change for this work. Registered releases and failed reports remain immutable. Any implementation-discovered format change must receive the version changes required by the repository contracts before new artifacts are built.

The official MCP package identity, installed skill path/version, actual tool capabilities, and target app/environment are unresolved external inputs. This proposal does not invent them or assume that the MCP can upload browser assets. Local qualification can proceed while that connection is pending.
