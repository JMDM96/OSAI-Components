import type { Plugin } from 'esbuild';
import type { ComponentManifest, Target } from '@osai/contract-schemas';
import { odcTarget } from '@osai/target-odc';
import { o11Target } from '@osai/target-o11-reactive';

export interface TargetOverride {
  rationale: string;
  defines: Record<string, string | number | boolean>;
}

/** Target differences are compile-time constants; no runtime platform detection is needed. */
export function targetProfile(target: Target, override?: TargetOverride) {
  const profile = target === 'odc' ? odcTarget : target === 'o11-reactive' ? o11Target : undefined;
  if (!profile) throw new Error(`Unsupported target: ${target}`);
  if (
    override &&
    (!override.rationale?.trim() ||
      !override.defines ||
      Object.entries(override.defines).some(
        ([name, value]) =>
          !/^OSAI_BUILD_[A-Z][A-Z0-9_]*$/.test(name) ||
          !['string', 'number', 'boolean'].includes(typeof value) ||
          (typeof value === 'number' && !Number.isFinite(value)),
      ))
  )
    throw new Error(`Invalid explicit build-time overrides for ${target}`);
  return { ...profile, overrides: override ? [override] : [] };
}

/** An explicitly externalized import resolves only to its declared host global. */
export function externalGlobals(manifest: ComponentManifest): Plugin {
  const external = new Map(
    manifest.dependencies.filter((item) => !item.bundled).map((item) => [item.name, item]),
  );
  for (const item of external.values()) {
    if (
      !item.global ||
      !/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(item.global) ||
      item.global
        .split('.')
        .some((part) => ['__proto__', 'prototype', 'constructor'].includes(part))
    )
      throw new Error(`Unsafe external global: ${item.name}`);
  }
  return {
    name: 'osai-declared-external-globals',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (external.has(args.path)) return { path: args.path, namespace: 'osai-external' };
        if ([...external.keys()].some((name) => args.path.startsWith(`${name}/`)))
          return {
            errors: [{ text: `External subpath requires its own exact declaration: ${args.path}` }],
          };
        return undefined;
      });
      build.onLoad({ filter: /.*/, namespace: 'osai-external' }, (args) => {
        const dependency = external.get(args.path)!;
        const access = dependency
          .global!.split('.')
          .map((part) => `[${JSON.stringify(part)}]`)
          .join('');
        return {
          contents: `const value = globalThis${access}; if (value == null) throw new Error(${JSON.stringify(`Missing declared external: ${dependency.name}@${dependency.version}`)}); module.exports = value;`,
          loader: 'js',
        };
      });
    },
  };
}
