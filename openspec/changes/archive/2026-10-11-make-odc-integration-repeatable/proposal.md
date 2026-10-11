# Proposal

## Why

The first ODC command-palette preview works, but repeating it still depends on corrections and recovery knowledge retained from the original conversation. The generator still requests an unsupported callback-reference mapping, while supplied-state checks and informal checkpoints cannot establish that native source, publication, and deployment agree.

## What Changes

- Generate a versioned ODC implementation contract with public wrappers, private event registration, exact JavaScript and native parameter mappings, scoped instance resolution, and explicit resource/lifecycle behavior. Verify generated glue against the packaged bridge and reject known bad mappings independently of generator equality.
- **BREAKING:** Replace the conceptual ODC public callback-reference action with Block-private registration and introduce a new detached native-plan format. Use a new component version and preserve the existing browser bridge signatures, historical packages, and live library until a separately authorized migration.
- Require an element-by-element read-back inventory that distinguishes exact source, native wiring, reported summaries, missing evidence, and conflicting revisions. Derive rerun decisions from inspected content and ownership instead of accepting desired fingerprints as observed state.
- Add portable, schema-validated, redacted run records that bind package, plan, library release/revision, consumer revision, environment, authorization references, attempts, and evidence. Track draft mutation, validation, publication, deployment, preview, and asset identity separately.
- Make manual resource import a supported resumable step. A completed, inspected manual import can unblock native editing even when automated ingestion is unavailable. Preserve observed capability failures and stop repeated recovery without new evidence.
- Establish an accessible published consumer shell early, verify the library release/reference prerequisites, and supply a small, repeatable preview smoke sequence. Preserve existing authorization within its scope and wait for verified deployment and screen readiness before browser checks.
- Validate the local workflow with negative fixtures and a fresh-context replay; define a separate authorized live pilot and unchanged rerun as the evidence needed to demonstrate operational repeatability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `outsystems-library-integration`: Executable ODC mappings, complete read-back and observed reconciliation, portable integration evidence, explicit resource-transfer completion, and bounded preview verification.
- `component-ai-workflows`: Resumable Mentor guidance, evidence-based operation outcomes, early consumer publication, bounded recovery, and maintained fresh-context workflow examples.

## Impact

Primary implementation areas are `packages/build-tools/src/native-plan.ts`, the CLI and adjacent tests, ODC target metadata, generated adapter guidance/recipes, repository integration guidance, and workflow fixtures. The implementation may split native templates, read-back validation, and run-record handling into focused modules. O11 output remains on its existing contract and receives regression coverage; ODC observations do not establish O11 support.

No new remote connector, unattended tenant automation, production component, or runtime API redesign is planned. Full native certification, broad demo standardization, setup automation, upgrade/rollback orchestration, and repairs for unexplained platform failures are deferred. Authentication, quota limits, and manual asset import are accommodated. The served JavaScript BOM remains a recorded identity mismatch; this change does not normalize it away or relax certification. Local implementation and later live execution are separate milestones, and neither planning nor local completion grants tenant authority.
