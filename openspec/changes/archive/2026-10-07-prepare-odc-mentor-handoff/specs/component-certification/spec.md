# Spec Delta

## ADDED Requirements

### Requirement: Visual qualification selects reviewed references for the execution host

Certification SHALL select an explicitly supported visual reference set for the actual execution host, target, and pinned browser. Missing references and unsupported hosts SHALL fail with actionable diagnostics. Ordinary qualification SHALL neither create nor update references, fall back to another host's images, skip mandatory visual scenarios, nor relax the existing thresholds.

#### Scenario: Apple-silicon macOS qualification runs

- **WHEN** a supported macOS host runs a component or workbench qualification
- **THEN** every visual scenario uses its reviewed macOS references for the selected target and browser, while existing Windows reference bytes remain unchanged

#### Scenario: A reference or host is unsupported

- **WHEN** qualification encounters a missing reference or an unsupported host
- **THEN** it fails with the host and missing reference identified and does not generate a reference or assign browser-verified status

#### Scenario: Reference collection is explicitly requested

- **WHEN** a developer collects candidate references for a supported host
- **THEN** collection covers descriptor-declared visual scenarios as well as applicable component and workbench screenshots, cannot overwrite another host's references, and grants no qualification until review and a normal passing run

### Requirement: Qualification evidence binds reviewed visual inputs and records its host

Certification provenance SHALL bind the reviewed visual corpus and selection rules. Archived browser reports SHALL identify the actual OS, architecture, browser pins, and selected reference set. A changed reference or selection rule SHALL invalidate prior qualification for new outputs. Host observations SHALL remain separate from deterministic unsigned payload inputs.

#### Scenario: A reviewed baseline changes after qualification

- **WHEN** a baseline or its selection policy changes without fresh qualification
- **THEN** readiness checking rejects the old evidence for the changed source and leaves archived historical packages intact

#### Scenario: Evidence is inspected on another computer

- **WHEN** valid archived Windows evidence is inspected on macOS, or the reverse
- **THEN** it retains its recorded execution host and exact package binding without being relabeled as a local run

#### Scenario: Host selection metadata is inconsistent

- **WHEN** a report omits its required host metadata or names a reference set incompatible with that host
- **THEN** evidence collection rejects the report even if its test summary claims success

#### Scenario: Identical governed inputs are built on different hosts

- **WHEN** builds use the same source, lockfile, certification inputs, and pinned toolchain
- **THEN** the machine that performs the build does not by itself change the unsigned payload or substitute a host-specific provenance digest
