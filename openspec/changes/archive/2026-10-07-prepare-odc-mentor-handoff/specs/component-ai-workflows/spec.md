# Spec Delta

## ADDED Requirements

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
