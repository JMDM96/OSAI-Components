import { mkdtemp, readFile, writeFile, cp, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, expect, it } from 'vitest';
import { buildRelease, inspectRelease } from './build.js';
import type { BuiltRelease } from './build.js';
import { payloadChecksums } from './release.js';
import {
  generateAdapter,
  generateIntegrationGuide,
  generateMentorRecipe,
  validateAdapter,
  resourceLoadOrder,
} from '@osai/adapter-schema';
import type { ResourceMetadata } from '@osai/adapter-schema';
let release: BuiltRelease;
beforeAll(async () => {
  release = await buildRelease(process.cwd(), {
    manifestFile: 'tests/fixtures/resources/component.manifest.json',
    outputRoot: await mkdtemp(join(tmpdir(), 'osai-resources-')),
  });
}, 30000);
it('describes every worker/font/image with integrity, licenses, CSP and URL registration', async () => {
  for (const target of release.config.targets) {
    const metadata = JSON.parse(
      await readFile(join(release.root, target, 'resources.json'), 'utf8'),
    ) as ResourceMetadata;
    expect(metadata.assets.map((asset) => asset.type)).toEqual([
      'script',
      'style',
      'worker',
      'font',
      'image',
    ]);
    expect(metadata.assets.every((asset) => asset.bytes > 0 && asset.gzipBytes > 0)).toBe(true);
    const adapter = generateAdapter(release.manifest, target, release.config.namespace, metadata);
    expect(
      validateAdapter(adapter, release.manifest, target, release.config.namespace, metadata),
    ).toEqual([]);
    expect(generateIntegrationGuide(adapter)).toContain(metadata.registration.releaseId);
    const broken = structuredClone(metadata);
    broken.assets.pop();
    expect(() =>
      generateAdapter(release.manifest, target, release.config.namespace, broken),
    ).toThrow('Incomplete');
  }
  await expect(inspectRelease(release.root)).resolves.toBeUndefined();
});
it('detects changed and absent auxiliary bytes, including rehashed graph drift', async () => {
  const destination = join(await mkdtemp(join(tmpdir(), 'osai-resource-drift-')), 'payload');
  await cp(release.root, destination, { recursive: true });
  const path = join(destination, 'odc/workers/local.js');
  await writeFile(path, 'self.postMessage("changed");');
  await expect(inspectRelease(destination)).rejects.toThrow('checksums');
  const checksums = await payloadChecksums(destination);
  const record = JSON.parse(await readFile(join(destination, 'shared/release.json'), 'utf8'));
  await writeFile(
    join(destination, 'shared/release.json'),
    JSON.stringify({ ...record, checksums }),
  );
  await writeFile(
    join(destination, 'shared/checksums.sha256'),
    Object.entries(checksums)
      .map(([path, hash]) => `${hash}  ${path}`)
      .join('\n') + '\n',
  );
  await expect(inspectRelease(destination)).rejects.toThrow('resource graph');
  await rename(path, join(destination, 'missing-worker-retained.js'));
  await expect(inspectRelease(destination)).rejects.toThrow();
});
it('keeps immutable adapter-v1 payloads inspectable without rewriting', async () => {
  // A portable legacy-format fixture; no registered release is modified to create it.
  const destination = await mkdtemp(join(tmpdir(), 'osai-legacy-format-'));
  const historical = join(destination, 'payload');
  await cp(release.root, historical, { recursive: true });
  for (const target of release.config.targets) {
    const adapter = generateAdapter(release.manifest, target, release.config.namespace);
    await writeFile(join(historical, target, 'adapter.json'), JSON.stringify(adapter));
    await writeFile(join(historical, target, 'integration.md'), generateIntegrationGuide(adapter));
    await writeFile(
      join(historical, target, 'mentor-recipe.json'),
      JSON.stringify(generateMentorRecipe(adapter)),
    );
    await rename(
      join(historical, target, 'resources.json'),
      join(destination, `${target}-resources.json`),
    );
  }
  const checksums = await payloadChecksums(historical);
  await rename(
    join(historical, 'shared/certification.json'),
    join(destination, 'certification.json'),
  );
  delete checksums['shared/certification.json'];
  const record = JSON.parse(await readFile(join(historical, 'shared/release.json'), 'utf8'));
  await writeFile(
    join(historical, 'shared/release.json'),
    JSON.stringify({ ...record, checksums }),
  );
  await writeFile(
    join(historical, 'shared/checksums.sha256'),
    Object.entries(checksums)
      .map(([path, hash]) => `${hash}  ${path}`)
      .join('\n') + '\n',
  );
  const before = await payloadChecksums(historical);
  await inspectRelease(historical);
  expect(await payloadChecksums(historical)).toEqual(before);
});

it('requires external dependencies in loading order, license and host CSP metadata', async () => {
  const manifest = structuredClone(release.manifest);
  manifest.capabilities.networkOrigins = ['https://cdn.example.invalid'];
  manifest.dependencies = [
    {
      name: 'example-provider',
      version: '1.0.0',
      license: 'MIT',
      bundled: false,
      global: 'ExampleProvider',
      origin: 'https://cdn.example.invalid',
      loadOrder: 0,
      integrity: 'sha256-YWJj',
      csp: { scriptSrc: ['https://cdn.example.invalid'] },
    },
  ];
  const metadata = JSON.parse(
    await readFile(join(release.root, 'odc/resources.json'), 'utf8'),
  ) as ResourceMetadata;
  metadata.dependencies = manifest.dependencies;
  metadata.loadOrder = resourceLoadOrder(manifest);
  metadata.licenses.push({ name: 'example-provider', version: '1.0.0', license: 'MIT' });
  metadata.csp.dependencies = manifest.dependencies.map((item) => item.csp);
  const adapter = generateAdapter(manifest, 'odc', release.config.namespace, metadata);
  expect(adapter.resources?.loadOrder[0]).toBe('external:example-provider');
  expect(generateIntegrationGuide(adapter)).toContain('remote bytes are not locally scanned');
  metadata.dependencies = [];
  expect(() => generateAdapter(manifest, 'odc', release.config.namespace, metadata)).toThrow(
    'Incomplete',
  );
});
