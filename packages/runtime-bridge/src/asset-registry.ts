import { canonicalJson, validateReleaseResources } from '@osai/contract-schemas';
import type {
  ComponentManifest,
  ReleaseResources,
  ResourceRegistration,
} from '@osai/contract-schemas';

export class ResourceMappingError extends Error {
  constructor(readonly code: string) {
    super('The component resource registration is unavailable or incompatible.');
  }
}
export class AssetRegistry {
  private contracts = new Map<string, ReleaseResources>();
  private mappings = new Map<string, Readonly<Record<string, string>>>();
  constructor(private document: Document) {}
  define(manifest: ComponentManifest, contract?: ReleaseResources): void {
    if (!contract) {
      if (manifest.assets.length) throw new ResourceMappingError('missing-resource-contract');
      return;
    }
    if (!validateReleaseResources(contract, manifest))
      throw new ResourceMappingError('invalid-resource-contract');
    const prior = this.contracts.get(manifest.componentId);
    if (prior && canonicalJson(prior) !== canonicalJson(contract))
      throw new ResourceMappingError('incompatible-resources');
    this.contracts.set(
      manifest.componentId,
      JSON.parse(canonicalJson(contract)) as ReleaseResources,
    );
  }
  register(componentId: string, input: unknown, live: boolean): void {
    const contract = this.contracts.get(componentId);
    const registration = input as ResourceRegistration;
    if (
      !contract ||
      !registration ||
      registration.schemaVersion !== '2.0' ||
      registration.releaseId !== contract.releaseId ||
      !registration.mappings ||
      Array.isArray(registration.mappings) ||
      Object.keys(registration.mappings).length !== contract.assets.length
    )
      throw new ResourceMappingError('invalid-resource-mapping');
    const mappings: Record<string, string> = Object.create(null) as Record<string, string>;
    for (const asset of contract.assets) {
      const mapping = registration.mappings[asset.id];
      if (!mapping || mapping.integrity !== asset.integrity || typeof mapping.url !== 'string')
        throw new ResourceMappingError('invalid-resource-mapping');
      let url: URL;
      try {
        url = new URL(mapping.url, this.document.baseURI);
      } catch {
        throw new ResourceMappingError('invalid-resource-url');
      }
      const local = new URL(this.document.baseURI);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hash ||
        (asset.origin ? url.origin !== asset.origin : url.origin !== local.origin)
      )
        throw new ResourceMappingError('disallowed-resource-origin');
      mappings[asset.id] = url.href;
    }
    const prior = this.mappings.get(componentId);
    if (prior && live && canonicalJson(prior) !== canonicalJson(mappings))
      throw new ResourceMappingError('resources-in-use');
    this.mappings.set(componentId, Object.freeze(mappings));
  }
  snapshot(componentId: string): Readonly<Record<string, string>> {
    const contract = this.contracts.get(componentId);
    const mapping = this.mappings.get(componentId);
    if (contract?.assets.length && !mapping)
      throw new ResourceMappingError('resources-not-registered');
    return mapping ?? Object.freeze({});
  }
}
