import { canonicalJson, validateJsonSchema, validateManifest } from '@osai/contract-schemas';
import type { ComponentManifest, Diagnostic, JsonSchema, Target } from '@osai/contract-schemas';
import type { ReleaseResources, RuntimeDependency } from '@osai/contract-schemas';
import { validateReleaseResources } from '@osai/contract-schemas';
export * from './evidence.js';

export interface Adapter {
  schemaVersion: '1.0' | '2.0';
  resources?: ResourceMetadata;
  componentId: string;
  version: string;
  contractVersion: '1.0';
  target: Target;
  namespace: string;
  assets: { script: string; style: string };
  publicContract: Pick<ComponentManifest, 'properties' | 'commands' | 'events' | 'themeTokens'>;
  serialization: {
    input: 'json-string';
    output: 'json-envelope-string';
    execution: 'sync';
    update: 'full-replacement';
  };
  lifecycle: {
    ready: 'create';
    parametersChanged: 'update';
    render: 'guarded-update';
    destroy: 'dispose';
    recreation: 'explicit-dispose-create';
  };
}

export interface ResourceMetadata {
  schemaVersion: '2.0';
  registration: ReleaseResources;
  assets: {
    id: string;
    path: string;
    type: string;
    usage: string;
    integrity: string;
    bytes: number;
    gzipBytes: number;
    origin?: string;
  }[];
  dependencies: RuntimeDependency[];
  licenses: { name: string; version: string; license: string }[];
  loadOrder: string[];
  csp: Record<string, unknown>;
  nativeMapping: string;
}

export function resourceLoadOrder(manifest: ComponentManifest): string[] {
  return [
    ...manifest.dependencies
      .filter((item) => !item.bundled)
      .sort((a, b) => a.loadOrder! - b.loadOrder!)
      .map((item) => `external:${item.name}`),
    ...manifest.assets
      .filter((item) => item.type === 'script' || item.type === 'style')
      .map((item) => item.path),
    `${manifest.componentId}.css`,
    `${manifest.componentId}.js`,
    'registerResources',
    'create',
  ];
}

function completeResourceMetadata(
  resources: ResourceMetadata,
  manifest: ComponentManifest,
  target: Target,
): boolean {
  const expected = [
    { path: `${manifest.componentId}.js`, type: 'script', usage: 'principal', origin: undefined },
    { path: `${manifest.componentId}.css`, type: 'style', usage: 'principal', origin: undefined },
    ...manifest.assets.map((asset) => ({
      ...asset,
      usage: asset.origin ? 'external' : 'auxiliary',
    })),
  ];
  return (
    resources.schemaVersion === '2.0' &&
    validateReleaseResources(resources.registration, manifest) &&
    resources.registration.target === target &&
    Array.isArray(resources.assets) &&
    resources.assets.length === expected.length &&
    resources.assets.every((asset, index) => {
      const match = expected[index]!;
      const registration = resources.registration.assets.find((item) => item.id === asset.id);
      return (
        asset.id === match.path &&
        asset.path === match.path &&
        asset.type === match.type &&
        asset.usage === match.usage &&
        asset.origin === match.origin &&
        /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/.test(asset.integrity) &&
        (!registration || registration.integrity === asset.integrity) &&
        Number.isSafeInteger(asset.bytes) &&
        asset.bytes >= 0 &&
        Number.isSafeInteger(asset.gzipBytes) &&
        asset.gzipBytes >= 0
      );
    }) &&
    canonicalJson(resources.loadOrder) === canonicalJson(resourceLoadOrder(manifest)) &&
    canonicalJson(resources.dependencies) ===
      canonicalJson(
        manifest.dependencies
          .filter((item) => !item.bundled)
          .sort((a, b) => a.loadOrder! - b.loadOrder!),
      ) &&
    Array.isArray(resources.licenses) &&
    resources.licenses.length > 0 &&
    resources.licenses.every((license) => license.name && license.version && license.license) &&
    typeof resources.nativeMapping === 'string' &&
    resources.nativeMapping.length > 0
  );
}

