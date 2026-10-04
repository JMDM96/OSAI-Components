# Command palette

The command palette is a dependency-free reference component for ODC and OS11 Reactive/Mobile. Its stable component ID is `command-palette`, its initial version is `1.0.0`, and its bridge contract is `1.0`. The generated target integration guide describes importing the exact JavaScript and CSS files into an OutSystems Library Block. Local browser verification does not establish tenant compatibility.

## Configuration

Every create or update accepts a complete JSON configuration. `commands` is required; omitted presentation fields return to their defaults on update. Unknown properties, duplicate IDs, invalid values and `null` are rejected before changing the current state. All listed properties support live updates.

```json
{
  "commands": [
    {
      "id": "project.create",
      "label": "Create project",
      "description": "Start a new project workspace",
      "keywords": ["new", "add"],
      "group": "Projects",
      "metadata": { "hint": "New" }
    },
    { "id": "project.archive", "label": "Archive project", "disabled": true }
  ],
  "title": "Command palette",
  "placeholder": "Search commands…",
  "emptyMessage": "No commands found.",
  "shortcut": "Mod+K",
  "closeOnSelect": true
}
```

| Property        | Default              | Meaning                                                       |
| --------------- | -------------------- | ------------------------------------------------------------- |
| `commands`      | Required             | Ordered command items; `[]` is valid.                         |
| `title`         | `Command palette`    | Visible heading and accessible dialog name. Must be nonempty. |
| `placeholder`   | `Search commands…`   | Search hint; the combobox also has a programmatic label.      |
| `emptyMessage`  | `No commands found.` | Visible and announced no-results message.                     |
| `shortcut`      | `""`                 | Optional modifier-plus-key shortcut. Empty disables it.       |
| `closeOnSelect` | `true`               | Whether selecting a command closes the palette.               |

Each command requires unique, nonempty `id` and `label` strings. Optional fields are `description`, `keywords` (string array), `group`, `disabled` (boolean), and `metadata.hint` (display-only text). Groups are row metadata, preserving the host's original order rather than regrouping items. Host text is rendered through text nodes or text-only DOM properties. Markup, functions, URLs to execute and callback expressions are not accepted as executable content.

Search applies Unicode NFKC normalization followed by lowercase conversion. It trims the query and matches it as a substring of labels or keywords. Results preserve host order, including disabled results; description and group do not participate in matching. Whitespace-only input shows all commands. An update retains the current raw query and active command ID if that command is still visible and enabled, otherwise the first enabled result becomes active.

## Commands and events

`open`, `close`, and `toggle` take `{}` and synchronously return `{ "isOpen": true }` or `{ "isOpen": false }` inside the bridge response envelope. Repeating `open` or `close` has no additional effect. Opening from closed always starts with an empty query. Host buttons that call `open` are the primary touch/mobile entry point.

Events arrive asynchronously through registered bridge callbacks. The bridge event envelope contains `value.instanceId`, `value.eventName`, and `value.payload`. The schemas in `components/command-palette/schemas` describe each payload.

| Event             | Payload fields                                                                         |
| ----------------- | -------------------------------------------------------------------------------------- |
| `opened`          | `instanceId`                                                                           |
| `closed`          | `instanceId`, `reason`: `host`, `escape`, `selection`, `shortcut`, or `button`         |
| `queryChanged`    | `instanceId`, raw committed `query`, matching `resultCount` including disabled results |
| `commandSelected` | `instanceId`, `commandId`, raw `query`, `source`: `keyboard` or `pointer`              |
| `error`           | `instanceId`, stable `code`, scrubbed `message`                                        |

Selecting an enabled result emits one `commandSelected` event followed by `closed` with reason `selection` when `closeOnSelect` is true. The component never invokes application actions directly. Disabled items cannot be selected. IME composition does not filter or select until the input commits; duplicate browser input events for the same query do not duplicate query events.

This host example delegates business behavior to a supplied OutSystems Client Action callback:

```js
const api = window.OSAI.Components.v1;
const config = {
  commands: [{ id: 'project.create', label: 'Create project', keywords: ['new'] }],
};
const created = JSON.parse(
  api.create('command-palette', 'projects-palette', 'PaletteHost', JSON.stringify(config)),
);
if (!created.ok) throw new Error(created.message);

const subscribed = JSON.parse(
  api.registerCallback('projects-palette', 'commandSelected', (eventJson) => {
    const event = JSON.parse(eventJson);
    // In an OutSystems JavaScript node, map this to the Block's named Client Action.
    $actions.OnCommandSelected(event.value.payload.commandId);
  }),
);
api.invoke('projects-palette', 'open', '{}');

// Parameters Changed supplies the complete next configuration.
api.update(
  'projects-palette',
  JSON.stringify({
    commands: [{ id: 'project.create', label: 'New project' }],
  }),
);

// On Destroy cancels queued callbacks, subscriptions and owned resources.
api.unregisterCallback('projects-palette', subscribed.value.subscriptionId);
api.dispose('projects-palette');
```

