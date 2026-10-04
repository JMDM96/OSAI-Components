import { cp, mkdir, mkdtemp, readdir, access, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { canonicalJson } from '@osai/contract-schemas';
import { payloadChecksums } from './release.js';
import { selectComponents } from './registry.js';
import type { ComponentSelection } from './registry.js';

const directories = new Set(['packages', 'components', 'tests', 'docs', 'openspec']);
const generated = new Set([
  'node_modules',
  '.build',
  'dist',
  'test-results',
  'playwright-report',
  '.git',
  '.agents',
  '.codex',
  '.aws',
]);
const rootFile =
  /^(?:package(?:-lock)?\.json|platform-fixtures\.json|release-policy\.json|build\.config\.json|tsconfig(?:\.[\w-]+)?\.json|[\w.-]+\.config\.(?:ts|js|mjs|json)|\.(?:npmrc|node-version|nvmrc|prettierignore|prettierrc(?:\.json)?|gitignore)|README\.md|AGENTS\.md)$/;

export interface CleanWorkspaceRelease {
  root: string;
  checksums: Record<string, string>;
  workspace: string;
}
export interface CleanReproduction {
  first: CleanWorkspaceRelease;
  second: CleanWorkspaceRelease;
  workspaces: [string, string];
}

/** Copy governed source/config inputs, never source node_modules, build output, or credentials. */
export async function prepareCleanWorkspace(source: string, destination: string): Promise<void> {
  const from = resolve(source);
  const to = resolve(destination);
  if (from === to || (!isAbsolute(relative(from, to)) && !relative(from, to).startsWith('..')))
    throw new Error('A clean workspace must be separate from the source workspace.');
  await mkdir(to, { recursive: true });
  if ((await readdir(to)).length !== 0)
    throw new Error('A clean workspace destination must be empty.');
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && directories.has(entry.name)) {
      const origin = join(from, entry.name);
      await cp(origin, join(to, entry.name), {
        recursive: true,
        filter: async (file) => {
          if (
            relative(origin, file)
              .split(/[\\/]/)
              .some((part) => generated.has(part) || part.startsWith('.env'))
          )
            return false;
          if ((await lstat(file)).isSymbolicLink())
            throw new Error(
              'Clean source inputs must not contain symbolic links to another workspace.',
            );
          return true;
        },
      });
    } else if (entry.isFile() && rootFile.test(entry.name))
      await cp(join(from, entry.name), join(to, entry.name));
  }
  for (const required of ['package.json', 'package-lock.json', 'build.config.json'])
    await access(join(to, required));
  // Copy only these repository-owned workflows, never personal skills or credentials.
  for (const skill of ['component-author', 'component-certify', 'outsystems-library-integrate']) {
    const source = join(from, '.agents/skills', skill, 'SKILL.md');
    try {
      await access(source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    const destination = join(to, '.agents/skills', skill);
    await mkdir(destination, { recursive: true });
    await cp(source, join(destination, 'SKILL.md'));
  }
}

async function npmCli(): Promise<string> {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    join(dirname(dirname(process.execPath)), 'lib/node_modules/npm/bin/npm-cli.js'),
  ];
  for (const candidate of candidates) {
    if (!candidate || !candidate.replaceAll('\\', '/').endsWith('/npm-cli.js')) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* Try the next installed npm location. */
    }
  }
  throw new Error(
    'The locked npm CLI could not be located; invoke reproduction through npm run reproduce.',
  );
}

function runNpm(cli: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolveRun, reject) => {
    execFile(
      process.execPath,
      [cli, ...args],
      {
        cwd,
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        env: { ...process.env, SOURCE_DATE_EPOCH: '0', TZ: 'UTC', CI: 'true' },
      },
      (error, stdout, stderr) => {
        if (error)
          reject(
            new Error(
              `Clean workspace npm ${args[0]} failed: ${stderr || stdout || error.message}`,
            ),
          );
        else resolveRun();
      },
    );
  });
}

/** Each independent source copy installs from its lockfile and launches its own build process. */
export async function proveCleanWorkspaceReproducibility(
  root: string,
  options: { onProgress?: (message: string) => void; selection?: ComponentSelection } = {},
): Promise<CleanReproduction> {
  const selected = await selectComponents(root, options.selection);
  if (selected.length !== 1) throw new Error('Reproduce requires one component per run.');
  const component = selected[0]!;
  const directory = await mkdtemp(join(tmpdir(), 'osai-clean-reproduce-'));
  const workspaces: [string, string] = [join(directory, 'first'), join(directory, 'second')];
  const cli = await npmCli();
  const outputs: CleanWorkspaceRelease[] = [];
  for (const [index, workspace] of workspaces.entries()) {
    options.onProgress?.(`Preparing clean workspace ${index + 1}/2: ${workspace}`);
    await prepareCleanWorkspace(root, workspace);
    options.onProgress?.(`Installing workspace ${index + 1}/2 from package-lock.json`);
    await runNpm(cli, ['ci', '--prefer-offline', '--no-audit', '--no-fund'], workspace);
    options.onProgress?.(`Building workspace ${index + 1}/2 in an independent process`);
    const fixtureArgs = component.fixture
      ? ['--fixture', relative(root, component.manifestFile).replaceAll('\\', '/')]
      : [];
    await runNpm(
      cli,
      ['run', 'build', '--', '--component', component.manifest.componentId, ...fixtureArgs],
      workspace,
    );
    const manifest = (
      await selectComponents(workspace, {
        component: component.manifest.componentId,
        fixtureManifests: component.fixture
          ? [relative(root, component.manifestFile).replaceAll('\\', '/')]
          : [],
      })
    )[0]!.manifest;
    const output = join(workspace, 'dist', manifest.componentId, manifest.version);
    outputs.push({ root: output, workspace, checksums: await payloadChecksums(output) });
  }
  const first = outputs[0]!;
  const second = outputs[1]!;
  if (canonicalJson(first.checksums) !== canonicalJson(second.checksums))
    throw new Error(`Clean workspace unsigned payloads differ; retained diagnostics: ${directory}`);
  options.onProgress?.(
    `Unsigned payloads are byte-identical across independently installed workspaces: ${directory}`,
  );
  return { first, second, workspaces };
}