export const adapterSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'componentId',
    'version',
    'contractVersion',
    'target',
    'namespace',
    'assets',
    'publicContract',
    'serialization',
    'lifecycle',
  ],
  properties: {
    schemaVersion: { const: '1.0' },
    componentId: { type: 'string', minLength: 1 },
    version: { type: 'string' },
    contractVersion: { const: '1.0' },
    target: { enum: ['odc', 'o11-reactive'] },
    namespace: {
      type: 'string',
      pattern: '^[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)+$',
    },
    assets: {
      type: 'object',
      additionalProperties: false,
      required: ['script', 'style'],
      properties: { script: { type: 'string' }, style: { type: 'string' } },
    },
    publicContract: {
      type: 'object',
      additionalProperties: false,
      required: ['properties', 'commands', 'events', 'themeTokens'],
      properties: {
        properties: { type: 'object' },
        commands: { type: 'object' },
        events: { type: 'object' },
        themeTokens: { type: 'object' },
      },
    },
    serialization: {
      const: {
        input: 'json-string',
        output: 'json-envelope-string',
        execution: 'sync',
        update: 'full-replacement',
      },
    },
    lifecycle: {
      const: {
        ready: 'create',
        parametersChanged: 'update',
        render: 'guarded-update',
        destroy: 'dispose',
        recreation: 'explicit-dispose-create',
      },
    },
  },
};

export function generateAdapter(
  manifest: ComponentManifest,
  target: Target,
  namespace: string,
  resources?: ResourceMetadata,
): Adapter {
  const validation = validateManifest(manifest);
  if (!validation.ok || !validation.value)
    throw new Error('A valid normalized component manifest is required.');
  if (!manifest.targets.includes(target))
    throw new Error(`Unsupported component target: ${target}`);
  if (
    !/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/.test(namespace) ||
    namespace.split('.').some((part) => ['__proto__', 'prototype', 'constructor'].includes(part))
  )
    throw new Error('Invalid bridge namespace.');
  const { properties, commands, events, themeTokens } = validation.value;
  if (resources && !completeResourceMetadata(resources, manifest, target))
    throw new Error('Incomplete resource metadata.');
  return {
    schemaVersion: resources ? '2.0' : '1.0',
    ...(resources ? { resources: JSON.parse(canonicalJson(resources)) as ResourceMetadata } : {}),
    componentId: manifest.componentId,
    version: manifest.version,
    contractVersion: manifest.contractVersion,
    target,
    namespace,
    assets: { script: `${manifest.componentId}.js`, style: `${manifest.componentId}.css` },
    publicContract: { properties, commands, events, themeTokens },
    serialization: {
      input: 'json-string',
      output: 'json-envelope-string',
      execution: 'sync',
      update: 'full-replacement',
    },
    lifecycle: {
      ready: 'create',
      parametersChanged: 'update',
      render: 'guarded-update',
      destroy: 'dispose',
      recreation: 'explicit-dispose-create',
    },
  };
}

export function validateAdapter(
  value: unknown,
  manifest: ComponentManifest,
  target: Target,
  namespace: string,
  resources?: ResourceMetadata,
): Diagnostic[] {
  const issues = resources ? [] : validateJsonSchema(adapterSchema, value);
  if (issues.length) return issues;
  let expected: Adapter;
  try {
    expected = generateAdapter(manifest, target, namespace, resources);
  } catch {
    return [
      {
        code: 'invalid-adapter-source',
        path: '/target',
        message: 'A valid normalized manifest, supported target, and safe namespace are required.',
      },
    ];
  }
  return canonicalJson(value) === canonicalJson(expected)
    ? []
    : [
        {
          code: 'adapter-contract-drift',
          path: '/publicContract',
          message: 'Adapter differs from the normalized source contract or target mapping.',
        },
      ];
}

