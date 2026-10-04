import { build } from 'esbuild';
import type { Metafile } from 'esbuild';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { ComponentManifest } from '@osai/contract-schemas';
import { scanJavaScript, scanCssResources } from './security.js';
import { externalGlobals } from './bundler.js';

export interface GraphAsset {
  id: string;
  path: string;
  type: 'script' | 'style' | 'worker' | 'font' | 'image' | 'data';
  usage: 'principal' | 'auxiliary' | 'external';
  integrity: string;
  bytes: number;
  gzipBytes: number;
  origin?: string;
}
export const integrity = (bytes: string | Uint8Array): string =>
  `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
export function graphAsset(
  path: string,
  type: GraphAsset['type'],
  bytes: Uint8Array | string,
  usage: GraphAsset['usage'] = 'auxiliary',
): GraphAsset {
  return {
    id: path,
    path,
    type,
    usage,
    integrity: integrity(bytes),
    bytes: typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.byteLength,
    gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
  };
}
export function mergeGraphs(graphs: Metafile[]): Metafile {
  return {
    inputs: Object.assign({}, ...graphs.map((graph) => graph.inputs)),
    outputs: Object.assign({}, ...graphs.map((graph) => graph.outputs)),
  };
}

/** No opaque executable copying: every entry and its imports enter the governed build. */
export async function compileAssets(
  root: string,
  directory: string,
  manifest: ComponentManifest,
  namespace: string,
  defines: Record<string, string> = {},
) {
  const files = new Map<string, Uint8Array>();
  const assets: GraphAsset[] = [];
  const graphs: Metafile[] = [];
  const base = await realpath(directory);
  for (const asset of manifest.assets) {
    if (assets.some((item) => item.id === asset.path)) throw new Error('Duplicate graph asset.');
    if (asset.origin) {
      // External executable content is supplied by the host with pinned SRI and CSP.
      // Its bytes are never silently represented as scanned local content.
      assets.push({
        id: asset.path,
        path: asset.path,
        type: asset.type,
        usage: 'external',
        origin: asset.origin,
        integrity: asset.integrity!,
        bytes: 0,
        gzipBytes: 0,
      });
      continue;
    }
    const input = await realpath(resolve(base, asset.path));
    const local = relative(base, input).replaceAll('\\', '/');
    if (local.startsWith('../') || local.includes(':'))
      throw new Error('Asset escapes its component.');
    const extension = extname(asset.path).toLowerCase();
    let bytes: Uint8Array = await readFile(input);
    if (asset.type === 'worker' || asset.type === 'script') {
      if (!['.js', '.mjs'].includes(extension))
        throw new Error('Unsupported executable asset format.');
      const result = await build({
        absWorkingDir: root,
        entryPoints: [input],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        target: 'es2017',
        minify: true,
        charset: 'utf8',
        legalComments: 'none',
        metafile: true,
        logLevel: 'silent',
        define: defines,
        plugins: [externalGlobals(manifest)],
      });
      if (!result.outputFiles?.[0] || !result.metafile) throw new Error('Missing graph output.');
      const findings = scanJavaScript(result.outputFiles[0].text, manifest, namespace);
      if (findings.length)
        throw new Error(`Auxiliary security scan failed: ${JSON.stringify(findings)}`);
      if (
        asset.type === 'worker' &&
        Object.keys(result.metafile.inputs).some((path) => path.startsWith('osai-external:'))
      )
        throw new Error('Workers cannot inherit host external globals.');
      graphs.push(result.metafile);
      bytes = result.outputFiles[0].contents;
    } else if (asset.type === 'style') {
      if (extension !== '.css') throw new Error('Unsupported style asset format.');
      const findings = scanCssResources(Buffer.from(bytes).toString('utf8'), manifest, asset.path);
      if (findings.length)
        throw new Error(`Auxiliary style scan failed: ${JSON.stringify(findings)}`);
    } else {
      validateOpaqueAsset(asset.type, extension, bytes);
    }
    files.set(asset.path, bytes);
    assets.push(graphAsset(asset.path, asset.type, bytes));
  }
  return { files, assets, graphs };
}

function validateOpaqueAsset(type: string, extension: string, bytes: Uint8Array): void {
  const buffer = Buffer.from(bytes);
  if (type === 'data' && extension === '.json') {
    JSON.parse(buffer.toString('utf8'));
    return;
  }
  if (
    type === 'font' &&
    ((extension === '.woff2' && buffer.toString('ascii', 0, 4) === 'wOF2') ||
      (extension === '.woff' && buffer.toString('ascii', 0, 4) === 'wOFF'))
  )
    return;
  if (
    type === 'image' &&
    ((extension === '.png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (['.jpg', '.jpeg'].includes(extension) && buffer[0] === 255 && buffer[1] === 216) ||
      (extension === '.webp' &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'))
  )
    return;
  throw new Error(`Unsupported or invalid non-executable asset: ${type} ${extension}`);
}
