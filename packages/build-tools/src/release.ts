import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, open, unlink } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import semver from 'semver';
import { canonicalJson, pointer } from '@osai/contract-schemas';
import type { ComponentManifest } from '@osai/contract-schemas';

export const checksum = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${canonicalJson(value)}\n`, 'utf8');
}
export async function payloadChecksums(root: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  const walk = async (directory: string): Promise<void> => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name, 'en'),
    )) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.isSymbolicLink())
        throw new Error('Release payloads must not contain symbolic links.');
      else {
        const key = relative(root, file).replaceAll('\\', '/');
        if (
          !key.startsWith('evidence/') &&
          !['shared/checksums.sha256', 'shared/release.json'].includes(key)
        )
          hashes[key] = checksum(await readFile(file));
      }
    }
  };
  await walk(root);
  return hashes;
}
export function breakingChanges(previous: ComponentManifest, next: ComponentManifest): string[] {
  const changes: string[] = [];
  for (const section of ['properties', 'commands', 'events', 'themeTokens'] as const) {
    for (const [name, value] of Object.entries(previous[section]))
      if (canonicalJson(value) !== canonicalJson(next[section][name] ?? null))
        changes.push(`/${section}/${pointer(name)}`);
  }
  for (const [name, property] of Object.entries(next.properties))
    if (!Object.prototype.hasOwnProperty.call(previous.properties, name) && property.required)
      changes.push(`/properties/${pointer(name)}`);
  for (const target of previous.targets)
    if (!next.targets.includes(target)) changes.push(`/targets/${target}`);
  if (previous.contractVersion !== next.contractVersion) changes.push('/contractVersion');
  if (previous.schemaVersion !== next.schemaVersion) changes.push('/schemaVersion');
  // New browser/host permissions can break existing consumers even with identical methods.
  for (const kind of Object.keys(
    next.capabilities,
  ) as (keyof ComponentManifest['capabilities'])[]) {
    const before = new Set(previous.capabilities[kind].map((value) => canonicalJson(value)));
    if (next.capabilities[kind].some((value) => !before.has(canonicalJson(value))))
      changes.push(`/capabilities/${kind}`);
  }
  for (const dependency of next.dependencies.filter((value) => !value.bundled)) {
    const before = previous.dependencies.find(
      (value) => value.name === dependency.name && !value.bundled,
    );
    if (!before || canonicalJson(before) !== canonicalJson(dependency))
      changes.push(`/dependencies/${pointer(dependency.name)}`);
  }
  return [...new Set(changes)].sort();
}
export interface CatalogEntry {
  componentId: string;
  version: string;
  payloadDigest: string;
  manifest: ComponentManifest;
}
export function checkRegistration(
  entries: CatalogEntry[],
  candidate: CatalogEntry,
): 'new' | 'existing' {
  if (!semver.valid(candidate.version)) throw new Error('A valid semantic version is required.');
  if (
    candidate.componentId !== candidate.manifest.componentId ||
    candidate.version !== candidate.manifest.version
  )
    throw new Error('Catalog identity and version must match the normalized manifest.');
  if (!/^[a-f0-9]{64}$/.test(candidate.payloadDigest))
    throw new Error('Catalog payloadDigest must be a SHA-256 digest.');
  const same = entries.find(
    (entry) => entry.componentId === candidate.componentId && entry.version === candidate.version,
  );
  if (same) {
    if (canonicalJson(same) !== canonicalJson(candidate))
      throw new Error('Registered version is immutable; choose a new version.');
    return 'existing';
  }
  const previous = entries
    .filter((entry) => entry.componentId === candidate.componentId)
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];
  if (previous) {
    if (!semver.gt(candidate.version, previous.version))
      throw new Error('New release version must increase.');
    if (
      breakingChanges(previous.manifest, candidate.manifest).length &&
      semver.major(candidate.version) <= semver.major(previous.version)
    )
      throw new Error('Breaking contract change requires a new major version.');
    const additive =
      (['properties', 'commands', 'events', 'themeTokens'] as const).some((section) =>
        Object.keys(candidate.manifest[section]).some(
          (name) => !Object.prototype.hasOwnProperty.call(previous.manifest[section], name),
        ),
      ) || candidate.manifest.targets.some((target) => !previous.manifest.targets.includes(target));
    if (
      additive &&
      semver.major(candidate.version) === semver.major(previous.version) &&
      semver.minor(candidate.version) <= semver.minor(previous.version)
    )
      throw new Error('New public contract members require a minor version increase.');
  }
  return 'new';
}
export async function registerRelease(path: string, candidate: CatalogEntry): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const lockPath = `${path}.lock`;
  const deadline = Date.now() + 10_000;
  let lock;
  while (!lock) {
    try {
      lock = await open(lockPath, 'wx');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (Date.now() >= deadline)
        throw new Error(
          'Release catalog is locked by another writer; inspect that process before retrying.',
          { cause: error },
        );
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  const temp = `${path}.pending-${randomUUID()}`;
  let temporaryExists = false;
  try {
    await lock.writeFile(
      JSON.stringify({
        pid: process.pid,
        componentId: candidate.componentId,
        version: candidate.version,
        acquiredAt: new Date().toISOString(),
      }),
      'utf8',
    );
    let entries: CatalogEntry[] = [];
    try {
      entries = JSON.parse(await readFile(path, 'utf8')) as CatalogEntry[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!Array.isArray(entries))
      throw new Error('Release catalog must be an array of immutable entries.');
    const seen = new Set<string>();
    for (const entry of entries) {
      checkRegistration([], entry);
      const key = `${entry.componentId}@${entry.version}`;
      if (seen.has(key)) throw new Error('Release catalog contains duplicate version records.');
      seen.add(key);
    }
    if (checkRegistration(entries, candidate) === 'existing') return;
    const pending = await open(temp, 'wx');
    temporaryExists = true;
    try {
      await pending.writeFile(`${canonicalJson([...entries, candidate])}\n`, 'utf8');
      await pending.sync();
    } finally {
      await pending.close();
    }
    await rename(temp, path);
    temporaryExists = false;
  } finally {
    if (temporaryExists) await unlink(temp).catch(() => {});
    await lock.close();
    await unlink(lockPath);
  }
}
