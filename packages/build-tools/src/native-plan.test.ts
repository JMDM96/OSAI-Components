import { beforeAll, expect, it } from 'vitest';
import { mkdtemp, cp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRelease } from './build.js';
import {
  generateNativePlan,
  validateNativePlan,
  reconciliation,
  integrationProtocol,
  integrationPreflight,
  redactIntegrationEvidence,
  saveNativePlans,
} from './native-plan.js';
import type { NativePlan } from './native-plan.js';
import { payloadChecksums } from './release.js';
let root: string;
let palette: string;
let resources: string;
let plan: NativePlan;
beforeAll(async () => {
  root = process.cwd();
  palette = (
    await buildRelease(root, { outputRoot: await mkdtemp(join(tmpdir(), 'osai-native-palette-')) })
  ).root;
  resources = (
    await buildRelease(root, {
      manifestFile: 'tests/fixtures/resources/component.manifest.json',
      outputRoot: await mkdtemp(join(tmpdir(), 'osai-native-resources-')),
    })
  ).root;
  plan = await generateNativePlan(resources, 'odc');
}, 30000);
it('generates complete detached plans for both components and both targets without changing checksums', async () => {
  for (const release of [palette, resources]) {
    const before = await payloadChecksums(release);
    for (const target of ['odc', 'o11-reactive'] as const) {
      const candidate = await generateNativePlan(release, target);
      await validateNativePlan(candidate, release);
      expect(candidate.artifactChecksums).toEqual(before);
      expect(
        candidate.resources.assets.every(
          (asset) => candidate.artifactChecksums[`${target}/${asset.path}`],
        ),
      ).toBe(true);
      expect(
        candidate.block.events.every((event) => event.parameters[0]!.name === 'PayloadJson'),
      ).toBe(true);
      expect(candidate.actions.map((action) => action.name)).toContain('RegisterResources');
      expect(candidate.lifecycle.destroy.join(' ')).toContain('Unregister');
      expect(candidate.checkpoint).toEqual({
        odc: 'not-executed',
        o11: 'not-executed',
        mobileWebview: 'not-executed',
      });
      expect(candidate.authority).toMatchObject({
        authentication: false,
        nativeMutation: false,
        publication: false,
        deployment: false,
      });
    }
    const outputRoot = await mkdtemp(join(tmpdir(), 'osai-native-detached-'));
    const paths = await saveNativePlans(outputRoot, release);
    expect(paths).toHaveLength(2);
    expect(await payloadChecksums(release)).toEqual(before);
    expect(paths.every((path) => !path.startsWith(release))).toBe(true);
  }
});
it('rejects plan edits and changed auxiliary bytes', async () => {
  await expect(validateNativePlan({ ...plan, version: '99.0.0' }, resources)).rejects.toThrow(
    'drift',
  );
  const altered = join(await mkdtemp(join(tmpdir(), 'osai-native-drift-')), 'payload');
  await cp(resources, altered, { recursive: true });
  await writeFile(join(altered, 'odc/workers/local.js'), 'changed');
  await expect(validateNativePlan(plan, altered)).rejects.toThrow('checksums');
});
it('reconciles create/update/unchanged/conflict and requires fresh read-back after partial failure', () => {
  const state = {
    appKey: 'inspected-app-fixture',
    envKey: 'inspected-environment-fixture',
    partialFailure: false,
    readBackComplete: true,
    assets: [],
  };
  const first = reconciliation(plan, state);
  expect(first.operations.every((operation) => operation.operation === 'create')).toBe(true);
  const assets = first.operations.map((operation) => ({
    key: operation.key,
    fingerprint: operation.fingerprint,
    owner: `osai:${plan.componentId}`,
  }));
  expect(
    reconciliation(plan, { ...state, assets }).operations.every(
      (operation) => operation.operation === 'unchanged',
    ),
  ).toBe(true);
  assets[0]!.fingerprint = 'old';
  assets[1]!.owner = 'user';
  const next = reconciliation(plan, { ...state, assets });
  expect(next.operations[0]!.operation).toBe('update');
  expect(next.operations[1]!.operation).toBe('conflict');
  expect(reconciliation(plan, { ...state, assets, partialFailure: true })).toEqual({
    status: 'read-back-required',
    operations: [],
  });
  expect(reconciliation(plan, { ...state, readBackComplete: false }).operations).toEqual([]);
  expect(() => reconciliation(plan, { ...state, envKey: '' })).toThrow('identities');
});
it('keeps local preparation separate from native mutation, publishing, and deployment authority', () => {
  const all = {
    officialSkillAvailable: true,
    officialMcpConnected: true,
    contextInspection: true,
    mentorEditing: true,
    staticAssetIngestion: true,
    studioAvailable: true,
  };
  expect(integrationProtocol({ ...all, officialSkillAvailable: false }, {}).status).toBe(
    'needs-official-skill',
  );
  expect(integrationProtocol({ ...all, officialMcpConnected: false }, {}).status).toBe(
    'needs-mcp-connection',
  );
  expect(
    integrationProtocol(
      { ...all, staticAssetIngestion: false },
      { appKey: 'fixture', envKey: 'fixture' },
    ).next,
  ).toContain('must not be used for UI assets');
  expect(
    integrationPreflight({
      packageValid: true,
      browserQualified: false,
      capabilities: all,
      identities: {},
      nativeSmokeExecuted: false,
    }),
  ).toMatchObject({
    certification: 'pending',
    identities: 'pending',
    nativeSmoke: 'not-executed',
    readyForNativePreparation: false,
    tenantCalls: [],
  });
  expect(
    integrationPreflight({
      packageValid: true,
      browserQualified: true,
      capabilities: { ...all, officialMcpConnected: false },
      identities: {},
      nativeSmokeExecuted: false,
    }),
  ).toMatchObject({
    certification: 'browser-verified',
    officialMcp: 'pending',
    readyForNativePreparation: false,
  });
  expect(integrationProtocol(all, {}).status).toBe('needs-identities');
  const identities = { appKey: 'inspected-app', envKey: 'inspected-environment' };
  expect(integrationProtocol({ ...all, contextInspection: false }, identities).status).toBe(
    'manual-inspection',
  );
  expect(integrationProtocol({ ...all, staticAssetIngestion: false }, identities).status).toBe(
    'studio-handoff',
  );
  expect(
    integrationProtocol({ ...all, mentorEditing: false, studioAvailable: false }, identities)
      .status,
  ).toBe('manual-handoff');
  expect(integrationProtocol(all, identities).status).toBe('needs-native-authority');
  const authorized = integrationProtocol(all, identities, {
    source: 'human',
    nativeMutation: true,
    publication: false,
    deployment: false,
  });
  expect(authorized).toMatchObject({
    status: 'ready-for-live-protocol',
    tenantCalls: [],
    publicationAuthorized: false,
    deploymentAuthorized: false,
  });
});
it('redacts authentication material and keeps the generated artifact secret-free', async () => {
  const response = {
    mentor_session_token: 'secret-marker',
    sessionId: 'secret-marker',
    uploadUrl: 'secret-marker',
    nested: [
      {
        Authorization: 'Bearer secret-marker',
        callback_url: 'http://localhost/callback?code=secret-marker&state=secret-marker',
      },
    ],
    summary: 'Bearer secret-marker https://host/callback?code=secret-marker&state=secret-marker',
  };
  const serialized = JSON.stringify(redactIntegrationEvidence(response));
  expect(serialized).not.toContain('secret-marker');
  expect(serialized).toContain('[redacted]');
  const paths = await saveNativePlans(
    await mkdtemp(join(tmpdir(), 'osai-native-no-auth-')),
    resources,
  );
  expect(await readFile(paths[0]!, 'utf8')).not.toMatch(
    /Bearer |mentor_session_token|authorization_url/,
  );
});
