# Distribution and release workflow

The pipeline builds one component revision into separate `odc` and `o11-reactive` packages. Their public contract is identical; each has independent target metadata and compatibility evidence. JavaScript and CSS may be byte-identical. OS11 Traditional Web and native plugins are excluded.

## Commands

Run commands from the repository root after the pinned `npm ci` install:

```sh
npm run validate
npm run build
npm run inspect
npm run reproduce
npm run verify
npm run release -- 1.0.0
```

`validate` checks the default component selected in `build.config.json`, including resolved schemas, SDK metadata parity, scoped CSS, and declared resources. To inspect another conforming authoring fixture, pass its manifest path: `npm run validate -- tests/fixtures/minimal/component.manifest.json` when that fixture exists in your checkout.

`build` generates assets, metadata, and fresh `generated` evidence records. `inspect` checks the generated file inventory, content hashes, required files and adapter parity; a specific release directory can be passed after `--`. `reproduce` independently installs and builds two fresh source workspaces and compares unsigned payload hashes. `verify` runs the complete acceptance workflow and creates browser evidence only after all mandatory gates pass. `release -- <version>` performs verification and appends the local catalog only after success; the requested version must agree with the component manifest. These commands do not create or publish OutSystems assets.

## Output anatomy

```text
dist/command-palette/1.0.0/
  odc/
    command-palette.js
    command-palette.css
    manifest.json
    adapter.json
    target.json
    schemas/
    integration.md
    mentor-recipe.json
    csp.json
    licenses.txt
  o11-reactive/
    (same file classes, independently labelled target)
  shared/
    component.mjs
    types/index.d.ts
    dependencies.json
    sbom.spdx.json
    licenses.txt
    build-inputs.json
    checksums.sha256
    release.json
  evidence/
    (verification reports produced by the gate runner)
```

The target scripts are classic, self-contained browser globals exposing the configured namespace, initially `window.OSAI.Components.v1`. They do not require a page module loader, dynamic imports, shared framework globals or code splitting. `shared/component.mjs` is the ESM authoring/development entry point. The JavaScript output baseline is ES2017; browser APIs are separately declared in the component capability manifest and target profile.

`manifest.json` contains resolved public schemas; `adapter.json` maps that contract to the target lifecycle. The integration guide and Mentor recipe are generated from the same metadata. Required Scripts load the `.js` asset; the consuming Library/theme must also include the `.css` asset. File hashes bind release evidence to the actual payload.

## Target capabilities

Target profiles live in `packages/targets/odc` and `packages/targets/o11-reactive`. Keep any platform divergence there as an explicit build-time capability or override. Avoid runtime platform detection in component code. A shared source implementation and equal public-contract comparison prevent accidental target drift. A future target-specific wrapper requires browser tests and recorded platform evidence before it can change a compatibility claim.

The namespace and runtime target baseline are build configuration, not component implementation details. Changing them changes distribution bytes and must follow normal release checks. The internal `OSAI` namespace is not a finalized external product name.

Profiles list the browser API capability baseline; new APIs require an explicit profile change and corresponding tests. `build.config.json` optionally accepts `targetOverrides` keyed by a declared target, each with a nonempty `rationale` and a `defines` map. Only `OSAI_BUILD_*` constants with string, finite number, or boolean values are permitted. The bundler replaces these constants separately per target and records the override in `target.json`; the public manifest stays shared. The development ESM uses the first configured target's constants. The bootstrap has no overrides because no measured target divergence has been established.

## Dependencies, styles and CSP

The command palette uses only project runtime packages. A component that adds a third-party runtime dependency must declare its exact version, license and bundling policy. The build inventories the bundled dependency graph against the lockfile, emits SPDX and notices, and rejects incomplete or disallowed entries. External dependencies additionally require their expected global, origin, load order, integrity and CSP declarations. Development tooling is not shipped to the OutSystems browser.

An exact import matching an external dependency name is replaced with a checked reference to its declared host global. Subpath imports require their own declarations; no runtime `require` or module loader is emitted. The host must load the integrity-pinned provider first. Local assets retain their manifest-relative paths in each target package (use `assets/` by convention); paths colliding with generated scripts or metadata are rejected.

Production scans reject dynamic evaluation, inline handlers, unresolved imports, accidental Node APIs, undeclared global/network behavior and undeclared CSS resource origins. `csp.json` records required resource categories and origins. The default palette uses same-origin script and style assets with no network requests, remote fonts or images. Apply the consumer's actual CSP in the platform smoke test; a browser harness cannot prove a tenant-specific policy.

Public CSS tokens belong to the component contract. Ordinary selectors are rooted in the SDK's owned container; portals, global styles, fonts and keyframes require explicit declarations. Consumers should override public tokens on their Block host instead of depending on internal selectors.

## Immutable releases and evidence

Unsigned payload files use deterministic content, paths and ordering. Wall-clock timing, verification reports, timestamps and future attestations remain separate from reproducible content. Rebuilding the same registered version with different payload bytes fails registration. A removed or incompatible existing contract member, new required property, removed target or changed contract version requires a major version increase; release versions must advance.

The local catalog is append-only by the release command. Verification failure leaves it unchanged. Generated files and local reports are ignored build products; commit the source, schemas, lockfile and approved visual baselines that reproduce them.

Compatibility status has three levels. `generated` means assets exist. `browser-verified` requires every mandatory gate and the pinned Chromium, Firefox and WebKit suite for the target. `OutSystems-verified` additionally requires a named target platform version, asset/environment identity, exact artifact checksums and passing real host smoke tests. Desktop browser results do not establish mobile-webview behavior.

`release-policy.json` is the versioned source for gate thresholds. Reports include its version, measured values and thresholds, so failures are actionable. Current budgets are 60 KiB gzip JavaScript including the bridge and 12 KiB gzip CSS per command-palette target, with zero mandatory check failures, zero automated accessibility violations, and at least 100 lifecycle cycles ending with zero retained managed resources. Visual baselines are reviewed input; updating them intentionally is distinct from proving an unchanged baseline passes.
