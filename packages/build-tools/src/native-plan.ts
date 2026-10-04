import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson } from '@osai/contract-schemas';
import type { ComponentManifest, JsonSchema, Target } from '@osai/contract-schemas';
import type { ResourceMetadata } from '@osai/adapter-schema';
import { inspectRelease } from './build.js';
import { checksum, payloadChecksums, writeJson } from './release.js';

export interface NativePlan {
  schemaVersion: '2.0';
  componentId: string;
  version: string;
  target: Target;
  artifactChecksums: Record<string, string>;
  artifactDigest: string;
  resources: ResourceMetadata;
  block: {
    name: string;
    inputs: {
      name: string;
      nativeType: string;
      encoding: string;
      required: boolean;
      schema: JsonSchema;
      default?: unknown;
    }[];
    events: {
      name: string;
      parameters: { name: 'PayloadJson'; nativeType: 'Text'; schema: JsonSchema }[];
    }[];
  };
  actions: {
    name: string;
    call: string;
    inputs: string[];
    outputs: string[];
    arguments?: JsonSchema;
    result?: JsonSchema;
  }[];
  lifecycle: { ready: string[]; parametersChanged: string[]; render: string[]; destroy: string[] };
  errors: string[];
  authority: {
    mode: 'local-preparation';
    authentication: false;
    nativeMutation: false;
    publication: false;
    deployment: false;
  };
  checkpoint: { odc: 'not-executed'; o11: 'not-executed'; mobileWebview: 'not-executed' };
  planDigest: string;
}
function nativeType(schema: JsonSchema): { nativeType: string; encoding: string } {
  if (schema.type === 'string') return { nativeType: 'Text', encoding: 'value' };
  if (schema.type === 'boolean') return { nativeType: 'Boolean', encoding: 'value' };
  if (schema.type === 'integer') return { nativeType: 'Long Integer', encoding: 'value' };
  if (schema.type === 'number') return { nativeType: 'Decimal', encoding: 'value' };
  return { nativeType: 'Text', encoding: 'JSON including explicit null' };
}
export async function generateNativePlan(releaseRoot: string, target: Target): Promise<NativePlan> {
  await inspectRelease(releaseRoot);
  const artifactChecksums = await payloadChecksums(releaseRoot);
  const manifest = JSON.parse(
    await readFile(join(releaseRoot, target, 'manifest.json'), 'utf8'),
  ) as ComponentManifest;
  const resources = JSON.parse(
    await readFile(join(releaseRoot, target, 'resources.json'), 'utf8'),
  ) as ResourceMetadata;
  if (
    !manifest.targets.includes(target) ||
    resources.schemaVersion !== '2.0' ||
    resources.registration.target !== target
  )
    throw new Error('Native handoff requires matching format-2 resources.');
  const block = {
    name: manifest.componentId.replace(/(^|-)([a-z])/g, (_, __, letter: string) =>
      letter.toUpperCase(),
    ),
    inputs: Object.entries(manifest.properties)
      .filter(([, property]) => property.access !== 'read')
      .map(([name, property]) => ({
        name,
        ...nativeType(property.schema),
        required: property.required,
        schema: property.schema,
        ...('default' in property ? { default: property.default } : {}),
      })),
    events: Object.entries(manifest.events).map(([name, event]) => ({
      name,
      parameters: [
        { name: 'PayloadJson' as const, nativeType: 'Text' as const, schema: event.schema },
      ],
    })),
  };
  const actions = [
    {
      name: 'RegisterResources',
      call: 'registerResources(componentId, registrationJson)',
      inputs: ['RegistrationJson:Text'],
      outputs: ['EnvelopeJson:Text'],
    },
    {
      name: 'Create',
      call: 'create(componentId, instanceId, containerId, configJson)',
      inputs: ['InstanceId:Text', 'ContainerId:Text', 'ConfigJson:Text'],
      outputs: ['EnvelopeJson:Text'],
    },
    {
      name: 'Update',
      call: 'update(instanceId, configJson)',
      inputs: ['InstanceId:Text', 'ConfigJson:Text'],
      outputs: ['EnvelopeJson:Text'],
    },
    ...Object.entries(manifest.commands).map(([name, command]) => ({
      name: `Command_${name}`,
      call: `invoke(instanceId, ${JSON.stringify(name)}, argumentsJson)`,
      inputs: ['InstanceId:Text', 'ArgumentsJson:Text'],
      outputs: ['EnvelopeJson:Text'],
      arguments: command.arguments,
      result: command.result,
    })),
    {
      name: 'RegisterCallback',
      call: 'registerCallback(instanceId, eventName, callback)',
      inputs: ['InstanceId:Text', 'EventName:Text', 'ForwardToBlockEvent:ClientAction'],
      outputs: ['EnvelopeJson:Text', 'SubscriptionId:Text'],
    },
    {
      name: 'UnregisterCallback',
      call: 'unregisterCallback(instanceId, subscriptionId)',
      inputs: ['InstanceId:Text', 'SubscriptionId:Text'],
      outputs: ['EnvelopeJson:Text'],
    },
    {
      name: 'Dispose',
      call: 'dispose(instanceId)',
      inputs: ['InstanceId:Text'],
      outputs: ['EnvelopeJson:Text'],
    },
  ];
  const unsigned: Omit<NativePlan, 'planDigest'> = {
    schemaVersion: '2.0',
    componentId: manifest.componentId,
    version: manifest.version,
    target,
    artifactChecksums,
    artifactDigest: checksum(canonicalJson(artifactChecksums)),
    resources,
    block,
    actions,
    lifecycle: {
      ready: [
        'Resolve imported static URLs and verify complete logical mappings.',
        'Load dependencies and principal assets in resources.loadOrder.',
        'RegisterResources; parse envelope and stop on failure.',
        'Create with unique per-Block-lifetime instance ID and stable existing container ID.',
        'Register every declared event callback; retain subscription IDs; forward PayloadJson.',
      ],
      parametersChanged: [
        'Serialize the complete configuration, preserving explicit null and declared defaults.',
        'Update and check envelope.ok/code.',
        'On recreation-required: explicitly Dispose, Create and resubscribe; retain prior state on other recoverable errors.',
      ],
      render: [
        'Compare last successfully committed configuration JSON.',
        'Skip unchanged input; otherwise follow Parameters Changed.',
      ],
      destroy: [
        'Unregister retained subscription IDs.',
        'Dispose even when the host container was detached; repeated disposal is safe.',
        'Clear local instance/subscription state.',
      ],
    },
    errors: [
      'invalid-json',
      'validation-error',
      'json-limit-exceeded',
      'event-queue-full',
      'resources-not-registered',
      'invalid-resource-mapping',
      'disallowed-resource-origin',
      'resources-in-use',
      'recreation-required',
      'operation-in-progress',
      'instance-faulted',
      'internal-error',
    ],
    authority: {
      mode: 'local-preparation',
      authentication: false,
      nativeMutation: false,
      publication: false,
      deployment: false,
    },
    checkpoint: { odc: 'not-executed', o11: 'not-executed', mobileWebview: 'not-executed' },
  };
  return { ...unsigned, planDigest: checksum(canonicalJson(unsigned)) };
}
export async function validateNativePlan(plan: NativePlan, releaseRoot: string): Promise<void> {
  const expected = await generateNativePlan(releaseRoot, plan.target);
  if (canonicalJson(plan) !== canonicalJson(expected))
    throw new Error('Native plan or bound release drift. Regenerate the detached plan.');
}
export async function saveNativePlans(root: string, releaseRoot: string): Promise<string[]> {
  const paths: string[] = [];
  for (const target of ['odc', 'o11-reactive'] as const) {
    const plan = await generateNativePlan(releaseRoot, target);
    const directory = join(root, '.build/native-plans', plan.componentId, plan.version);
    await mkdir(directory, { recursive: true });
    const path = join(directory, `${target}.json`);
    await writeJson(path, plan);
    paths.push(path);
  }
  return paths;
}
export interface InspectedNativeAsset {
  key: string;
  owner: string;
  fingerprint: string;
}
export interface InspectedNativeState {
  appKey: string;
  envKey: string;
  readBackComplete: boolean;
  partialFailure: boolean;
  assets: InspectedNativeAsset[];
}
export function reconciliation(
  plan: NativePlan,
  state: InspectedNativeState,
): {
  status: 'ready' | 'read-back-required';
  operations: {
    key: string;
    operation: 'create' | 'update' | 'unchanged' | 'conflict';
    fingerprint: string;
  }[];
} {
  if (!state.appKey || !state.envKey)
    throw new Error('Resolve inspected app and environment identities before reconciliation.');
  if (state.partialFailure || !state.readBackComplete)
    return { status: 'read-back-required', operations: [] };
  if (new Set(state.assets.map((asset) => asset.key)).size !== state.assets.length)
    throw new Error('Ambiguous inspected native state.');
  const desired = [
    ...plan.resources.assets
      .filter((asset) => !asset.origin)
      .map((asset) => ({ key: `resource:${asset.id}`, fingerprint: asset.integrity })),
    {
      key: `block:${plan.block.name}`,
      fingerprint: checksum(canonicalJson({ block: plan.block, lifecycle: plan.lifecycle })),
    },
    ...plan.actions.map((action) => ({
      key: `action:${action.name}`,
      fingerprint: checksum(canonicalJson(action)),
    })),
  ];
  return {
    status: 'ready',
    operations: desired.map((asset) => {
      const prior = state.assets.find((item) => item.key === asset.key);
      return {
        ...asset,
        operation: !prior
          ? 'create'
          : prior.owner !== `osai:${plan.componentId}`
            ? 'conflict'
            : prior.fingerprint === asset.fingerprint
              ? 'unchanged'
              : 'update',
      };
    }),
  };
}
export interface IntegrationCapabilities {
  contextInspection: boolean;
  mentorEditing: boolean;
  staticAssetIngestion: boolean;
  studioAvailable: boolean;
}
export interface HumanAuthority {
  source: 'human';
  nativeMutation: boolean;
  publication: boolean;
  deployment: boolean;
}
export function integrationProtocol(
  capabilities: IntegrationCapabilities,
  identities: { appKey?: string; envKey?: string },
  authority?: HumanAuthority,
) {
  if (!identities.appKey || !identities.envKey)
    return {
      status: 'needs-identities',
      next: 'Resolve app/environment with live tools or supplied inspected identities; never invent keys.',
      tenantCalls: [],
    };
  if (!capabilities.contextInspection)
    return {
      status: 'manual-inspection',
      next: 'Inspect in Studio and supply a read-back snapshot.',
      tenantCalls: [],
    };
  if (!capabilities.mentorEditing || !capabilities.staticAssetIngestion)
    return {
      status: capabilities.studioAvailable ? 'studio-handoff' : 'manual-handoff',
      next: 'Import browser assets with Studio or an available authorized static-asset facility. Server external-library upload accepts .NET libraries and must not be used for UI assets.',
      tenantCalls: [],
    };
  if (authority?.source !== 'human' || !authority.nativeMutation)
    return {
      status: 'needs-native-authority',
      next: 'Review the concrete plan and obtain explicit native mutation authority.',
      tenantCalls: [],
    };
  return {
    status: 'ready-for-live-protocol',
    next: 'Authenticate lazily, inspect current state, reconcile, use actual exposed editing tools, and read back before retrying any partial failure.',
    tenantCalls: [],
    publicationAuthorized: authority.publication === true,
    deploymentAuthorized: authority.deployment === true,
  };
}
export function redactIntegrationEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactIntegrationEvidence);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /(token|secret|password|authorization|callback_url|cookie|credential)/i.test(key)
          ? '[redacted]'
          : redactIntegrationEvidence(item),
      ]),
    );
  if (typeof value === 'string')
    return value
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
      .replace(/([?&](?:code|state|token|secret|key|password)=)[^&#\s]+/gi, '$1[redacted]');
  return value;
}
