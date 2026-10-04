# Spec Delta

## ADDED Requirements

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
