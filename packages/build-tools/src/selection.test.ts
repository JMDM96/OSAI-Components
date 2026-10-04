import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { main } from './cli.js';
import { parseSelection } from './selection.js';
import { buildRelease, inspectRelease } from './build.js';

async function optionalOutput<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return undefined;
  }
}

it('rejects conflicting/unknown selectors before modifying outputs or release records', async () => {
  const catalog = await optionalOutput(() => readFile('releases/catalog.json', 'utf8'));
  const output = await optionalOutput(() => readdir('dist'));
  for (const command of [
    'validate',
    'build',
    'inspect',
    'verify',
    'release',
    'preview',
    'reproduce',
  ]) {
    await expect(main([command, '--component', 'not-registered'])).rejects.toThrow('selection');
    await expect(main([command, '--all', '--component', 'command-palette'])).rejects.toThrow(
      'Conflicting',
    );
  }
  expect(await optionalOutput(() => readFile('releases/catalog.json', 'utf8'))).toBe(catalog);
  expect(await optionalOutput(() => readdir('dist'))).toEqual(output);
  expect(() => parseSelection(['--component'])).toThrow('Missing');
  expect(() => parseSelection(['--unknown'])).toThrow('Unknown');
  await expect(
    main([
      'release',
      '--component',
      'minimal',
      '--fixture',
      'tests/fixtures/minimal/component.manifest.json',
    ]),
  ).rejects.toThrow('production release catalog');
});

it('carries an explicitly selected fixture into complete isolated target packages', async () => {
  const release = await buildRelease(process.cwd(), {
    selection: {
      component: 'minimal',
      fixtureManifests: ['tests/fixtures/minimal/component.manifest.json'],
    },
    outputRoot: await mkdtemp(join(tmpdir(), 'osai-selected-minimal-')),
  });
  expect(release.config.component).toBe('minimal');
  expect(release.config.manifest).toBe('tests/fixtures/minimal/component.manifest.json');
  for (const target of release.config.targets) {
    const script = await readFile(join(release.root, target, 'minimal.js'), 'utf8');
    expect(script).not.toContain('osai-command-palette');
    expect(
      JSON.parse(await readFile(join(release.root, target, 'manifest.json'), 'utf8')).componentId,
    ).toBe('minimal');
  }
  await expect(inspectRelease(release.root)).resolves.toBeUndefined();
}, 30_000);
