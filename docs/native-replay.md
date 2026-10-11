# Offline continuation replay

Run deterministic unit/workflow checks separately from a fresh-context evaluation.
The replay receives only repository guidance, a generated package/plan and relocated
synthetic run bundles. It must not read chat history, authenticate or call a tenant.
Synthetic app/revision IDs are test data, never live identities or authority.

Create fixture bundles with `prepareReplayBundles` in
`packages/build-tools/src/native-replay.ts`, passing an inspected package root and
new output directory. Copy the bundles to another directory. Give the evaluator
this prompt, with real local paths substituted:

> Read docs/native-integration.md, docs/native-preview.md and the repository
> integration skill. Inspect the supplied package, plan and six relocated synthetic
> run bundles using the offline native-run CLI. For each, report completed work,
> missing/conflicting evidence, the next permitted step and which authorization
> must be independently accessible. Do not read prior chat history or call remote
> tools. Save your actual findings separately from deterministic test reports.

Required scenarios are completed manual import, unchanged quota pause, partial
mutation after failure, conflicting source, missing attachment and unchanged rerun
with exact captured bytes. Check that:

- Manual import permits supported subsequent native work after inspection, even
  without an automated upload capability.
- Quota pauses retain a checkpoint rather than resubmitting the same operation.
- Partial mutation requires fresh read-back; source conflicts require a decision.
- Missing attachments invalidate their dependent claims.
- An unchanged rerun recognizes observed source/wiring and byte identity without
  recreating elements, while scoped authority still requires the original trusted
  human request and current connection readiness.

Retain the prompt, provided input inventory/hashes, actual output, evaluator type,
time and limitations. A compiler/unit result is deterministic supplied-state
validation; it is not a nondeterministic agent evaluation. Neither establishes live
operational repeatability. The separate ODC pilot must perform actual read-back,
preview, served-byte capture and unchanged resumption before group 8 can complete.
