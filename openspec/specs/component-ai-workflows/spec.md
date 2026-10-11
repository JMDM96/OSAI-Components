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

The repository SHALL provide an integration skill that consumes verified release plans, follows current MCP tool descriptions, resolves real identifiers, and separates inspection, mutation and publication authority. Skills SHALL NOT contain credentials, and skills or run records SHALL NOT grant authority. Existing human authorization SHALL be retained and reused only for its evidenced scope; unsupported or expanded operations SHALL require the missing authority.

#### Scenario: Live tools or tenant context are absent

- **WHEN** an integration is prepared without available tools or resolved identities
- **THEN** the skill reports the missing prerequisite, preserves local artifacts and makes no invented calls or verification claim

#### Scenario: An authorized publication resumes after quota recovery

- **WHEN** the same reviewed scope and target remain covered by an accessible human publication request
- **THEN** the workflow verifies current state and continues without asking for that same authority again

#### Scenario: A resumed plan targets a different application

- **WHEN** target or operation scope falls outside the retained human request
- **THEN** the record does not authorize it and the workflow requests only the additional authority needed after preparing a reviewable result

### Requirement: Workflow guidance has maintained executable examples

Skills SHALL reference tested commands and versioned templates, and the repository SHALL retain positive and negative workflow examples plus a reproducible fresh-context evaluation procedure. Integration examples SHALL cover generated native contracts, partial outcomes, manual handoffs and resumption from exported evidence. Nondeterministic agent outcomes SHALL be recorded separately from deterministic compiler/test evidence.

#### Scenario: CLI or SDK changes

- **WHEN** a referenced command, template or contract changes incompatibly
- **THEN** guidance checks fail until the corresponding skill and executable examples are updated

#### Scenario: Existing unrelated skill files are present

- **WHEN** repository-specific skills are installed or updated
- **THEN** unrelated OpenSpec or user-owned skill files remain unchanged

#### Scenario: A fresh context replays an interrupted integration

- **WHEN** the context receives only repository guidance, the package/plan and a portable fixture run bundle
- **THEN** it identifies completed and unresolved work, rejects conflicting or missing evidence, and chooses the next permitted step without prior conversation knowledge or tenant calls

#### Scenario: Offline replay succeeds

- **WHEN** supplied-state replay and generated-glue checks pass locally
- **THEN** the result reports local workflow readiness and leaves live repeatability unexecuted until an authorized pilot and unchanged rerun supply native evidence

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

### Requirement: Operation outcomes remain independently observable

Integration guidance SHALL report draft mutation, native validation, publication start/completion, library release, consumer deployment, preview checks and asset identity independently. Each success SHALL cite the observation establishing it. An operation wrapper's status or prose SHALL NOT substitute for the relevant native result or erase effects reported before failure.

#### Scenario: Mentor finishes but publication fails

- **WHEN** a terminal successful run includes publication failure and no publication identity
- **THEN** publication remains failed or not-started and the workflow does not describe a newly deployed preview

#### Scenario: A failed run reports applied edits

- **WHEN** the run fails after reporting mutations
- **THEN** affected elements become read-back-required and the workflow preserves the possibility that edits were applied

#### Scenario: Deployment still serves the previous revision

- **WHEN** source publication advances but the selected environment still reports an older revision
- **THEN** the preview remains pending for the new revision and browser checks do not count the old deployment as its result

### Requirement: Recovery is bounded and driven by new evidence

The workflow SHALL record attempted routes, observed failures, diagnostic hypotheses and the evidence that would justify another attempt. It SHALL apply declared recovery limits, stop a known rejected route until relevant conditions change, and preserve a resumable checkpoint on exhaustion. Authentication, quota and platform failures SHALL remain distinct; historical capability observations SHALL NOT be treated as permanent platform facts.

#### Scenario: The catalog advertises a rejected route

- **WHEN** an operation has returned a deprecation rejection under the current interface
- **THEN** a repeated catalog listing alone does not justify calling it again and the observed supported route or concrete handoff is used

#### Scenario: A diagnostic experiment is inconclusive

- **WHEN** publication still fails after a bounded diagnostic change
- **THEN** the workflow records only the conclusion supported by that experiment, accounts for the resulting draft state, and stops at its recovery limit without claiming an unproven root cause

#### Scenario: Quota prevents further work

- **WHEN** the platform reports a quota limit
- **THEN** the workflow checkpoints completed and uncertain work and does not repeatedly submit edits or publications while the condition is unchanged

#### Scenario: Event pagination reaches its end

- **WHEN** the response has no more pages or no usable continuation cursor under the current schema
- **THEN** event pagination stops and any remaining operation-status polling follows the official skill rather than replaying the final event page

### Requirement: A usable consumer is established before extensive demo work

The live workflow SHALL resolve or establish an accessible consumer with a valid default route and verified publication/deployment before extensive demo construction. It SHALL verify the intended library release and reference identities before component wiring. Browser checks SHALL wait for the expected deployed revision and observable screen readiness, and manual recovery instructions SHALL name an asset the user can access.

#### Scenario: A new Mentor draft cannot be published or inspected

- **WHEN** the minimal consumer has no verified accessible native identity or publication
- **THEN** the workflow stops adding demo features, preserves the draft's actual status, and offers a concrete supported recovery path without describing it as an available application

#### Scenario: Publication does not create a referenceable release

- **WHEN** the library is published but lacks the release identity required for the consumer reference
- **THEN** the workflow reports that prerequisite and does not infer referenceability from the published revision alone

#### Scenario: Browser navigation changes the tab URL

- **WHEN** a navigation redirects or an observation still shows the previous screen
- **THEN** the workflow retains the tab identity and waits for the expected screen marker before classifying the interaction or recovering the browser
