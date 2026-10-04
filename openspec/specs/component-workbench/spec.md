# component-workbench Specification

## Purpose

Provides an honest local development surface for selecting packaged components, exercising their public contracts and inspecting their lifecycle and verification evidence.

## Requirements

### Requirement: Navigation exposes real distinct views
The workbench SHALL expose functional Library, Preview/Workspace and Activity views with correct active navigation, keyboard access and restorable deep links. Labels SHALL NOT imply a component catalog or event log that is only decorative demo content.

#### Scenario: Developer switches views
- **WHEN** the developer selects Component library or Activity
- **THEN** the requested view becomes active and displays discovered components or recorded activity respectively

#### Scenario: Activity deep link is reloaded
- **WHEN** the developer reloads an Activity URL
- **THEN** Activity remains selected with coherent empty or current-session state rather than pretending activity persisted

### Requirement: Preview selection loads isolated packaged artifacts
The workbench SHALL discover components from the shared registry and preview the selected component/version/target using its release artifacts in an isolated document. Changing selection SHALL dispose the prior instance and subscriptions.

#### Scenario: Component selection changes
- **WHEN** the developer switches from the palette to a stress fixture or another available component
- **THEN** the selected package loads without palette-specific routes and the old component leaves no active subscriptions or owned work

#### Scenario: Selected artifact is absent
- **WHEN** a component has not been built for the selected target or version
- **THEN** the view displays a build-required error instead of silently loading another package

### Requirement: Public contracts drive workbench controls
The workbench SHALL offer schema-derived configuration and command controls, a validated JSON fallback, lifecycle actions and declared event subscriptions. Invalid input SHALL show a contract diagnostic without replacing the last valid live state.

#### Scenario: Configuration is edited
- **WHEN** the developer applies a complete valid configuration or invokes a declared command
- **THEN** the workbench uses the public bridge and displays the serialized result

#### Scenario: Configuration JSON is invalid
- **WHEN** malformed or schema-invalid input is submitted
- **THEN** the workbench reports the error and the preview retains its last committed configuration

### Requirement: Activity is bounded and private by default
The activity view SHALL record ordered lifecycle operations, results, events and scrubbed diagnostics with component and instance identity. Storage SHALL be bounded, payload values SHALL be redacted by default, and input data SHALL NOT persist across sessions by default.

#### Scenario: Activity capacity is reached
- **WHEN** the local activity buffer exceeds its declared maximum
- **THEN** the view indicates truncation and retains only its bounded window without affecting component event delivery

#### Scenario: Developer inspects or exports a trace
- **WHEN** the developer inspects activity or exports diagnostics without requesting payload inclusion
- **THEN** values remain redacted and authentication material never appears in the output

### Requirement: Workbench readiness reflects matching evidence
The workbench SHALL distinguish missing, stale, generated, browser-verified and OutSystems-verified evidence for the exact selected release and target. Its loopback server SHALL serve only registered release resources under restrictive declared policies.

#### Scenario: Selected version differs from verified bytes
- **WHEN** stored evidence refers to another artifact set or target
- **THEN** the workbench labels it stale or unmatched rather than displaying a verified badge

#### Scenario: Request escapes registered resources
- **WHEN** a browser requests a traversal path or an unregistered repository file
- **THEN** the server rejects it without exposing workspace contents
