# Authoring a component

## Hardening migration

The hardening change introduces a breaking **authoring** contract: component-local generated bindings distinguish writable host inputs from deeply read-only normalized configuration and bind every command and event to its schema. Regenerate bindings before compilation and check for drift in CI. Generic JSON casts are not a migration strategy. Runtime validation remains required for numeric bounds, patterns and other constraints not expressible in TypeScript.

Certification descriptors and capability profiles start at format `1.0`, independently of the existing manifest and browser bridge contract `1.0`. Each certifiable component must supply executable public-member scenarios and select a supported profile. Mandatory shared scenarios cannot be disabled. Unknown descriptor/profile versions fail closed. Profile limits must be finite and reviewed before qualification; candidate measurements cannot set their own passing thresholds.

Existing browser host signatures stay supported: `create(componentId, instanceId, hostId, configurationJson)`, `update(instanceId, configurationJson)`, `invoke(instanceId, commandName, argumentsJson)`, callback registration/unregistration, inspection and `dispose(instanceId)`. Commands remain synchronous and JSON-based. New internal managed operations report completion through declared events. See [format and release migration](distribution.md#hardening-format-migration).

Start from `tests/fixtures/minimal`, which contains a complete small component, manifest, referenced schema, and scoped stylesheet. The first production example is `components/command-palette`. A component must implement the SDK and describe its complete public surface; unrelated TypeScript projects are rejected at validation.

Run `npm ci`, then `npm run validate` for production component validation. To validate the complete starter example directly, run `npm run validate -- tests/fixtures/minimal/component.manifest.json`. Run `npx vitest run packages/contract-schemas/src/contract.test.ts packages/component-sdk/src/conformance.test.ts` to check the minimal fixture and the negative contract fixtures. `npm run typecheck` includes SDK compile-time assertions that asynchronous commands, DOM values, and arbitrary render functions are not accepted. `npm run verify` validates, packages, and exercises the production component through all local release gates.

## Manifest and schemas

Each component supplies `component.manifest.json` with `schemaVersion: "1.0"`, a lowercase kebab-case `componentId`, semantic `version`, `contractVersion: "1.0"`, the supported `targets`, a TypeScript `entry`, and nonempty `styles`. Declare `properties`, `commands`, `events`, `themeTokens`, `capabilities`, `dependencies`, and `assets`, including empty collections. These declarations are the source for packaging, adapter metadata, and generated TypeScript configuration, command and event types.

A property contains `schema`, `required`, `access` (`read`, `write`, or `readwrite`), and `updateMode` (`live` or `recreate`). Optional properties require a JSON `default`. Every update replaces the full configuration: omitted optional properties regain defaults, required omissions fail, and explicit null requires a nullable schema. Read-only properties cannot be set by the host. Changing a recreate property requires the adapter to dispose and recreate explicitly.

Each command declares `arguments`, `result`, and `execution: "sync"`. Arguments and results are JSON values; use a schema for an empty object when a command takes no input. Return null explicitly for an empty result if the schema specifies null. Each event declares its payload `schema`. Declaring an event does not authorize arbitrary payloads: runtime emission is validated.

Schemas can be embedded or referenced using local JSON files and JSON Pointer fragments, such as `schemas/config.json#/properties/label`. References resolve relative to their containing document and cannot escape the component directory, access the network, or form cycles. A `$ref` object must contain only `$ref`. The Node authoring loader resolves references into the normalized manifest before browser code is built.

The CSP-safe runtime interpreter supports JSON types and unions, properties, required, additionalProperties, items, enum, const, anyOf, oneOf, allOf, not, string lengths and pattern, numeric bounds and multipleOf, array lengths and uniqueItems, and object property counts. Annotation keywords `$schema`, `$id`, `$defs`, `definitions`, title, description, and default are accepted. Unsupported keywords fail explicitly; the interpreter never compiles schema strings into JavaScript. Avoid arbitrary regular expressions supplied by end users: patterns are reviewed component source.

## SDK implementation

Run `npm run bindings` after editing a manifest or schema. It generates each component's `src/generated.ts` using the normalized contract, including a contract digest. `npm run bindings:check` performs a read-only drift check; `npm run typecheck` runs that check before compiling implementations. Changing a runtime-only schema constraint also invalidates the digest. Never hand-edit generated bindings.

Use `HostInput` for caller input, `Configuration` for the complete deeply read-only normalized values, and `Bindings` to specialize the SDK definition, context and controller. A property's `required` flag determines host requiredness; optional defaults are present in normalized configuration; read-only properties are excluded from host input. Nested optional members stay optional unless the schema itself requires them. Nullability, unions and nested structures are preserved.

The minimal fixture supplies the normalized manifest used by this runnable example. Its generated command requires an empty object and returns text; its event requires a text label. The documentation compiler checks this example without member-typing bypass casts.

<!-- executable: typed-minimal -->

```typescript
import { defineComponent, implementationContractFromManifest } from '@osai/component-sdk';
import { manifest } from '../../../tests/fixtures/minimal/src/index.js';
import type { Bindings } from '../../../tests/fixtures/minimal/src/generated.js';

export const example = defineComponent<Bindings>({
  manifest,
  contract: implementationContractFromManifest(manifest),
  create(context, initial) {
    let configuration = initial;
    context.root.textContent = configuration.label;
    return {
      prepareUpdate(next) {
        const previous = configuration;
        return {
          commit() {
            configuration = next;
            context.root.textContent = configuration.label;
          },
          rollback() {
            configuration = previous;
            context.root.textContent = configuration.label;
          },
        };
      },
      commands: {
        read() {
          context.emit('read', { label: configuration.label });
          return configuration.label;
        },
      },
      dispose() {
        context.root.replaceChildren();
      },
    };
  },
});
```

In a component's own entry, import its normalized manifest and `./generated.js`. The paths above are relative to the documentation compiler's temporary fixture. TypeScript cannot prove JSON numeric finiteness, numeric ranges, regex patterns, distinct array values, one-of exclusivity or cross-field predicates. Runtime schema/semantic checks remain authoritative. A mixed object with typed additional properties may be widened to a JSON index signature because TypeScript requires an index signature to admit its named members; runtime validation still enforces the declared additional-property schema.

Export a named `componentDefinition` created with `defineComponent`, containing the normalized manifest, its `contract` member metadata, optional cross-field `validateConfig`, and synchronous `create(context, configuration)`. The manifest-to-implementation metadata check compares properties, command arguments/results/execution, and events in both directions. `implementationContractFromManifest` provides baseline metadata; behavior tests and runtime result/event checks verify the implementation behind those declarations. `generateTypeDeclarations` in `@osai/contract-schemas/authoring` produces the public TypeScript declarations.

The runtime provides an actual host element, an owned child root, an instance ID, event emission, diagnostics, shortcut registration, and a managed resource scope. Render only inside `context.root`, which has the `data-osai-component` marker. Pass host text to `textContent` or text nodes. Use the managed scope for listeners, timeouts, intervals, animation frames, observers, workers, portals, background locks, and additional disposers.

Return a controller with `prepareUpdate(nextConfiguration)`, a `commands` map of named synchronous handlers, and `dispose()`. The runtime checks that actual handler keys exactly match the declared commands, then validates each handler's arguments and result. Preparation must not change live state. Return a transaction whose commit applies the update and whose rollback restores all changed view and internal state if commit fails. Keep the previous complete configuration until commit succeeds. Commands return synchronous JSON data: Promises, thenables, functions, DOM nodes, class instances, NaN, Infinity, sparse arrays, and cyclic objects cannot cross the public boundary. Disposal must work while open, after host removal, and when repeated; no callback may run afterward.

Use `validateConfig` for constraints beyond the supported schema subset, such as unique command IDs, and return stable diagnostics instead of throwing. The bridge calls it before create or update changes state.

## Capabilities and styles

Declare browser APIs, HTTPS network origins, workers, portals, global selectors, keyframes, and font faces. A portal declaration names its selector, instance ownership, accessibility treatment, and cleanup obligation. `validateObservedCapabilities` compares static or instrumented observations against the manifest. Bundled dependencies declare exact resolved version and license. External dependencies additionally declare their global, origin, load order, integrity, and CSP source requirements. External assets likewise require declared origins and integrity.

Ordinary CSS selectors must begin with `[data-osai-component="<componentId>"]` or an explicitly declared portal selector. Each public custom property uses `--osai-<componentId>-*` and has an accepted-value schema plus a safe literal default. Consume it with a fallback, for example `color: var(--osai-minimal-color, #222222)`. Overrides applied to one host inherit only into that host's owned root. CSS validation rejects global selectors, undeclared tokens, font faces, keyframes, and global at-rules. The browser suite also verifies actual sibling style isolation and theme behavior.

## Diagnostics and behavioral evidence

Validation returns `{ok, value?, diagnostics}`. Each diagnostic contains a stable code, JSON Pointer-compatible path, and scrubbed message. For example, an invalid label default reports `invalid-type` at `/properties/label/default`; a missing implementation command reports `missing-implementation-member` at `/commands/read`. Aggregate diagnostics are ordered by path and code; parser stacks and input secrets are never included.

`runBehavioralConformance` in `@osai/component-sdk/conformance` accepts an instrumented driver and runs two concurrent instances through create, update, invoke and disposal. It checks sibling state and callback isolation, declared event schemas, command results, zero retained resources and no callbacks after disposal. Deliberately cross-talking, leaking, invalid-result and undeclared-event fixtures demonstrate that failures are detected. Production release acceptance additionally runs generated artifacts in the browser matrix, including accessibility and computed CSS isolation. Local results can establish browser verification; actual OutSystems verification requires separate tenant evidence.