`PaletteHost` must be the existing Block container ID, and `projects-palette` must be unique among live instances. Parse and check the common bridge envelope for every operation in production adapter code. Updating a title or command collection does not remount the surface or duplicate listeners. Disposal remains safe after the host DOM has already disappeared.

## Keyboard and accessibility

The open surface is a named modal dialog with a labeled combobox and listbox. The combobox uses `aria-activedescendant` for virtual option focus; navigation keeps actual focus in the search input. Each option exposes selected, disabled and position states. The live status announces matching counts and the empty message.

| Gesture          | Behavior                                                        |
| ---------------- | --------------------------------------------------------------- |
| Up / Down        | Previous / next enabled result, wrapping at the ends.           |
| Home / End       | First / last enabled result.                                    |
| Enter            | Select active enabled result; no effect during IME composition. |
| Escape           | Close and restore prior focus.                                  |
| Tab / Shift+Tab  | Cycle within the search input and close button.                 |
| Pointer or touch | Activate an enabled result or the close button.                 |

Background content is inert and hidden from assistive technology while the modal is active. If more than one palette is opened by host commands, the most recently opened modal owns interaction; closing it restores the previous owner's background state. On close, focus returns to the previously focused connected element; if unavailable it falls back to a focusable component host, then the document body. Disposal releases the modal without emitting further state or selection events.

Layout supports 320 CSS pixels, browser zoom, inherited direction and font family. The component uses logical spacing, wrapped host text, a vertically scrolling result list, and a 44-pixel close control. It has no essential animation and explicitly respects reduced motion. Application theme overrides remain responsible for preserving sufficient text, active-state and focus contrast.

## Optional shortcuts

Supported shortcuts combine distinct modifiers (`Ctrl`/`Control`, `Meta`, `Alt`, `Shift`, or `Mod`) and one ASCII letter or digit. Modifier order and case do not matter. `Mod` maps to Command on Apple platforms and Control elsewhere. Do not combine `Mod` with `Ctrl` or `Meta`; the validator rejects ambiguous or duplicate modifiers. Examples are `Mod+K`, `Ctrl+Shift+K`, and `Alt+P`.

For the same normalized shortcut, the earliest live registration owns it. Later registrations remain ordered contenders and report `shortcut-conflict` in bridge diagnostics; a live configuration update that encounters a collision also emits `error` to an already-registered callback. Initial create-time diagnostics are available through bridge inspection, since callbacks cannot be registered before creation. Ownership transfers when the owner changes its shortcut or is disposed. Merely updating other properties does not change a registration's place in the queue.

Shortcuts originating in input, textarea, select or editable content outside the already-open owning palette are ignored. Key repeat and composition are ignored. One gesture can activate only one registered owner. Browser/OS reserved shortcuts may remain unavailable; expose a host button as well.

## Theme tokens

Set tokens on one Block host to theme that instance. Ordinary selectors are scoped under its owned root; no external fonts, network resources, portals or global stylesheet rules are required. Internal classes and markup are not public API.

| Token suffix (prefix `--osai-command-palette-`) | Default               | Accepted value                                                             |
| ----------------------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| `background`                                    | `#ffffff`             | Nonempty CSS color expression                                              |
| `text`                                          | `#19202b`             | Nonempty CSS color expression                                              |
| `muted`                                         | `#596474`             | Nonempty CSS color expression                                              |
| `border`                                        | `#d6dce5`             | Nonempty CSS color expression                                              |
| `accent`                                        | `#185cc7`             | Nonempty CSS color expression                                              |
| `active-background`                             | `#edf3ff`             | Nonempty CSS color expression                                              |
| `overlay`                                       | `rgb(18 26 40 / 48%)` | Nonempty CSS color expression                                              |
| `radius`                                        | `16px`                | Nonnegative `px`, `rem`, or `em` length                                    |
| `width`                                         | `640px`               | Nonnegative `px`, `rem`, `em`, `vw`, or `%` length, capped to the viewport |
| `z-index`                                       | `1000`                | Nonnegative integer string                                                 |

Background, text and accent optionally fall back through OutSystems `--color-neutral-0`, `--color-neutral-10`, and `--color-primary` before the literal defaults. Text/color tokens accept CSS expressions so host variables can flow through; semantic color validity and contrast are measured by the browser gates rather than inferred from JSON Schema string validation. Light-DOM overlays should be hosted outside ancestors that clip fixed-position content or create unintended containing blocks through CSS transforms.

```css
.projects-palette-host {
  --osai-command-palette-accent: #2454a5;
  --osai-command-palette-radius: 12px;
  --osai-command-palette-width: 600px;
}
```

Run `npm exec vitest run components/command-palette` for component and bridge contract tests. The repository's `npm run verify` also tests exact generated target packages in the pinned browser matrix, checks accessibility and styles, and produces compatibility evidence.
