# component-distribution Specification

## Purpose

Defines reproducible target distributions and compatibility evidence that let a conforming component be consumed safely by ODC and OS11 Reactive/Mobile applications.

## Requirements

### Requirement: One source produces target-labelled distributions
The pipeline SHALL produce ODC and OS11 Reactive/Mobile distributions from the same component revision and public contract, without requiring separately maintained component implementations.

#### Scenario: Cross-target build succeeds
- **WHEN** the bootstrap pipeline builds a conforming component
- **THEN** distinct ODC and OS11 Reactive/Mobile packages are produced with the same public contract version

#### Scenario: No platform difference is needed
- **WHEN** the capability matrix permits identical runtime code for both targets
- **THEN** the target packages may reuse identical core bytes while retaining target-specific metadata and adapter assets

#### Scenario: Unsupported target is requested
- **WHEN** a build requests a target absent from the component manifest
- **THEN** the pipeline refuses to emit or label a package for that target

### Requirement: Platform differences are explicit
Any target-specific source, transformation, polyfill, or asset SHALL be selected at build time and recorded against a documented platform capability difference.

#### Scenario: Target override is introduced
- **WHEN** a component requires behavior that differs between ODC and OS11
- **THEN** the build records the capability rationale and includes the override only in the affected target

#### Scenario: Undeclared runtime target branch is detected
- **WHEN** validation finds platform detection used to select implementations at runtime without an approved exception
- **THEN** the distribution fails its architecture gate

### Requirement: Release artifacts are complete and contract-consistent
Each target package SHALL include its executable script, styles, normalized manifest, payload schemas, contract-validated adapter metadata, integration guidance, version, integrity checksums, and applicable license notices; shared release metadata SHALL include types and a machine-readable direct and transitive dependency inventory with versions and licenses.

#### Scenario: Consumer inspects a release
- **WHEN** a target package is unpacked
- **THEN** every declared artifact exists, adapter metadata matches the normalized contract, and every checksum matches the release manifest

#### Scenario: Declared artifact is missing
- **WHEN** a required or referenced file is absent
- **THEN** packaging fails before the release can be marked ready

#### Scenario: Dependency inventory is incomplete
- **WHEN** an included direct or transitive runtime dependency lacks a recorded version or license conclusion
- **THEN** the release fails its dependency-governance gate

### Requirement: Runtime loading is self-contained and component-isolated by default
Target scripts SHALL have no unresolved module imports or undeclared runtime fetches, SHALL include only the requested component plus an approved shared bridge, and SHALL permit external dependencies only when version, global name, origin, load order, license, integrity, and CSP impact are declared.

#### Scenario: Default component is imported
- **WHEN** a consumer loads a self-contained target script and its styles
- **THEN** the component becomes available without a package manager or module loader in the OutSystems runtime

#### Scenario: One component is packaged
- **WHEN** the command-palette package is built
- **THEN** no unrelated catalog component implementation is present in its runtime payload

#### Scenario: Approved external is used
- **WHEN** a component intentionally externalizes a runtime dependency
- **THEN** the package documents and validates every host responsibility before target readiness is granted

### Requirement: Distributions support restrictive security policies
Production artifacts SHALL avoid dynamic code evaluation and undeclared inline execution and SHALL report all required script, style, image, font, worker, frame, and network sources.

#### Scenario: Strict security scan runs
- **WHEN** a production target is scanned for dynamic evaluation and undeclared origins
- **THEN** the scan passes without `eval`, `new Function`, inline event handlers, or an unreported runtime source

### Requirement: Unsigned release payloads are reproducible and registered versions are immutable
The same normalized inputs and locked toolchain SHALL produce byte-identical unsigned payload files; signatures, attestations, and timestamps SHALL be separate metadata. Once a semantic version is recorded in the internal release catalog, that version SHALL NOT be associated with different payload bytes or contract metadata.

#### Scenario: Revision is rebuilt
- **WHEN** the same revision is built twice in clean environments with the locked toolchain
- **THEN** every unsigned payload file has the same byte-level checksum

#### Scenario: Registered version content changes
- **WHEN** a release attempts to reuse an internally registered version for different bytes or contract metadata
- **THEN** registration is rejected and a new version is required

### Requirement: Compatibility changes are classified
The release process SHALL compare public properties, events, commands, payload schemas, theme tokens, and behavioral guarantees against the previous version and SHALL enforce semantic versioning.

#### Scenario: Breaking contract change is detected
- **WHEN** a required input, event payload, command, or supported behavior becomes incompatible
- **THEN** the release is rejected unless its major version is incremented

### Requirement: Target readiness is evidence-based
A target package SHALL distinguish generated, browser-verified, and OutSystems-verified status and SHALL not claim a higher status without the corresponding automated or recorded evidence.

#### Scenario: Local build has no tenant smoke test
- **WHEN** a target package passes local gates but has not run in its OutSystems target
- **THEN** it is marked browser-verified rather than OutSystems-verified

