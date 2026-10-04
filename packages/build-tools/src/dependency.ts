import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve, isAbsolute } from 'node:path';
import semver from 'semver';
import type { Metafile } from 'esbuild';
import type { ComponentManifest } from '@osai/contract-schemas';
import type { ReleasePolicy } from './policy.js';

interface LockPackage {
  name?: string;
  version?: string;
  license?: string;
  link?: boolean;
  resolved?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
interface PackageMetadata {
  name?: string;
  version?: string;
  license?: string;
  private?: boolean;
}
export interface Dependency {
  name: string;
  version: string;
  license: string;
  relationship: 'direct' | 'transitive' | 'workspace';
  path: string;
  bundled: boolean;
  licenseText: string;
  dependencies: string[];
  origin?: string;
}

const slash = (value: string): string => value.replaceAll('\\', '/');

/** Inventory only packages whose sources actually enter the esbuild graph. */
export async function dependencyInventory(
  root: string,
  metafile: Metafile,
  manifest: ComponentManifest,
  policy: ReleasePolicy,
): Promise<Dependency[]> {
  const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockPackage>;
  };
  const rootPath = resolve(root);
  const externalShim = (input: string): boolean => {
    if (!input.startsWith('osai-external:')) return false;
    const name = input.slice('osai-external:'.length);
    if (
      !manifest.dependencies.some((dependency) => !dependency.bundled && dependency.name === name)
    )
      throw new Error(`Undeclared runtime external shim: ${name}`);
    return true;
  };
  const local = (file: string): string => {
    const path = slash(relative(rootPath, isAbsolute(file) ? file : resolve(rootPath, file)));
    if (path === '..' || path.startsWith('../'))
      throw new Error('Bundled source is outside the governed workspace.');
    return path;
  };
  const packageKeys = Object.keys(lock.packages)
    .filter((key) => key && !lock.packages[key]?.link)
    .sort((a, b) => b.length - a.length);
  const owner = (input: string): string | undefined => {
    if (externalShim(input)) return undefined;
    const path = local(input);
    const key = packageKeys.find(
      (candidate) => path === candidate || path.startsWith(`${candidate}/`),
    );
    if (!key && path.includes('node_modules/'))
      throw new Error(`Dependency inventory is incomplete: ${path}`);
    if (!key && !['<stdin>', 'component-entry.ts'].includes(path))
      throw new Error(`Bundled source has no governed package owner: ${path}`);
    return key;
  };
  const owners = new Map<string, string>();
  const included = new Set<string>();
  for (const input of Object.keys(metafile.inputs)) {
    const key = owner(input);
    if (key) {
      owners.set(local(input), key);
      included.add(key);
    }
  }
  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const [input, detail] of Object.entries(metafile.inputs)) {
    if (externalShim(input)) continue;
    const from = owners.get(local(input));
    for (const imported of detail.imports) {
      // esbuild's injected helper module is part of the generated bundle, not an external package.
      if (imported.path === '<runtime>') continue;
      if (externalShim(imported.path)) {
        if (from) {
          const targets = outgoing.get(from) ?? new Set<string>();
          targets.add(imported.path);
          outgoing.set(from, targets);
        }
        continue;
      }
      if (imported.external) {
        if (!manifest.dependencies.some((value) => !value.bundled && value.name === imported.path))
          throw new Error(`Undeclared runtime external: ${imported.path}`);
        continue;
      }
      const to = owners.get(local(imported.path)) ?? owner(imported.path);
      if (!to || to === from) continue;
      const sources = incoming.get(to) ?? new Set<string>();
      sources.add(from ?? '<entry>');
      incoming.set(to, sources);
      if (from) {
        const targets = outgoing.get(from) ?? new Set<string>();
        targets.add(to);
        outgoing.set(from, targets);
      }
    }
  }
  const isWorkspace = (key: string): boolean => !key.includes('node_modules/');
  const inventory: Dependency[] = [];
  for (const key of [...included].sort()) {
    const info = lock.packages[key];
    if (!info?.version || !info.license)
      throw new Error(`Dependency inventory is incomplete: ${key}`);
    const directory = resolve(rootPath, key);
    if (relative(rootPath, directory).startsWith('..'))
      throw new Error('Unsafe package-lock package path.');
    const metadata = JSON.parse(
      await readFile(join(directory, 'package.json'), 'utf8'),
    ) as PackageMetadata;
    const name = metadata.name ?? info.name;
    if (!name || metadata.version !== info.version || metadata.license !== info.license)
      throw new Error(`Installed package metadata differs from its lockfile: ${key}`);
    const workspace = isWorkspace(key);
    const sources = incoming.get(key);
    const direct =
      !sources?.size || [...sources].some((source) => source === '<entry>' || isWorkspace(source));
    const declaration = manifest.dependencies.find(
      (value) => value.name === name && value.bundled && value.version === info.version,
    );
    if (!workspace && direct && !declaration)
      throw new Error(
        `Direct bundled dependency must be declared with its exact version: ${name}@${info.version}`,
      );
    if (declaration && declaration.license !== info.license)
      throw new Error(`Declared dependency license differs from installed metadata: ${name}`);
    if (!workspace && !policy.dependencies.allowedLicenses.includes(info.license))
      throw new Error(`Dependency license is not approved: ${name}: ${info.license}`);
    if (workspace && (!metadata.private || info.license !== 'UNLICENSED'))
      throw new Error(
        `Bootstrap workspace packages must declare private UNLICENSED ownership: ${name}`,
      );
    const noticeFiles = (await readdir(directory))
      .filter((file) => /^(?:licen[cs]e|copying|notice)(?:$|[._-])/i.test(file))
      .sort();
    const texts: string[] = [];
    for (const filename of noticeFiles) {
      try {
        texts.push(
          `${filename}\n${(await readFile(join(directory, filename), 'utf8')).replaceAll('\r\n', '\n').trim()}\n`,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EISDIR') throw error;
      }
    }
    if (!workspace && texts.length === 0)
      throw new Error(`Dependency license notices are missing: ${name}`);
    const licenseText = texts.length
      ? texts.join('\n')
      : 'Private workspace source. No redistribution license is granted.\n';
    inventory.push({
      name,
      version: info.version,
      license: info.license,
      path: key,
      bundled: true,
      relationship: workspace ? 'workspace' : direct ? 'direct' : 'transitive',
      licenseText,
      dependencies: [...(outgoing.get(key) ?? [])].sort(),
    });
  }
  for (const dependency of manifest.dependencies.filter((value) => !value.bundled)) {
    if (!semver.valid(dependency.version))
      throw new Error(
        `External dependencies require an exact semantic version: ${dependency.name}`,
      );
    if (!policy.dependencies.allowedLicenses.includes(dependency.license))
      throw new Error(`External license is not approved: ${dependency.name}`);
    inventory.push({
      name: dependency.name,
      version: dependency.version,
      license: dependency.license,
      path: `osai-external:${dependency.name}`,
      ...(dependency.origin ? { origin: dependency.origin } : {}),
      bundled: false,
      relationship: 'direct',
      licenseText:
        'External dependency is not redistributed in this package; the host must retain the provider notices.\n',
      dependencies: [],
    });
  }
  const byPath = new Map(
    inventory.filter((value) => value.bundled).map((value) => [value.path, value]),
  );
  for (const dependency of inventory.filter(
    (value) => value.bundled && value.relationship !== 'workspace',
  )) {
    const source = lock.packages[dependency.path]!;
    for (const target of dependency.dependencies) {
      const imported = byPath.get(target);
      if (
        imported &&
        !Object.prototype.hasOwnProperty.call(source.dependencies ?? {}, imported.name) &&
        !Object.prototype.hasOwnProperty.call(source.optionalDependencies ?? {}, imported.name)
      )
        throw new Error(
          `Bundled transitive import is absent from its lockfile dependency graph: ${dependency.name} -> ${imported.name}`,
        );
    }
  }
  return inventory.sort((a, b) =>
    `${a.name}@${a.version}:${a.path}`.localeCompare(`${b.name}@${b.version}:${b.path}`, 'en'),
  );
}

export function dependencyNotices(inventory: Dependency[]): string {
  return inventory
    .map(
      (value) => `${value.name}@${value.version}\nLicense: ${value.license}\n${value.licenseText}`,
    )
    .join('\n');
}
