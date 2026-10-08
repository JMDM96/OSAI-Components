# Building and releasing components

See [certification](certification.md), [benchmark limits](benchmark-protocol.md),
[workbench controls](workbench.md), and [native plan preparation](native-integration.md).
Verification writes component-separated logs, unit/browser reports and summaries
under `test-results/<componentId>/`; failed runs remain failed. The Windows CI
matrix discovers all production manifests plus `platform-fixtures.json` and checks
matrix completeness after downloading the per-component artifacts. Workbench
qualification is a separate job. Run local browser qualifications sequentially
to keep resource and performance observations isolated. Preserve transport failures
as failed runs; do not hide them by raising assertion budgets or accepting flaky runs.

The [hardening migration](distribution.md#hardening-format-migration) defines the independent authoring, adapter, evidence and policy formats. Preserve registered 1.0.0 payloads and catalog entries. Use a new major candidate for the breaking authoring/certification migration; legacy inspection grants no new readiness. Policy/profile thresholds and visual references require review before qualification, and failures must not automatically relax them.

Run commands from the repository root with the Node and npm versions pinned by `package.json`. Install with `npm ci`; the lockfile, release policy, normalized manifests, source, and toolchain jointly determine the unsigned output.

## Component selection

Use `--component <id>` consistently for validate, build, inspect, verify, release, preview and reproduce. Omitting selection retains the `build.config.json` default. Validate/build/inspect/verify/reproduce also accept `--all`; release and preview require a single component. Conflicting, duplicate and unknown selectors fail before outputs or catalog records change. Historical inspection may receive a release directory as its positional argument, and checks that it belongs to the selected component.

Production discovery scans `components/*/component.manifest.json` in stable ID order and rejects duplicate IDs, missing manifests and escaped source paths. Fixtures are excluded unless their manifest is explicitly supplied with `--fixture tests/fixtures/<name>/component.manifest.json`. Even explicit fixture selection cannot register a production release. Examples:

```powershell
npm run validate -- --all
npm run build -- --component command-palette
npm run inspect -- --component command-palette
npm run build -- --component minimal --fixture tests/fixtures/minimal/component.manifest.json
npm run reproduce -- --component minimal --fixture tests/fixtures/minimal/component.manifest.json
npm run scaffold -- example-label
npm run bindings
npm run typecheck
npm run validate -- --component example-label
```

Scaffolding adds component source, styles, schemas, a manifest, generated bindings, sample input and certification scenarios. It registers the TypeScript project reference and private workspace lockfile metadata automatically. It never edits shared platform implementation. A failed staging directory is retained for inspection; an existing component directory is never replaced.

| Command                    | Result                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run validate`         | Validate the configured component manifest, implementation metadata, styles, and referenced assets.                   |
| `npm run build`            | Generate the development ESM artifact and both target packages.                                                       |
| `npm run inspect`          | Verify packaged artifacts, contract consistency, and payload checksums.                                               |
| `npm run reproduce`        | Copy source twice, independently install both lockfiles, build both copies, and compare unsigned files byte for byte. |
| `npm run verify`           | Run the local acceptance gates and create measured browser verification evidence.                                     |
| `npm run release -- 2.0.0` | Run acceptance and append that manifest version to the local immutable release catalog only on success.               |

The argument to `release` must equal the source manifest version. Release registration is local; these commands do not publish a Forge component, modify OML, or deploy to an OutSystems environment.

## Artifact anatomy and target differences

The immutable bootstrap reference lives at `dist/command-palette/1.0.0`; the hardening candidate uses `dist/command-palette/2.0.0`. Each release's `odc` and `o11-reactive` folders contain the component script and stylesheet, normalized manifest, payload schemas, target profile, validated adapter metadata, integration instructions, Mentor recipe, CSP report, and license notices. `shared` contains generated types, the development ESM bundle, dependency inventory, SPDX SBOM, input metadata, release metadata, and checksums. Verification adds a separate `evidence` tree with measured results and supporting reports.

Both targets come from one component revision and contract. Their adapters and target profiles remain distinct even when JavaScript and CSS bytes match. Introduce platform differences through the corresponding target profile or explicit build entry, describe the capability difference, and keep shared component code free of runtime platform-selection branches. O11 Traditional Web is outside the target matrix.

`npm run build` establishes generated artifacts. `npm run verify` may establish `browser-verified` status only after every required measurement satisfies the versioned release policy for both targets and all pinned browsers. A target remains below `OutSystems-verified` until a named tenant/platform smoke test supplies the required evidence. Browser simulation does not supply that evidence.

## Dependency provenance and notices

The inventory follows actual esbuild input files and import edges, then resolves the exact installed package path against `package-lock.json`. It distinguishes workspace, direct, and transitive packages and preserves nested installations of multiple versions. A package present only in the development lockfile is absent from the runtime SBOM unless its source enters the bundle. Synthetic esbuild helper code is part of generated output and is not mistaken for a third-party dependency.

Direct third-party runtime dependencies must be declared with exact versions and matching license conclusions. Included transitive dependencies must exist in the lockfile graph and pass the same license policy; they are inventoried even when the author declared only the direct dependency. Installed metadata must match the lockfile. Each redistributed third-party package must supply actual LICENSE/COPYING/NOTICE text; a license identifier alone is insufficient. The emitted license notices preserve that text. Private bootstrap workspace packages are explicitly `UNLICENSED`; no redistribution license is inferred for project-owned code.

External dependencies remain exceptional. Their manifest records the exact version, host global, HTTPS origin, load ordering, license, integrity, and CSP requirements. An external package is marked as not redistributed, with a host responsibility to retain provider notices. An unrecognized external import or an input outside governed workspace packages fails the inventory gate.

## Security policy

Production scripts are self-contained and use the configured bridge namespace. Static checks cover direct and common aliased/bracketed forms of dynamic evaluation, string timers and event handlers, raw HTML execution sinks, undeclared global writes, unresolved modules, Node globals, network requests, workers, and script/image/frame resources. The namespace check compares identifier segments, so `OSAIEvil` does not pass as `OSAI`. Resources resolve to declared literal origins or exact asset paths; declaring one origin does not approve every asset on that origin.

CSS resource checks parse the stylesheet and inspect URLs and imports, including quoted imports. Dynamic HTML insertion or an unverifiable resource requires a separately reviewed adapter and a corresponding contract change; the reference component uses text nodes and declared bundled resources.

These checks target known static patterns. They are not a proof about every possible JavaScript program. Browser tests under restrictive CSP, component conformance, explicit capability declarations, and code review complete the release process. The gate fails on a finding instead of silently claiming the artifact is safe.

## Reproducibility

`npm run reproduce` creates two separate temporary source workspaces. It copies governed source and configuration, excludes `node_modules`, previous output, caches, Git metadata, and credential folders, and executes `npm ci` followed by `npm run build` independently in each workspace. The unsigned payload map must contain the same paths and SHA-256 values. This is stronger than building twice into different output directories with the same installed dependencies.

Build and verification evidence contains environment-specific observations and remains outside the unsigned payload comparison. The checksum index and release metadata are checked against the payload rather than hashing themselves recursively. Signatures, attestations, and timestamps must also remain separate from unsigned files.

Temporary workspaces are retained for inspection when the command finishes or fails. Their paths appear in the reproduction result and verification evidence. A changed file, missing artifact, or differing normalized contract fails reproduction or inspection; it never receives an automatic tolerance.

For a full acceptance run in an independent source copy, set `PLAYWRIGHT_BROWSERS_PATH` to an absolute cache populated by `npm run browsers:install`, set `CI=true` so the test runner owns its server, and choose an unused `OSAI_HARNESS_PORT` (default 4173). Then run `npm run verify -- --component <id>` in that copy, adding `--fixture <manifest>` for a fixture. Catalog registration is a separate requested action. The alternate port changes no distributed bytes. No existing preview server is reused in CI mode.

## Version compatibility and catalog writes

Every catalog record binds component ID, version, normalized contract, and aggregate payload digest. An exact retry is idempotent. Reusing a version for different bytes or metadata fails. Versions must increase relative to the latest registered version; the record ID and version must match the manifest.

Removed or modified public members, changed defaults and update behavior, removed targets, changed contract/schema versions, and newly required browser or external-host capabilities conservatively require a new major version. Added public members or targets require at least a minor increase. An implementation-only compatible correction may use a patch version. The classifier deliberately treats an existing schema change as breaking when it cannot prove compatibility.

Writers obtain an exclusive catalog lock, reread and validate the current catalog under that lock, sync a uniquely named pending file, and atomically replace the catalog. Concurrent releases cannot overwrite each other's appended entries. Failed or conflicting candidates leave prior records unchanged. A lock records its process ID and candidate identity; a crashed writer may leave a lock requiring inspection before retry. The implementation does not automatically delete another writer's lock based on age.

Commit `releases/catalog.json` after a successful internal registration. The writer owns its deterministic canonical JSON formatting, so it is excluded from Prettier alongside the lockfile; do not edit or reformat catalog records manually.

Future components follow the same manifest, SDK, runtime, distribution, and evidence requirements. A Gantt component can be proposed separately once its data model, rendering dependencies, accessibility behavior, size budgets, and target capabilities are specified.

## Host-specific visual qualification

Follow [visual hosts and reviewed references](certification.md#visual-hosts-and-reviewed-references)
for explicit collection, per-image review, and ordinary component/workbench runs.
Supported execution hosts are Windows x64 and macOS arm64; only the executing
host's references can be collected. Preserve failed reports and the other host's
corpus. Suite/policy 2.1.0 bind all reference hashes and review metadata. Collection
reports cannot grant readiness, and no numerical gate has changed. Actual Windows,
ODC/O11 native and mobile execution must each be reported from their own evidence.
