import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { arch, platform, release, version } from 'node:os';
import { join } from 'node:path';

export const VISUAL_HOSTS = {
  'win32-x64': 'tests/browser/baselines',
  'darwin-arm64': 'tests/browser/baselines/darwin-arm64',
} as const;
export type VisualHost = keyof typeof VISUAL_HOSTS;
export interface ReferenceFile {
  path: string;
  sha256: string;
}
export interface BrowserPin {
  name: string;
  revision: string;
  browserVersion: string;
}
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const projectPattern = /^(odc|o11-reactive)-(chromium|firefox|webkit)$/;

export function visualHost(os: string = platform(), cpu: string = arch()): VisualHost {
  const key = `${os}-${cpu}`;
  if (!Object.hasOwn(VISUAL_HOSTS, key))
    throw new Error(
      `Unsupported visual host ${key}; add and review a dedicated reference set. No host fallback is permitted.`,
    );
  return key as VisualHost;
}

export function snapshotTemplate(host: VisualHost): string {
  return `{testDir}/baselines/${host === 'win32-x64' ? '' : `${host}/`}{projectName}/{arg}{ext}`;
}

export function referenceFiles(root: string, host: VisualHost): ReferenceFile[] {
  const base = VISUAL_HOSTS[host];
  if (!existsSync(join(root, base))) return [];
  return readdirSync(join(root, base), { recursive: true, encoding: 'utf8' })
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => projectPattern.test(path.split('/')[0]!) && path.endsWith('.png'))
    .sort()
    .map((path) => ({
      path: `${base}/${path}`,
      sha256: digest(readFileSync(join(root, base, path))),
    }));
}

// Hash the complete governed corpus on every host, never the executing host's subset.
export function visualInputs(root: string): ReferenceFile[] {
  const reviews = 'tests/browser/baselines/reviews';
  const metadata = existsSync(join(root, reviews))
    ? readdirSync(join(root, reviews))
        .filter((name) => name.endsWith('.json'))
        .map((name) => `${reviews}/${name}`)
    : [];
  return [
    ...Object.keys(VISUAL_HOSTS).flatMap((host) => referenceFiles(root, host as VisualHost)),
    ...metadata.map((path) => ({ path, sha256: digest(readFileSync(join(root, path))) })),
    ...['packages/build-tools/src/visual-host.ts', 'tests/workflows/visual-review-v1.json'].map(
      (path) => ({ path, sha256: digest(readFileSync(join(root, path))) }),
    ),
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

export function visualDigest(root: string): string {
  return digest(JSON.stringify(visualInputs(root)));
}

export function assertReviewedReferences(root: string, host: VisualHost): void {
  const path = join(root, 'tests/browser/baselines/reviews', `${host}.json`);
  const remedy =
    'Preserve the failed run, use npm run test:visual:update for this host, inspect every candidate, and record reviewed hashes before qualification.';
  if (!existsSync(path)) throw new Error(`Missing visual review for ${host}. ${remedy}`);
  const review = JSON.parse(readFileSync(path, 'utf8')) as {
    host: string;
    reviewer: string;
    reviewDate: string;
    findings: string;
    files: ReferenceFile[];
  };
  const files = referenceFiles(root, host);
  if (
    review.host !== host ||
    !review.reviewer ||
    !review.reviewDate ||
    !review.findings ||
    !files.length ||
    JSON.stringify(review.files) !== JSON.stringify(files)
  )
    throw new Error(
      `Missing, unreviewed or stale visual references for ${host}: ${[...new Set([...files.map((file) => file.path), ...(review.files ?? []).map((file) => file.path)])].filter((path) => files.find((file) => file.path === path)?.sha256 !== review.files?.find((file) => file.path === path)?.sha256).join(', ') || path}. ${remedy}`,
    );
}

export function browserPins(root: string): BrowserPin[] {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const installed = JSON.parse(
    readFileSync(join(root, 'node_modules/playwright-core/package.json'), 'utf8'),
  );
  if (lock.packages['node_modules/playwright-core']?.version !== installed.version)
    throw new Error('Installed browser toolchain differs from package-lock.json.');
  const source = JSON.parse(
    readFileSync(join(root, 'node_modules/playwright-core/browsers.json'), 'utf8'),
  ) as { browsers: BrowserPin[] };
  return ['chromium', 'firefox', 'webkit'].map((name) => {
    const matches = source.browsers.filter((pin) => pin.name === name);
    if (matches.length !== 1 || !matches[0]?.revision || !matches[0]?.browserVersion)
      throw new Error(`Missing pinned browser: ${name}`);
    const { revision, browserVersion } = matches[0];
    return { name, revision, browserVersion };
  });
}

export function executionMetadata(root: string, collection = false) {
  return {
    platform: platform(),
    osRelease: release(),
    osVersion: version(),
    architecture: arch(),
    referenceSet: visualHost(),
    baselineDigest: visualDigest(root),
    browsers: browserPins(root),
    purpose: collection ? 'reference-collection' : 'qualification',
  };
}

export function validateExecutionMetadata(root: string, input: unknown): void {
  const data = input as ReturnType<typeof executionMetadata> | undefined;
  if (
    !data ||
    typeof data.platform !== 'string' ||
    typeof data.architecture !== 'string' ||
    !data.osRelease ||
    !data.osVersion ||
    data.purpose !== 'qualification'
  )
    throw new Error(
      'Missing qualification execution host metadata; reference collection is not evidence.',
    );
  const host = visualHost(data.platform, data.architecture);
  if (
    data.referenceSet !== host ||
    data.baselineDigest !== visualDigest(root) ||
    JSON.stringify(data.browsers) !== JSON.stringify(browserPins(root))
  )
    throw new Error(
      'Browser report host, reference digest or pins are inconsistent with current certification inputs.',
    );
  assertReviewedReferences(root, host);
}

export function visualCollectionArguments(args: string[]): string[] {
  if (args.length)
    throw new Error(
      'Reference collection takes no overrides. Select component/fixtures or workbench using the documented environment variables; the executing host is mandatory.',
    );
  return ['test', '--grep', '@visual', '--update-snapshots=all'];
}