#### Scenario: OutSystems smoke test passes
- **WHEN** the package passes create, update, event, command, navigation, and disposal tests in a named target
- **THEN** the evidence records environment identity, platform version, artifact checksums, suite version, exact results, and OutSystems-verified status

### Requirement: A versioned release policy makes quality gates measurable
A releasable component SHALL pass the exact browser matrix, accessibility standard, keyboard suite, theme and RTL suite, visual thresholds, CSP rules, size budgets, multiple-instance checks, lifecycle iteration count, and leak thresholds declared by the repository's versioned release policy for each claimed target.

#### Scenario: Mandatory gate passes
- **WHEN** every measured value satisfies the applicable release-policy threshold
- **THEN** the evidence report records the policy version, measured values, and release-ready state

#### Scenario: Mandatory gate fails
- **WHEN** any measured value violates an applicable threshold
- **THEN** the affected target is not marked release-ready and the report identifies the gate, threshold, and measured value

### Requirement: Pipeline operations select components consistently
Discovery, validation, build, inspection, preview, verification, release and reproducibility SHALL resolve a shared component identity. A selected component SHALL use its own source, scenarios, profiles and artifact paths without requiring edits to platform implementation.

#### Scenario: Newly scaffolded component uses the pipeline
- **WHEN** a developer scaffolds a new component and selects it for build and verification
- **THEN** the pipeline uses that component throughout and produces its target-labelled artifacts and evidence without edits to shared platform source

#### Scenario: Selection is ambiguous or invalid
- **WHEN** a selector is unknown, resolves duplicate component IDs, conflicts with another selector or escapes allowed source roots
- **THEN** the operation fails before changing outputs or release records

#### Scenario: Component-only package is inspected
- **WHEN** a selected component is packaged
- **THEN** its runtime payload contains neither unrelated product components nor test fixture implementations

### Requirement: All executable assets receive equivalent governance
Every shipped executable asset SHALL be compiled or validated for the supported runtime, scanned for security and capability violations, included in the dependency inventory, and bound into release checksums and evidence. Opaque copying SHALL be limited to validated non-executable assets.

#### Scenario: Worker contains forbidden execution
- **WHEN** an auxiliary worker or script contains dynamic evaluation, undeclared network use or unresolved module imports
- **THEN** the release fails even if the principal script passes its scan

#### Scenario: Auxiliary dependency is missing governance data
- **WHEN** a dependency reachable only from an auxiliary executable lacks its required version or license record
- **THEN** dependency verification rejects the complete release graph

#### Scenario: Executable asset is unsupported or missing
- **WHEN** an asset declares an unsupported executable format or references an absent graph member
- **THEN** packaging fails before target readiness is assigned

### Requirement: Resource locations are explicit and host independent
Packaged assets SHALL have stable logical identities and validated host URL mappings bound to the component release. Resource loading SHALL NOT assume that a screen URL or a script execution URL identifies the asset directory, and undeclared origins SHALL be rejected.

#### Scenario: Host screen and resource paths differ
- **WHEN** a supported host maps declared assets to URLs unrelated to the screen route
- **THEN** workers, styles, images and fonts resolve through the supplied mapping and function under the declared CSP

#### Scenario: Required asset mapping is missing or incompatible
- **WHEN** creation lacks a required mapping or a host attempts incompatible re-registration while instances are live
- **THEN** the operation fails with a stable diagnostic without changing live instance resource resolution

### Requirement: Native adapter metadata describes the complete loading contract
Versioned adapter metadata SHALL enumerate principal and auxiliary assets, identity hashes, usage, dependencies, load order, integrity, licenses, CSP and native mapping responsibilities. Incomplete legacy metadata SHALL NOT satisfy the new handoff certification contract.

#### Scenario: Component requires a worker and an external dependency
- **WHEN** its adapter and integration guidance are generated
- **THEN** both resources and every required host loading responsibility appear with their release-bound identity

#### Scenario: Old release is inspected
- **WHEN** an immutable legacy package is inspected with the new tooling
- **THEN** inspection can report its historical format and evidence without rewriting its files or granting it the new certification status

### Requirement: Evidence binds component profiles and the complete artifact set
Release evidence SHALL bind component/version, target, normalized contract, the complete artifact checksum set, policy/profile versions and hashes, suite inventory and browser pins. A changed bound input SHALL invalidate prior qualification for the new payload without mutating existing registered releases.

#### Scenario: Only a worker or profile changes
- **WHEN** a worker file or the selected profile changes while the main script remains identical
- **THEN** old evidence cannot qualify the changed release and fresh verification is required

#### Scenario: Hardened output differs from an existing release
- **WHEN** migration generates bytes different from the registered command-palette 1.0.0 payload
- **THEN** the original release remains immutable and registration requires a new appropriately classified version
