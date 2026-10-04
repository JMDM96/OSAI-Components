import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { expect, it } from 'vitest';
import { prepareCleanWorkspace } from './clean-workspaces.js';
import { scaffoldComponent } from './scaffold.js';

it('scaffolds and registers a package that typechecks and validates without platform source changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'osai-scaffold-test-'));
  await prepareCleanWorkspace(process.cwd(), root);
  const sdk = await readFile(join(root, 'packages/component-sdk/src/index.ts'), 'utf8');
  const directory = await scaffoldComponent(root, 'scaffold-probe');
  const project = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8')) as {
    references: { path: string }[];
  };
  expect(project.references).toContainEqual({ path: 'components/scaffold-probe' });
  expect(await readFile(join(directory, 'src/generated.ts'), 'utf8')).toContain(
    'scaffold-probe@0.1.0',
  );
  expect(await readFile(join(directory, 'certification.json'), 'utf8')).toContain('command-read');
  expect(await readFile(join(root, 'packages/component-sdk/src/index.ts'), 'utf8')).toBe(sdk);
  const npm =
    process.env.npm_execpath ?? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const run = (args: string[]) =>
    promisify(execFile)(process.execPath, [npm, ...args], {
      cwd: root,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
  await run(['ci', '--offline', '--no-audit', '--no-fund']);
  await run(['run', 'typecheck']);
  await run(['run', 'validate', '--', '--component', 'scaffold-probe']);
  await expect(scaffoldComponent(root, 'scaffold-probe')).rejects.toThrow('already exists');
  await expect(scaffoldComponent(root, '../escape')).rejects.toThrow('identifier');
}, 60_000);
