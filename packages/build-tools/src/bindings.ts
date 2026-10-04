import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateAuthoringBindings, loadManifest } from '@osai/contract-schemas/authoring';
import { format } from 'prettier';

export async function generateBindings(manifestFile: string, check = false): Promise<string> {
  const loaded = await loadManifest(manifestFile);
  if (!loaded.value)
    throw new Error(`Cannot generate bindings: ${JSON.stringify(loaded.diagnostics)}`);
  const path = resolve(manifestFile, '../src/generated.ts');
  const output = await format(generateAuthoringBindings(loaded.value), {
    parser: 'typescript',
    singleQuote: true,
    trailingComma: 'all',
    printWidth: 100,
  });
  if (check) {
    let current: string | undefined;
    try {
      current = await readFile(path, 'utf8');
    } catch {
      /* Missing bindings are drift. */
    }
    if (current?.replaceAll('\r\n', '\n') !== output)
      throw new Error(
        `Generated binding drift: ${loaded.value.componentId}. Run npm run bindings.`,
      );
  } else await writeFile(path, output);
  return path;
}
