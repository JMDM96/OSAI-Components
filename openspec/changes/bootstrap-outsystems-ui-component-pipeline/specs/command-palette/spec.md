# Spec Delta

## Purpose

Defines the first reference component used to prove that the authoring contract, runtime bridge, target packaging, accessibility, and host event integration work together.

## ADDED Requirements

### Requirement: The palette opens and closes predictably
The command palette SHALL support idempotent host `open`, `close`, and `toggle` commands plus an optional keyboard shortcut, SHALL begin each closed-to-open transition with an empty query, and SHALL expose state through `opened` and `closed` events.

#### Scenario: Host command opens the palette
- **WHEN** any host, including a touch-only host, invokes `open` while the palette is closed
- **THEN** one palette surface opens, its query is empty, its search input receives focus, and one `opened` event is emitted

#### Scenario: Open is invoked while already open
- **WHEN** the host invokes `open` for an open palette
- **THEN** the operation succeeds without duplicating surfaces, listeners, focus traps, or `opened` events

#### Scenario: Escape closes the palette
- **WHEN** the palette is open and the user presses Escape
- **THEN** the palette closes, emits one `closed` event with reason `escape`, and restores prior focus when that element still exists

#### Scenario: Prior focus no longer exists
- **WHEN** the palette closes after the previously focused element was removed
- **THEN** focus moves to the component host when focusable or otherwise to the document body

### Requirement: Commands have a serializable and safe contract
Each command SHALL have a stable identifier and label and MAY declare description, keywords, group, disabled state, and presentation metadata using the component's command-item schema; all host-supplied text SHALL render as text rather than executable markup.

#### Scenario: Valid command data is loaded
- **WHEN** the host supplies a schema-valid command list
- **THEN** the palette renders the enabled and disabled commands in their declared order

#### Scenario: Invalid command data is supplied
- **WHEN** a command is missing its identifier or label or duplicates another identifier
- **THEN** the update is rejected atomically and the last valid command list remains active

#### Scenario: Host text contains markup
- **WHEN** a label, description, keyword, placeholder, or empty-state string contains HTML or script-like text
- **THEN** the literal text is displayed without creating executable markup or attributes

### Requirement: Search is deterministic substring filtering
The palette SHALL normalize each query and candidate with Unicode NFKC followed by lowercase conversion, trim the query, include commands whose label or any keyword contains the query, and preserve original host order without fuzzy scoring. It SHALL expose committed query changes through `queryChanged` events.

#### Scenario: User enters a query
- **WHEN** the normalized search text is a substring of a command label or keyword
- **THEN** matching commands are presented in original host order, the first enabled result becomes active, and one `queryChanged` event reports the query

#### Scenario: Query is empty or whitespace-only
- **WHEN** the committed query normalizes to an empty string
- **THEN** all commands are presented in original host order

#### Scenario: Query has no results
- **WHEN** no command matches the current query
- **THEN** the configured empty state is displayed, the result count is announced, and no command is active or selectable

### Requirement: Keyboard and composition interaction cover the complete workflow
The palette SHALL keep DOM focus in the search control; Arrow Down and Arrow Up SHALL wrap through enabled results; Home and End SHALL select the first and last enabled result; Enter SHALL activate the active option; and Escape SHALL close the palette. Active option state SHALL be exposed through `aria-activedescendant`.

#### Scenario: User navigates results
- **WHEN** the user presses Arrow Down, Arrow Up, Home, or End while enabled results exist
- **THEN** the active option moves according to the defined wrapping rule, skips disabled commands, and scrolls into view

#### Scenario: Enter is pressed without an enabled result
- **WHEN** the user presses Enter while no enabled option is active
- **THEN** no selection event or state change occurs

#### Scenario: IME composition is active
- **WHEN** Enter is pressed before the active text composition has ended
- **THEN** the input method may commit text but the palette does not select a command

### Requirement: Selection is delegated to the host
Selecting an enabled command SHALL emit exactly one `commandSelected` event containing the component instance identifier, command identifier, current query, and activation source `keyboard` or `pointer`; the component SHALL NOT execute host business logic and SHALL close after the event by default.

