import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
const port = Number(process.env.OSAI_HARNESS_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid harness port.');
const baseURL = `http://127.0.0.1:${port}`;
const componentVersion = String(
  JSON.parse(
    await readFile(resolve(root, 'components/command-palette/component.manifest.json'), 'utf8'),
  ).version,
);
const allowedTargets = new Set(['odc', 'o11-reactive']);
const csp =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
const mime: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
};
const server = createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', csp);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url ?? '/', baseURL);
  try {
    if (url.pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ready');
      return;
    }
    if (url.pathname === '/metadata') {
      const target = url.searchParams.get('target') ?? 'odc';
      if (!allowedTargets.has(target)) throw new Error('Unknown target.');
      const files = await Promise.all(
        ['js', 'css'].map(async (extension) => {
          const name = `command-palette.${extension}`;
          const data = await readFile(
            resolve(root, 'dist/command-palette', componentVersion, target, name),
          );
          return [name, createHash('sha256').update(data).digest('hex')];
        }),
      );
      response.writeHead(200, { 'Content-Type': mime['.json'] });
      response.end(JSON.stringify({ target, files: Object.fromEntries(files) }));
      return;
    }
    if (url.pathname === '/harness.js') {
      const source = await readFile(resolve(root, 'tests/browser-harness/client.ts'), 'utf8');
      response.writeHead(200, { 'Content-Type': mime['.js'] });
      response.end(
        (await transform(source, { loader: 'ts', format: 'iife', target: 'es2017' })).code,
      );
      return;
    }
    if (url.pathname === '/') {
      const target = url.searchParams.get('target') ?? 'odc';
      if (!allowedTargets.has(target)) throw new Error('Unknown target.');
      const html = (
        await readFile(resolve(root, 'tests/browser-harness/index.html'), 'utf8')
      ).replaceAll('{{target}}', target);
      response.writeHead(200, { 'Content-Type': mime['.html'] });
      response.end(html);
      return;
    }
    if (url.pathname === '/harness.css') {
      response.writeHead(200, { 'Content-Type': mime['.css'] });
      response.end(await readFile(resolve(root, 'tests/browser-harness/styles.css')));
      return;
    }
    const artifact = /^\/artifacts\/(odc|o11-reactive)\/(command-palette\.(js|css))$/.exec(
      url.pathname,
    );
    if (artifact) {
      response.writeHead(200, { 'Content-Type': mime[`.${artifact[3]}`] });
      response.end(
        await readFile(
          resolve(root, 'dist/command-palette', componentVersion, artifact[1]!, artifact[2]!),
        ),
      );
      return;
    }
    response.writeHead(404);
    response.end('Not found');
  } catch {
    response.writeHead(500);
    response.end('Harness artifact unavailable. Run npm run build.');
  }
});
server.listen(port, '127.0.0.1', () =>
  process.stdout.write(`Browser harness ready at ${baseURL}\n`),
);
