# component-certification Specification

## Purpose

Defines component-independent, capability-specific evidence that establishes what a generated component has actually passed and rejects incomplete or misleading certification.

## Requirements

### Requirement: Every component runs mandatory shared conformance
Certification SHALL run a mandatory platform suite plus the selected component's behavior scenarios against packaged artifacts. Component scenarios SHALL NOT remove base lifecycle, isolation, contract, accessibility, security or cleanup obligations.

#### Scenario: Non-palette component is certified
- **WHEN** a new component requests certification
- **THEN** it runs the same applicable platform guarantees without command-palette-specific source paths or test names

#### Scenario: Component descriptor attempts to omit a mandatory gate
- **WHEN** its descriptor excludes lifecycle or cleanup coverage
- **THEN** certification fails rather than treating the omission as a passing or skipped gate

### Requirement: Required scenario coverage is explicit and complete
The suite SHALL define required scenario identifiers before execution for each profile/target/browser. Evidence SHALL include each required identifier exactly once with a passing result and matching provenance; annotations or aggregate counts alone SHALL NOT prove coverage.

#### Scenario: Passing report lacks a scenario
- **WHEN** a report has no failures but omits a mandatory scenario, duplicates another, or substitutes a sibling component's proof
- **THEN** evidence collection rejects the report and identifies the mismatch

#### Scenario: All applicable scenarios pass
- **WHEN** every required scenario and component behavior case passes on the required browser/target matrix with matching provenance
- **THEN** the selected component can receive browser-verified status for that exact artifact set

### Requirement: Resource and capability checks have independent observations
Certification SHALL compare declared capabilities and managed counters with independent browser observations and post-disposal effects for supported resource classes. A zero managed count SHALL NOT alone prove leak freedom; unsupported observations SHALL be identified rather than reported as measurements.

#### Scenario: Unmanaged listener outlives disposal
- **WHEN** a deliberately faulty component leaves a raw document listener active while managed counters are zero
- **THEN** certification detects the surviving allocation or effect and rejects the component

#### Scenario: Runtime uses an undeclared capability
- **WHEN** instrumented execution observes a worker, network origin, portal or browser API absent from the manifest
- **THEN** the observed capability validator is applied and certification fails

### Requirement: Negative fixtures establish rejection behavior
The platform suite SHALL include deliberate defects for contract mutation, failed-update events, unmanaged resources, stale async completion, rollback failure, auxiliary assets and incomplete evidence. Each case SHALL prove prevention of the unsafe effect or rejection by the relevant gate; an undetected unsafe outcome SHALL fail platform verification.

#### Scenario: Gate becomes ineffective
- **WHEN** a change causes the unmanaged-listener or incomplete-evidence fixture to pass
- **THEN** platform verification fails even if all production component scenarios pass

### Requirement: Capability fixtures exercise real browser lifecycles
Supported async, worker, portal and imperative-provider profiles SHALL be exercised by small browser fixtures through creation, update, overlap, partial failure and disposal. Mock-only resource objects SHALL NOT establish browser capability support.

#### Scenario: Combined fixture is disposed while busy
- **WHEN** a fixture with a real worker, portal, provider resources and overlapping operations is removed during pending work
- **THEN** all owned activity ends, stale results do not reach callbacks, sibling instances remain correct and independent observations return to baseline

#### Scenario: Host is hidden or detached
- **WHEN** the fixture's host is hidden, resized, detached or recreated
- **THEN** it handles supported transitions without orphaned resources or undefined host errors

### Requirement: Performance and resource limits are reproducible and reviewed
Certification profiles SHALL declare finite numeric size, payload, queue, latency and resource-growth limits with a versioned benchmark protocol. Thresholds SHALL be fixed before qualification and SHALL NOT be automatically relaxed by a candidate run.

#### Scenario: Large-data profile is measured
- **WHEN** its fixed 1,000-record and 10,000-record workloads and at least 100 lifecycle cycles run
- **THEN** evidence records environment, sample counts, p95 and worst measurements, limits and pass/fail results

#### Scenario: Candidate exceeds its limit
- **WHEN** a latency or resource-growth measurement violates the active profile
- **THEN** certification fails and preserves the failure; a threshold change requires explicit policy review and new evidence

### Requirement: Fixture and platform evidence cannot masquerade as host verification
Stress fixtures SHALL be excluded from the production catalog unless explicitly selected for a diagnostic build. Browser certification SHALL NOT produce OutSystems-verified status or imply support for untested frameworks, targets or webviews.

#### Scenario: Local hardening passes without tenant execution
- **WHEN** all local production and stress-fixture gates pass but no matching host smoke record exists
- **THEN** the result states browser-verified for the relevant artifacts and leaves host verification unexecuted