#### Scenario: Host receives a keyboard selection
- **WHEN** the user presses Enter with an enabled active option
- **THEN** the host receives one `commandSelected` event with activation source `keyboard` and the palette closes once with reason `selection`

#### Scenario: Host receives a pointer selection
- **WHEN** the user activates an enabled command by pointer or touch
- **THEN** the host receives one `commandSelected` event with activation source `pointer` and the palette closes once with reason `selection`

#### Scenario: Disabled command is activated
- **WHEN** a user attempts to activate a disabled command
- **THEN** no selection event is emitted

### Requirement: Host updates preserve valid live state atomically
The host SHALL be able to replace command data, labels, placeholders, shortcut configuration, and supported presentation settings without remounting; an accepted update SHALL retain the current query and active command identifier when that command remains visible and enabled.

#### Scenario: Commands change while open
- **WHEN** a valid command update retains the active command as a visible enabled result
- **THEN** the palette keeps the query and active identifier without duplicating global listeners

#### Scenario: Active command becomes unavailable
- **WHEN** a valid update removes, disables, or filters out the active command
- **THEN** the first enabled result becomes active, or no command is active when none is enabled

#### Scenario: Empty command collection is supplied
- **WHEN** a valid update replaces commands with an empty collection
- **THEN** the empty state is shown, the result count is announced, and navigation and activation are safe no-ops

### Requirement: The palette exposes an accessible modal interaction
The open palette SHALL use named dialog, combobox, listbox, and option semantics; SHALL expose expanded, active, selected, disabled, count, and relationship states; SHALL keep Tab and Shift+Tab within its modal controls; SHALL make background content unavailable for interaction; and SHALL announce result-count and empty-state changes.

#### Scenario: Assistive technology inspects an open palette
- **WHEN** the palette is open with results
- **THEN** its accessible name, query control, result count, active option, disabled states, and instructions are programmatically available

#### Scenario: Narrow viewport or zoom is used
- **WHEN** the host is 320 CSS pixels wide or page zoom is 200 percent
- **THEN** search, results, close behavior, and command activation remain visible and operable without two-dimensional scrolling

#### Scenario: Reduced motion is requested
- **WHEN** the user prefers reduced motion
- **THEN** opening, closing, and result transitions avoid non-essential animation

### Requirement: The palette is themeable and isolated
The palette SHALL use documented component tokens, inherit appropriate host typography and direction, and avoid changing unrelated OutSystems UI styles or sibling palette instances.

#### Scenario: Host theme and RTL are active
- **WHEN** the consuming application changes supported tokens or document direction
- **THEN** the palette adopts the theme and lays out correctly without an instance rebuild

#### Scenario: One instance overrides a token
- **WHEN** one palette host overrides a documented token
- **THEN** that palette changes while a sibling palette retains its own computed value

### Requirement: Shortcut ownership is opt-in and deterministic
Global shortcut registration SHALL be disabled unless configured. For a given normalized shortcut, the earliest live registration SHALL own it; later registrations SHALL receive a `shortcut-conflict` diagnostic and remain ordered contenders; ownership SHALL transfer to the next contender when the owner changes shortcut or is disposed. Shortcuts SHALL be ignored from editable controls outside an already-open palette.

#### Scenario: Two instances share a shortcut
- **WHEN** two live palettes opt into the same shortcut
- **THEN** only the earliest registration responds, the later instance reports the collision, and one user gesture cannot open both

#### Scenario: Owning instance is disposed
- **WHEN** the instance owning a shortcut is disposed
- **THEN** its listener and claim are removed and the next live contender becomes owner

#### Scenario: Shortcut originates in an editable control
- **WHEN** the configured shortcut is pressed in an input, textarea, select, or contenteditable surface outside the palette
- **THEN** no palette opens and the host editing gesture is not intercepted

### Requirement: Disposal is safe while the palette is open
Disposing an open palette SHALL remove its modal surface, focus trap, shortcut claim, listeners, and pending event deliveries without emitting selection or additional state events.

#### Scenario: Host destroys an open palette
- **WHEN** the runtime disposes the instance during navigation or conditional rendering
- **THEN** no palette DOM, background lock, shortcut ownership, callback, or post-dispose event remains
