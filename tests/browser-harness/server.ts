import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { build, transform } from 'esbuild';
import { canonicalJson } from '@osai/contract-schemas';
import type { Target } from '@osai/contract-schemas';
import { discoverComponents, containedPath } from '../../packages/build-tools/src/registry.js';
import { loadCertification } from '../../packages/build-tools/src/certification.js';
import { checksum, payloadChecksums } from '../../packages/build-tools/src/release.js';
import { loadPolicy } from '../../packages/build-tools/src/policy.js';
import type { ResourceMetadata } from '@osai/adapter-schema';
import { evidenceReadiness } from '../../packages/build-tools/src/verify.js';
import { readConfiguration } from '../../packages/build-tools/src/build.js';
import type { BuiltRelease } from '../../packages/build-tools/src/build.js';
import { previewResources } from './resource-document.js';
const root = process.cwd();
const port = Number(process.env.OSAI_HARNESS_PORT ?? 4173);
const defaultComponent = process.env.OSAI_COMPONENT ?? 'command-palette';
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid harness port.');
const fixtures = JSON.parse(process.env.OSAI_FIXTURE_MANIFESTS ?? '[]') as string[];
const components = await discoverComponents(root, fixtures);
const policy = await loadPolicy(resolve(root, 'release-policy.json'));
const baseURL = `http://127.0.0.1:${port}`;
const mime: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};
const baseCsp =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'none'";
function selection(url: URL) {
  const id = url.searchParams.get('component') ?? defaultComponent;
  const component = components.find((item) => item.manifest.componentId === id);
  const target = url.searchParams.get('target') ?? 'odc';
  if (!component || !component.manifest.targets.includes(target as Target))
    throw new Error('Unknown component or target.');
  const version = url.searchParams.get('version') ?? component.manifest.version;
  if (version !== component.manifest.version)
    throw new Error('Selected version is not built from this source.');
  return {
    component,
    target,
    version,
    directory: join(root, 'dist', id, version),
    assetBase: `/artifacts/${id}/${version}/${target}/`,
  };
}
async function metadata(url: URL) {
  const selected = selection(url);
  const { component, target, directory, assetBase } = selected;
  const manifest = component.manifest;
  const resources = JSON.parse(
    await readFile(join(directory, target, 'resources.json'), 'utf8'),
  ) as ResourceMetadata;
  const artifactChecksums = await payloadChecksums(directory);
  const release = JSON.parse(await readFile(join(directory, 'shared/release.json'), 'utf8')) as {
    checksums: Record<string, string>;
    measurements: BuiltRelease['measurements'];
  };
  if (canonicalJson(release.checksums) !== canonicalJson(artifactChecksums))
    throw new Error('Packaged artifacts changed; rebuild required.');
  const certification = await loadCertification(component);
  let status: string;
  try {
    const evidence = JSON.parse(
      await readFile(join(directory, 'evidence', `${target}.json`), 'utf8'),
    );
    status = await evidenceReadiness(
      root,
      {
        root: directory,
        manifest,
        policy,
        checksums: artifactChecksums,
        config: await readConfiguration(root, { manifestFile: component.manifestFile }),
        measurements: release.measurements,
      },
      evidence,
      target as Target,
    );
  } catch (error) {
    status = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'stale';
  }
  return {
    manifest,
    resources,
    certification,
    artifactChecksums,
    policyHash: checksum(canonicalJson(policy)),
    policyVersion: policy.policyVersion,
    target,
    assetBase,
    status,
    files: Object.fromEntries(
      ['js', 'css'].map((ext) => [
        `${manifest.componentId}.${ext}`,
        artifactChecksums[`${target}/${manifest.componentId}.${ext}`],
      ]),
    ),
  };
}
const server = createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', baseCsp);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  const reply = (body: string | Uint8Array, type = 'text/plain', status = 200) => {
    response.writeHead(status, { 'Content-Type': type });
    response.end(body);
  };
  try {
    const raw = request.url ?? '/';
    if (/%2e|%2f|%5c|\\|(?:^|\/)\.\.(?:\/|$)/i.test(raw))
      return reply('Invalid path.', 'text/plain', 400);
    const url = new URL(raw, baseURL);
    if (url.pathname === '/health') return reply('ready');
    if (url.pathname === '/catalog')
      return reply(
        JSON.stringify(
          components.map(({ manifest, fixture }) => ({
            componentId: manifest.componentId,
            version: manifest.version,
            targets: manifest.targets,
            fixture,
          })),
        ),
        mime['.json'],
      );
    if (url.pathname === '/metadata')
      return reply(JSON.stringify(await metadata(url)), mime['.json']);
    if (url.pathname === '/preview-metadata.js')
      return reply(`window.previewMetadata=${JSON.stringify(await metadata(url))};`, mime['.js']);
    if (url.pathname === '/scenarios.js') {
      const { component } = selection(url);
      const certification = await loadCertification(component);
      const result = await build({
        stdin: {
          contents: `import {scenarios} from ${JSON.stringify(certification.scenarioModule.replaceAll('\\', '/'))};window.componentScenarios=scenarios;`,
          resolveDir: root,
          loader: 'ts',
        },
        bundle: true,
        write: false,
        format: 'iife',
        target: 'es2017',
        platform: 'browser',
        logLevel: 'silent',
      });
      return reply(result.outputFiles[0]!.text, mime['.js']);
    }
    if (
      ['/observations.js', '/preview.js', '/workbench.js', '/harness.js'].includes(url.pathname)
    ) {
      const source =
        url.pathname === '/harness.js' ? 'client.ts' : url.pathname.slice(1).replace('.js', '.ts');
      if (url.pathname === '/preview.js') {
        const compiled = await build({
          entryPoints: [resolve(root, 'tests/browser-harness', source)],
          bundle: true,
          write: false,
          format: 'iife',
          platform: 'browser',
          target: 'es2017',
          logLevel: 'silent',
        });
        return reply(compiled.outputFiles[0]!.text, mime['.js']);
      }
      const text = await readFile(resolve(root, 'tests/browser-harness', source), 'utf8');
      return reply(
        (await transform(text, { loader: 'ts', format: 'iife', target: 'es2017' })).code,
        mime['.js'],
      );
    }
    if (url.pathname === '/preview') {
      const info = await metadata(url);
      const query = url.searchParams.toString();
      const assets = previewResources(info.resources, info.assetBase);
      response.setHeader('Content-Security-Policy', assets.csp);
      const escapedQuery = query.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      return reply(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${info.manifest.componentId} preview</title><script src="/observations.js"></script><script src="/preview-metadata.js?${escapedQuery}"></script>${assets.tags}<script defer src="/scenarios.js?${escapedQuery}"></script><script defer src="/preview.js"></script></head><body><main id="hosts" aria-label="Component preview"></main></body></html>`,
        mime['.html'],
      );
    }
    if (url.pathname === '/palette') {
      const { target } = selection(
        new URL(
          `/?component=command-palette&target=${url.searchParams.get('target') ?? 'odc'}`,
          baseURL,
        ),
      );
      return reply(
        (await readFile(resolve(root, 'tests/browser-harness/index.html'), 'utf8')).replaceAll(
          '{{target}}',
          target,
        ),
        mime['.html'],
      );
    }
    if (url.pathname === '/')
      return reply(
        await readFile(resolve(root, 'tests/browser-harness/workbench.html')),
        mime['.html'],
      );
    if (url.pathname === '/harness.css' || url.pathname === '/workbench.css')
      return reply(
        await readFile(
          resolve(
            root,
            'tests/browser-harness',
            url.pathname === '/harness.css' ? 'styles.css' : 'workbench.css',
          ),
        ),
        mime['.css'],
      );
    const legacy = /^\/artifacts\/(odc|o11-reactive)\/(command-palette\.(js|css))$/.exec(
      url.pathname,
    );
    const resource = /^\/artifacts\/([a-z][a-z0-9-]*)\/([^/]+)\/(odc|o11-reactive)\/(.+)$/.exec(
      url.pathname,
    );
    if (legacy || resource) {
      const id = resource?.[1] ?? 'command-palette';
      const component = components.find((item) => item.manifest.componentId === id);
      if (!component) return reply('Unknown component.', 'text/plain', 404);
      const version = resource?.[2] ?? component.manifest.version;
      const target = resource?.[3] ?? legacy![1]!;
      const file = resource?.[4] ?? legacy![2]!;
      if (
        version !== component.manifest.version ||
        !component.manifest.targets.includes(target as Target)
      )
        return reply('Unknown release.', 'text/plain', 404);
      const folder = join(root, 'dist', id, version);
      const record = JSON.parse(await readFile(join(folder, 'shared/release.json'), 'utf8')) as {
        checksums: Record<string, string>;
      };
      if (!record.checksums[`${target}/${file}`] || !mime[extname(file)])
        return reply('Unregistered resource.', 'text/plain', 404);
      const path = await containedPath(folder, `${target}/${file}`);
      const bytes = await readFile(path);
      if (checksum(bytes) !== record.checksums[`${target}/${file}`])
        return reply('Artifact changed.', 'text/plain', 409);
      return reply(bytes, mime[extname(file)]);
    }
    return reply('Not found.', 'text/plain', 404);
  } catch {
    return reply(
      'Selected artifact unavailable or stale. Build this component and target.',
      'text/plain',
      409,
    );
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Component workbench: ${baseURL}/?component=${encodeURIComponent(defaultComponent)}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => server.close());
export { server };
