# component-ai-workflows Specification

## Purpose

Defines repository-owned AI workflows that guide component authoring, certification and native integration through enforced contracts and explicit authorization boundaries.

## Requirements

### Requirement: Authoring guidance follows the supported SDK path
The repository SHALL provide a component-authoring skill that uses durable specifications, the supported scaffold, generated bindings, managed resources and component-selected verification. It SHALL identify unsupported requests rather than inventing bridge APIs or bypassing capability checks.

#### Scenario: Agent creates a component from a small approved specification
- **WHEN** an agent follows the authoring skill in a clean context
- **THEN** its output uses the supported scaffold and passes the selected component gates without edits to platform source or copied palette-specific harness logic

#### Scenario: Requested technique violates the SDK
- **WHEN** a request requires undeclared networking, unmanaged listeners or asynchronous host command returns
- **THEN** the workflow identifies the violation and proposes a compliant design or explicit contract change instead of silently bypassing enforcement

### Requirement: Certification guidance preserves independent acceptance
The repository SHALL provide a certification skill that exercises adversarial cases and reports exact evidence and limitations. It SHALL NOT silently relax profiles, skip mandatory scenarios, replace visual baselines or claim tenant verification to make a component pass.

#### Scenario: Verification fails
- **WHEN** a component exceeds a budget or a visual baseline differs
- **THEN** the workflow preserves the failure and distinguishes an implementation fix from a separately reviewed policy or baseline change

### Requirement: Integration guidance respects live capabilities and authority
The repository SHALL provide an integration skill that consumes verified release plans, follows current MCP tool descriptions, resolves real identifiers, and separates inspection, mutation and publication authority. Skills SHALL NOT contain credentials or grant authority merely through their instructions.

#### Scenario: Live tools or tenant context are absent
- **WHEN** an integration is prepared without available tools or resolved identities
- **THEN** the skill reports the missing prerequisite, preserves local artifacts and makes no invented calls or verification claim

### Requirement: Workflow guidance has maintained executable examples
Skills SHALL reference tested commands and versioned templates, and the repository SHALL retain positive and negative workflow examples plus a reproducible fresh-context evaluation procedure. Nondeterministic agent outcomes SHALL be recorded separately from deterministic compiler/test evidence.

#### Scenario: CLI or SDK changes
- **WHEN** a referenced command, template or contract changes incompatibly
- **THEN** guidance checks fail until the corresponding skill and executable examples are updated

#### Scenario: Existing unrelated skill files are present
- **WHEN** repository-specific skills are installed or updated
- **THEN** unrelated OpenSpec or user-owned skill files remain unchanged

### Requirement: Live ODC integration composes with the official OutSystems MCP skill

The repository integration workflow SHALL load the installed official OutSystems MCP skill and inspect current callable schemas before live ODC operations. It SHALL use that interface for authentication and Mentor orchestration while retaining repository contract, read-back, secret-handling, and human-authority requirements. Missing setup SHALL be reported without invented tool calls or an automatic switch to manual integration.

#### Scenario: The official skill or connection is missing

- **WHEN** local preparation finds that the official skill is unavailable or its required MCP capabilities are not connected
- **THEN** the workflow reports the missing prerequisite, preserves detached local artifacts, and performs no authentication, native edits, publication, or deployment

#### Scenario: The official interface is available

- **WHEN** the user separately requests a live ODC integration and the official skill and MCP are available
- **THEN** the workflow reads that skill and the actual tool schemas, resolves real target identities, and follows their authentication, session, polling, and error-handling procedures without relying on stale names or signatures copied into repository guidance

#### Scenario: A required browser-asset capability is absent

- **WHEN** inspection of the official interface establishes that it cannot ingest the required JavaScript or CSS assets
- **THEN** the workflow identifies the exact missing capability and supplies a concrete Studio step for those assets while retaining Mentor for supported work and the existing authority boundaries

### Requirement: Preflight distinguishes local certification from live connection readiness

Repository guidance SHALL report package integrity, exact browser qualification, official MCP/skill availability, target identity resolution, and native execution as separate readiness conditions. A prepared plan or an installed IDE SHALL NOT imply browser qualification or a live connection. The handoff SHALL identify the exact candidate and leave unexecuted host lanes explicit.

#### Scenario: A valid package lacks passing visual evidence

- **WHEN** package inspection and plan validation pass but browser certification fails
- **THEN** preflight reports the candidate as generated and identifies the failed gate rather than promoting it for a verified handoff

#### Scenario: Certification passes before MCP setup

- **WHEN** the full local matrix passes but the official MCP is not connected
- **THEN** preflight reports browser qualification as passed and live Mentor readiness as pending without discarding the local result or fabricating a native checkpoint
