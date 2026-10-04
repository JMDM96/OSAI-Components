import { readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson } from '@osai/contract-schemas';
import type { CompatibilityEvidence } from '@osai/adapter-schema';
import { discoverComponents } from './registry.js';
import { loadPolicy } from './policy.js';
import { evidenceReadiness } from './verify.js';
import { readConfiguration, inspectRelease } from './build.js';
import type { BuiltRelease } from './build.js';
import { checksum, payloadChecksums } from './release.js';

export interface MatrixItem {
  component: string;
  version: string;
  fixture: string;
}
export async function qualificationMatrix(root: string): Promise<MatrixItem[]> {
  const fixtures = JSON.parse(await readFile(join(root, 'platform-fixtures.json'), 'utf8')) as {
    schemaVersion: string;
    manifests: string[];
  };
  if (
    fixtures.schemaVersion !== '1.0' ||
    !Array.isArray(fixtures.manifests) ||
    fixtures.manifests.length < 2 ||
    new Set(fixtures.manifests).size !== fixtures.manifests.length
  )
    throw new Error('Invalid required platform fixture inventory.');
  const components = await discoverComponents(root, fixtures.manifests);
  if (!components.some((item) => !item.fixture))
    throw new Error('Missing production component discovery.');
  return components.map((item) => ({
    component: item.manifest.componentId,
    version: item.manifest.version,
    fixture: item.fixture ? relative(root, item.manifestFile).replaceAll('\\', '/') : '',
  }));
}
export function validateMatrixSummaries(
  matrix: MatrixItem[],
  summaries: {
    componentId: string;
    version: string;
    status: string;
    records: CompatibilityEvidence[];
  }[],
  targets: string[],
  browsers: string[],
) {
  if (
    summaries.length !== matrix.length ||
    new Set(summaries.map((item) => item.componentId)).size !== matrix.length
  )
    throw new Error('Missing or duplicated component report.');
  for (const item of matrix) {
    const summary = summaries.find((report) => report.componentId === item.component);
    if (
      !summary ||
      summary.version !== item.version ||
      summary.status !== 'browser-verified' ||
      canonicalJson(summary.records.map((record) => record.target).sort()) !==
        canonicalJson([...targets].sort())
    )
      throw new Error('Missing or mismatched component/target report.');
    for (const record of summary.records)
      if (
        record.componentId !== item.component ||
        record.version !== item.version ||
        record.status !== 'browser-verified' ||
        canonicalJson(record.browserResults.map((entry) => entry.browser).sort()) !==
          canonicalJson([...browsers].sort()) ||
        record.browserResults.some((entry) => entry.failed || entry.skipped || entry.passed < 1)
      )
        throw new Error('Missing or cross-component browser matrix.');
  }
}
async function validateReports(root: string) {
  const matrix = await qualificationMatrix(root);
  const policy = await loadPolicy(join(root, 'release-policy.json'));
  const summaries = await Promise.all(
    matrix.map(async (item) =>
      JSON.parse(
        await readFile(join(root, 'test-results', item.component, 'verification.json'), 'utf8'),
      ),
    ),
  );
  validateMatrixSummaries(matrix, summaries, policy.targets, policy.browsers);
  for (const [index, item] of matrix.entries()) {
    const directory = join(root, 'dist', item.component, item.version);
    await inspectRelease(directory);
    const config = await readConfiguration(root, {
      component: item.component,
      fixtureManifests: item.fixture ? [item.fixture] : [],
    });
    const manifest = JSON.parse(
      await readFile(join(directory, config.targets[0]!, 'manifest.json'), 'utf8'),
    );
    const releaseInfo = JSON.parse(await readFile(join(directory, 'shared/release.json'), 'utf8'));
    const release: BuiltRelease = {
      root: directory,
      manifest,
      config,
      policy,
      checksums: await payloadChecksums(directory),
      measurements: releaseInfo.measurements,
    };
    if (summaries[index].payloadDigest !== checksum(canonicalJson(release.checksums)))
      throw new Error('Matrix payload drift.');
    for (const record of summaries[index].records as CompatibilityEvidence[])
      if ((await evidenceReadiness(root, release, record, record.target)) !== 'browser-verified')
        throw new Error('Stale matrix evidence.');
  }
  console.log(`Qualified ${matrix.length} components with the complete target/browser matrix.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === 'validate') await validateReports(process.cwd());
  else if (!process.argv[2])
    console.log(JSON.stringify({ include: await qualificationMatrix(process.cwd()) }));
  else throw new Error('Unknown matrix command.');
}
