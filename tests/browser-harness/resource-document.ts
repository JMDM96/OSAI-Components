import type { ResourceMetadata } from '@osai/adapter-schema';

const escape = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export function previewResources(resources: ResourceMetadata, base: string) {
  const directives: Record<string, Set<string>> = {
    'default-src': new Set(["'none'"]),
    'script-src': new Set(["'self'"]),
    'style-src': new Set(["'self'"]),
    'img-src': new Set(["'self'"]),
    'font-src': new Set(["'self'"]),
    'connect-src': new Set(["'self'"]),
    'worker-src': new Set(["'self'"]),
    'frame-src': new Set(["'self'"]),
    'object-src': new Set(["'none'"]),
    'base-uri': new Set(["'none'"]),
    'frame-ancestors': new Set(["'self'"]),
    'form-action': new Set(["'none'"]),
  };
  for (const [key, directive] of Object.entries({
    scriptSrc: 'script-src',
    styleSrc: 'style-src',
    imageSrc: 'img-src',
    fontSrc: 'font-src',
    connectSrc: 'connect-src',
    workerSrc: 'worker-src',
  })) {
    for (const value of (resources.csp[key] ?? []) as string[]) {
      if (value !== "'self'" && (!value.startsWith('https://') || new URL(value).origin !== value))
        throw new Error('Unsupported CSP source.');
      directives[directive]!.add(value);
    }
  }
  for (const dependency of resources.dependencies) {
    for (const [key, values] of Object.entries(dependency.csp ?? {})) {
      if (
        !['script-src', 'style-src', 'font-src', 'img-src', 'connect-src', 'worker-src'].includes(
          key,
        )
      )
        throw new Error('Unsupported dependency CSP directive.');
      for (const value of values) {
        if (value !== "'self'" && value !== dependency.origin)
          throw new Error('Dependency CSP exceeds declared origin.');
        directives[key]!.add(value);
      }
    }
  }
  const loaded = new Set<string>();
  const tags: string[] = [];
  for (const item of resources.loadOrder) {
    if (item === 'create' || item === 'registerResources') continue;
    let asset = resources.assets.find((asset) => asset.id === item);
    if (item.startsWith('external:')) {
      const dependency = resources.dependencies.find((entry) => `external:${entry.name}` === item);
      const matches = resources.assets.filter(
        (entry) =>
          entry.type === 'script' &&
          entry.origin === dependency?.origin &&
          entry.integrity === dependency?.integrity,
      );
      if (matches.length !== 1)
        throw new Error(
          'External dependency needs one declared script asset with matching origin and integrity for preview.',
        );
      asset = matches[0];
    }
    if (!asset || !['script', 'style'].includes(asset.type))
      throw new Error('Unknown load-order asset.');
    if (loaded.has(asset.id)) continue;
    loaded.add(asset.id);
    const url = escape(asset.origin ? `${asset.origin}/${asset.path}` : base + asset.path);
    const integrity = escape(asset.integrity);
    tags.push(
      asset.type === 'style'
        ? `<link rel="stylesheet" href="${url}" integrity="${integrity}" crossorigin="anonymous">`
        : `<script defer src="${url}" integrity="${integrity}" crossorigin="anonymous"></script>`,
    );
  }
  return {
    tags: tags.join(''),
    csp: Object.entries(directives)
      .map(([key, values]) => `${key} ${[...values].join(' ')}`)
      .join('; '),
  };
}
