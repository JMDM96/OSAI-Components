import type { Asset, ComponentManifest } from './types.js';
import { canonicalJson } from './json-schema.js';

export interface ReleaseResources {
  schemaVersion: '2.0';
  componentId: string;
  version: string;
  target: 'odc' | 'o11-reactive';
  releaseId: string;
  assets: { id: string; type: Asset['type']; integrity: string; origin?: string }[];
}
export interface ResourceRegistration {
  schemaVersion: '2.0';
  releaseId: string;
  mappings: Record<string, { url: string; integrity: string }>;
}
export function validateReleaseResources(
  value: ReleaseResources,
  manifest: ComponentManifest,
): boolean {
  return Boolean(
    value &&
    value.schemaVersion === '2.0' &&
    value.componentId === manifest.componentId &&
    value.version === manifest.version &&
    manifest.targets.includes(value.target) &&
    /^[a-f0-9]{64}$/.test(value.releaseId) &&
    Array.isArray(value.assets) &&
    value.assets.length === manifest.assets.length &&
    new Set(value.assets.map((asset) => asset.id)).size === value.assets.length &&
    value.assets.every((asset) => {
      const declared = manifest.assets.find((item) => item.path === asset.id);
      return (
        declared &&
        declared.type === asset.type &&
        declared.origin === asset.origin &&
        /^sha(256|384|512)-[A-Za-z0-9+/]+=*$/.test(asset.integrity) &&
        (!declared.origin || declared.integrity === asset.integrity)
      );
    }),
  );
}
export const sameResourceContract = (
  left: ReleaseResources | undefined,
  right: ReleaseResources | undefined,
): boolean => canonicalJson(left ?? null) === canonicalJson(right ?? null);
