# Command palette: live ODC demo

Verified on **October 7, 2026, America/Los_Angeles** (October 8 UTC).

[Open OS AI Components Demo](https://personal-ypbfdmrf-dev.outsystems.app/OSAIComponentsDemo).
Click **Open**, or press **Command+K** on this Mac. The page provides synthetic
commands, editable inputs and an event log. Escape closes the palette. Settings
apply to the current page session; the sample commands have no business side effects.

## Publication verified

| Item                   | Verified value                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Tenant                 | `personal-ypbfdmrf.outsystems.dev`                                                   |
| Environment            | Development — `1f9d2491-b5ae-4415-8993-31f17583b2d5`                                 |
| App                    | OS AI Components Demo — `f5aec50e-0cd1-4cc3-997f-0867943275fc`                       |
| App revision           | **4**, confirmed by both source and deployed inventory                               |
| Publication/deployment | `da60efea-bf6b-49d1-875f-43a90ba9b00d` — Finished, success                           |
| Build                  | `7285217e-9191-4ad6-8062-a46a7b91bdbd`                                               |
| Library                | OS AI Components — `e13398dc-01ec-4955-a60b-2a6d7d99f357`, revision 4, release 0.1.0 |
| Browser package        | `command-palette@2.0.0`                                                              |

The normal OAuth sign-in restored the active MCP connection. Mentor retained the
existing draft, completed its inspection without another quota failure, and
confirmed the root-scoped resolver in all three native controls. It reported zero
validation errors and warnings. Publication then started and completed, replacing
the previously deployed revision 3. The completed demo Mentor session was closed
after verification; subsequent edits should load the published app.

## Browser observations

These are manual checks in the Codex in-app browser on this Mac, using the real
library Block in Development.

| Exercise             | Result and evidence                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Load                 | Styled palette opens with five sample commands; no warnings/errors returned by the browser console inspection                           |
| Native controls      | Open works; Toggle opens from closed; Close on an already-closed palette returns success                                                |
| Search and selection | `project` returns two results; ArrowDown and Enter select `find-project`; one selection event reaches the screen and the palette closes |
| Disabled command     | `billing` returns the disabled command; Enter leaves it unselected and the palette open                                                 |
| Keyboard             | Command+K opens; arrows navigate; Enter selects; Escape closes                                                                          |
| Valid input update   | Changed title, placeholder and replacement commands render in the same instance                                                         |
| Invalid input update | Malformed JSON is rejected; draft inputs remain editable and the last working configuration is preserved                                |
| Repeated renders     | Reset and three repeated Apply operations retain one DOM root; the next open/search/select produces one event of each expected type     |
| Navigation           | About removes the component root and shortcut behavior; return creates a new single instance and Command+K opens once                   |

Native **Close while open** and **Toggle from open to closed** remain untested:
the modal intentionally makes background controls inert, including these demo
buttons. Escape, selection and the palette's own close control are separate paths.
The sample needs a better way to exercise those native command transitions.

During navigation testing, one pointer activation of the return link did not
navigate; keyboard Enter on the same link worked. No console error accompanied
it, and the cause was not established. Do not infer a component defect from that
single automation observation.

## Served asset comparison

Both observed component asset URLs returned HTTP 200.

- **CSS:** 6,199 bytes; exactly equal to the qualified CSS. SHA-256
  `a5e08c940d69aeb1922d8fdcf439a0b59ac3fa759ae341f15f6236c24a656c89`.
  The page's stylesheet link also carries the matching SRI value.
- **JavaScript:** 59,120 served bytes versus 59,117 qualified bytes. The served
  file is exactly the qualified file preceded by the UTF-8 BOM bytes `EF BB BF`.
  Served SHA-256:
  `352a4df6bc81c558be7f06a322fa057b40ded237a4c139d4a43b97f11ab3747e`.
  Qualified SHA-256:
  `9ad41f8eab63cadb93f9ed8c34553edbf1b5ee9c731361ed3a1d5123f8b5c086`.

This is a working published preview with partial native verification. It is **not
a full native certification result**: the exact JavaScript byte comparison fails,
two native command transitions remain unexercised, and live multi-instance
isolation/failure races were not tested. O11 and mobile webview remain unexecuted.
No certification thresholds, registered payloads or qualification levels were changed.

## Retained evidence and follow-up context

Local evidence lives in the ignored `.build/odc-live/2026-10-07/` directory:
`live-verification.json`, `demo-readback.json`, `served-assets.json`, the downloaded
JS/CSS and `demo-live.jpg`. These files do not automatically travel with a clone.
The ongoing machine-readable checkpoint is
`.build/odc-live/2026-10-06/checkpoint.json`.

A portable local backup is retained at
`.build/evidence-backups/2026-10-07-odc-checkpoint.tar.gz`, with an adjacent
`.sha256` checksum and `README.md` containing verification and restore instructions.
It includes the retained packages, handoff, native plans, preflight and live records,
plus current, failed and reference-collection test reports. The archive contains a
per-file SHA-256 manifest. It remains ignored by Git; copy the archive and checksum
to a separate backup location to preserve this evidence beyond this machine.
Restoring these historical records does not qualify later source changes.

The [pain-point record](odc-integration-pain-points.md) retains the earlier failures
and adds this outcome. Questions about modal test controls and imported/served byte
identity belong in the later brainstorming and OpenSpec planning session. This
publication did not implement pipeline or skill changes.
