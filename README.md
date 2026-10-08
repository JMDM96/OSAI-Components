# OSAI Components

A TypeScript component SDK and build pipeline for OutSystems Developer Cloud and OutSystems 11 Reactive/Mobile. A single component implementation produces two target-labelled browser asset packages. The command palette is the first reference component.

The command palette also has a published **OS AI Components Demo** in Development. See the [live ODC demo guide](docs/odc-live-demo.md) for the application link, sample inputs, verified behavior and remaining native-verification limits. The [historical preflight](docs/odc-preflight.md) records the local qualification that preceded deployment.

## Setup

Use Node **26.3.1** and npm **11.16.0**. The exact versions are recorded in `.node-version` and `package.json`. From the repository root:

```powershell
npm ci
npm run browsers:install
npm run verify
```

`npm ci` installs the lockfile without changing versions. The only permitted dependency install script is the pinned esbuild installer. Browser downloads are development tools; generated components make no network requests and need no package manager at runtime.

Browser commands use Playwright's supported `PLAYWRIGHT_BROWSERS_PATH` setting, defaulting to the ignored `.cache/playwright` directory. Installation and tests therefore use the same pinned binaries without depending on the Windows user-profile browser cache. Set that environment variable to an absolute cache path if you want to share downloads across clean workspaces; no custom browser executable or unpinned version is used.

## Develop and inspect

```powershell
npm run validate
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run preview
```

Open `http://127.0.0.1:4173` for the command-palette integration harness. It loads the same script and CSS shipped to consumers. The page demonstrates host commands, full configuration updates, events, and disposal/recreation. Stop the preview with Ctrl+C.

```powershell
npm run test:browser
npm run inspect
npm run reproduce
```

Browser tests cover both target packages in Chromium, Firefox, and WebKit on Windows x64 and macOS arm64. Windows references keep their original paths under `tests/browser/baselines`; Mac references use its `darwin-arm64` subtree. Ordinary runs never write references or fall back to another host. See [visual review and qualification](docs/certification.md#visual-hosts-and-reviewed-references) for collection, review and fixture/workbench commands. Execution host details stay in reports; both reference sets and reviewed hashes bind the deterministic package provenance.

`npm run verify` checks formatting, lint, types, unit/conformance tests, packaged artifacts, browsers, accessibility, lifecycle resources, size, security policy, and clean-workspace reproducibility. It writes measured reports and only then grants `browser-verified` status. `npm run reproduce` independently installs and builds two fresh workspace copies from the lockfile and compares their unsigned payloads.

## Consume the output

```text
dist/command-palette/2.0.0/
  odc/             Browser script, CSS, schemas, adapter, integration guide
  o11-reactive/    Same public contract, separate target metadata
  shared/          Types, dependency inventory, licenses, checksums
  evidence/        Verification results tied to the exact payload
```

Import each target's `command-palette.js` and `command-palette.css` into an OutSystems Library Block following its generated `integration.md`. The bridge is `window.OSAI.Components.v1`; `build.config.json` controls that namespace. Keep the empty host Container under the Block's ownership, and let the component own its child root.

The public bridge uses string IDs and JSON strings. Its lifecycle is create, complete-configuration update, synchronous command invocation, registered asynchronous events, and idempotent disposal. Components emit events; the host performs application actions. See [runtime API](docs/runtime.md), [command palette](docs/command-palette.md), and [OutSystems integration](docs/integration.md).

## Author another component

Follow the [authoring guide](docs/authoring.md). Every component must implement the SDK and declare its public surface, schemas, resources, tokens, and dependencies in `component.manifest.json`. The pipeline rejects contract drift, missing handlers, unsafe resources, and unsupported targets. Frameworks may be private implementation details if they satisfy the same contract.

The package layers are `contract-schemas`, `component-sdk`, `runtime-bridge`, `adapter-schema`, target profiles, and `build-tools`. Component source stays shared across ODC and O11. Gantt/timeline and additional catalog components belong in subsequent OpenSpec changes.

## Release and support evidence

```powershell
npm run release -- 2.0.0
```

The release command runs all verification before registering an immutable internal version in `releases/catalog.json`. It does not publish a package or change any OutSystems tenant. Release and compatibility rules are in [distribution](docs/distribution.md) and [releasing](docs/releasing.md).

- `generated`: packaging and static validation passed.
- `browser-verified`: all repository policy gates passed for the exact browser artifacts.
- `OutSystems-verified`: separately recorded smoke tests passed in a named platform version, asset, environment, and application lane.

This bootstrap supports generating ODC and O11 Reactive/Mobile assets. Tenant and mobile webview verification remain separate evidence requirements. O11 Traditional Web is excluded. Mentor-ready recipes are generated, but importing assets, creating native Library Blocks, and publishing require the intended tenant context and authorization.

Project packages are private and marked `UNLICENSED`; no public license is granted by this repository. Third-party runtime inventory and notices are generated with every distribution.
