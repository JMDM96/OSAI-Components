# Local component workbench

Build a package, then run `npm run preview -- --component command-palette`.
The server listens only on 127.0.0.1 (default port 4173); `OSAI_HARNESS_PORT`
selects another port. Include fixtures explicitly, for example:

```powershell
npm run build -- --component resources --fixture tests/fixtures/resources/component.manifest.json
npm run preview -- --component resources --fixture tests/fixtures/resources/component.manifest.json --fixture tests/fixtures/minimal/component.manifest.json
```

Library lists discovered production components and opted-in fixtures. Workspace
selects a built component/version/target and loads an isolated document. Current
source versions are supported; absent historical versions display Unavailable.
Switching disposes the previous instance and subscriptions before removing its
document. Configuration and command forms come from the manifest; complex fields
also have JSON input. Create, Apply update, Invoke and Dispose use the public bridge.
Invalid JSON never reaches it; rejected valid JSON retains the last committed state
where recovery succeeds. A faulted instance needs explicit disposal and recreation.

For the command palette, click **Create**, then **Invoke** with the **open** command
selected. The palette starts closed, so creating it alone leaves the preview area
empty. The workbench selects `open` by default when the component declares it;
loading a package does not create an instance or invoke commands automatically.
After **Dispose**, click **Create** and invoke `open` again.

Activity keeps at most 100 entries in memory, states how many were dropped and
exports only identities, operation/event names and stable result codes. Payloads,
tokens and arbitrary error text are excluded. Reset disposes and reloads the
preview and clears that session's history. Library, Workspace and Activity have
keyboard-accessible links and reloadable URL fragments.

Readiness is bound to the selected full payload, current contract/profile/descriptor,
policy/suite, exact browser matrix and archived measurements. Generated, missing,
stale and unavailable packages do not display verified badges. Browser verified
does not mean tenant verified. The server serves only checksummed registered graph
paths, with per-directive declared CSP, SRI and dependency/auxiliary load order.
An external dependency needs a declared script asset with matching origin and SRI
to establish its URL; otherwise preview requires a concrete mapping rather than a
guessed CDN URL. Workbench snapshots are reviewed separately from palette baselines.

The switching regression captures independent counts before component creation
and compares them with the preview's cleanup acknowledgement before detaching its
iframe. This accounts for Firefox's Playwright trace snapshotter resources without
excluding allocations by event name. SDK counts must also reach zero. The dedicated
component suite separately checks zero retained allocations and post-disposal effects.