export function generateIntegrationGuide(adapter: Adapter): string {
  const api = adapter.namespace;
  if (adapter.resources) {
    const { resources, ...legacy } = adapter;
    const mappings = Object.fromEntries(
      resources.registration.assets.map((asset) => [
        asset.id,
        {
          url: asset.origin
            ? `${asset.origin}/${asset.id}`
            : `/YOUR-STATIC-RESOURCE-ROOT/${asset.id}`,
          integrity: asset.integrity,
        },
      ]),
    );
    return (
      generateIntegrationGuide({ ...legacy, schemaVersion: '1.0' }) +
      `\n## Resource registration (format 2.0)\n\nBefore On Ready/create, import every asset listed in resources.json and satisfy its loadOrder, integrity, licenses and CSP declarations. External dependencies must be pinned and provided by the host; their remote bytes are not locally scanned. Replace placeholder URLs with inspected host resource URLs. Preserve directory relationships for CSS-relative resources. No screen-route inference is used.\n\n\x60\x60\x60javascript\nconst registration = ${JSON.stringify({ schemaVersion: '2.0', releaseId: resources.registration.releaseId, mappings }, null, 2)};\nconst result = JSON.parse(${api}.registerResources(${JSON.stringify(adapter.componentId)}, JSON.stringify(registration)));\nif (!result.ok) throw new Error(result.code);\n\x60\x60\x60\n\nDo not remap resources while instances are live. Branch on resources-not-registered, invalid-resource-mapping, disallowed-resource-origin and resources-in-use. registerResources validates supplied identities and URLs; host loading/SRI and the certified CSP must enforce the served bytes. JavaScript workers have no native SRI constructor: the host must serve the exact immutable checksummed worker bytes.\n`
    );
  }
  return `# ${adapter.componentId}: ${adapter.target}\n\nVersion ${adapter.version}; contract ${adapter.contractVersion}. Status is recorded separately in compatibility evidence.\n\n## Import assets\n\nImport \`${adapter.assets.script}\` as a Required Script in the consuming Block and import \`${adapter.assets.style}\` as static CSS. Create an empty Container with a stable runtime DOM ID. Use a unique instance ID for each Block lifetime. Do not use an instance ID shared with an overlapping screen. The exposed API is \`window.${api}\`. The package is a browser asset distribution; Studio creates the native Library Block.\n\n## Block lifecycle\n\nOn Ready, after the container exists, call \`create(${JSON.stringify(adapter.componentId)}, instanceId, containerId, configJson)\`. Parse the response JSON and continue only when \`ok\` is true. Register each event with \`registerCallback(instanceId, eventName, callback)\`; keep the returned subscription ID. The callback receives a JSON envelope whose value contains \`instanceId\`, \`eventName\`, and \`payload\`. Forward the payload to the matching Block Event through the generated Client Action.\n\nOn Parameters Changed or guarded On Render, serialize the complete next configuration and call \`update(instanceId, configJson)\`. Deduplicate unchanged configuration at the adapter. Omitted optional fields reset to defaults. On \`recreation-required\`, explicitly dispose, create, and register callbacks again; never silently discard state on another error.\n\nOn Destroy call \`dispose(instanceId)\`, even if the DOM has already disappeared. Repeated disposal succeeds. Callback unregistration uses \`unregisterCallback(instanceId, subscriptionId)\`.\n\n## Client Actions and events\n\nCommands: ${Object.keys(
    adapter.publicContract.commands,
  )
    .map((name) => `\`${name}\``)
    .join(
      ', ',
    )}. Invoke using \`invoke(instanceId, commandName, argumentsJson)\`. All v1 commands return a synchronous JSON envelope. Host business logic stays in Client Actions.\n\nEvents: ${Object.keys(
    adapter.publicContract.events,
  )
    .map((name) => `\`${name}\``)
    .join(
      ', ',
    )}. Event delivery is asynchronous and ordered per instance; unsubscribe and disposal cancel queued delivery. Exceptions in a callback are reported without preventing other callbacks.\n\n## Data and errors\n\nMap primitive input values through the configuration object; map complex structures/lists to JSON following \`schemas/config.schema.json\`. Event and command payload schemas are in \`schemas/\`. Branch on envelope \`code\`, not message text. Common errors include invalid-json, validation-error, unknown-instance, duplicate-instance, recreation-required, unknown-command, and internal-error.\n\n## Host verification\n\nImport the exact checksummed files, then test create, full update, event forwarding, command invocation, repeated renders, overlapping navigation, and disposal. Record the asset/environment identity, platform version, artifact hashes, suite version, and exact results. Browser evidence alone never grants OutSystems-verified status. O11 Traditional Web is excluded. Mobile webview verification must be recorded independently from desktop web.\n`;
}

export const recipeSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'target', 'componentId', 'requiredInputs', 'steps', 'publish'],
  properties: {
    schemaVersion: { const: '1.0' },
    target: { enum: ['odc', 'o11-reactive'] },
    componentId: { type: 'string' },
    requiredInputs: { const: ['assetKey', 'environmentKey'] },
    steps: { type: 'array', minItems: 4, items: { type: 'string' } },
    publish: { const: false },
  },
};

export function generateMentorRecipe(adapter: Adapter) {
  return {
    schemaVersion: '1.0',
    target: adapter.target,
    componentId: adapter.componentId,
    requiredInputs: ['assetKey', 'environmentKey'],
    publish: false,
    steps: [
      'Resolve the user-supplied asset and environment; never invent opaque identifiers.',
      `Import ${adapter.assets.script} and ${adapter.assets.style} through Studio or an authorized asset-transfer tool.`,
      'Use adapter.json and schemas to create a Library Block, inputs, events, and synchronous Client Actions.',
      'Wire Ready, Parameters Changed/guarded Render, and Destroy exactly as integration.md describes.',
      'Run the documented smoke suite and capture target-specific evidence.',
      'Publishing is a separate user-authorized operation.',
    ],
  };
}
