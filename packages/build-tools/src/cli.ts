import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildRelease, inspectRelease, readConfiguration, validateComponent } from './build.js';
import { proveCleanWorkspaceReproducibility } from './clean-workspaces.js';

export async function main(args: string[]): Promise<void> {
  const root = process.cwd();
  const command = args[0] ?? 'build';
  if (command === 'build') {
    const release = await buildRelease(root);
    console.log(
      `Built ${release.manifest.componentId}@${release.manifest.version}: ${release.root}`,
    );
    return;
  }
  if (command === 'validate') {
    const result = await validateComponent(root, args[1]);
    console.log(`Valid component: ${result.manifest.componentId}@${result.manifest.version}`);
    return;
  }
  if (command === 'inspect') {
    const config = await readConfiguration(root);
    const { manifest } = await validateComponent(root);
    const folder = args[1]
      ? resolve(args[1])
      : join(root, 'dist', config.component, manifest.version);
    await inspectRelease(folder);
    console.log(`Checksums and adapters valid: ${folder}`);
    return;
  }
  if (command === 'reproduce') {
    const result = await proveCleanWorkspaceReproducibility(root, { onProgress: console.log });
    console.log(`Byte-identical clean workspaces: ${result.workspaces.join(' and ')}`);
    return;
  }
  if (command === 'verify' || command === 'release') {
    const { verify } = await import('./verify.js');
    await verify(root, command === 'release', args[1]);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
