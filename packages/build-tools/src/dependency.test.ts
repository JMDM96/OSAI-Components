import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Metafile } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { componentManifest } from '@osai/command-palette';
import { dependencyInventory, dependencyNotices } from './dependency.js';
import { loadPolicy } from './policy.js';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'osai-dependencies-'));
  const packages = {
    '': { name: 'fixture', version: '1.0.0' },
    'node_modules/direct': {
      name: 'direct',
      version: '1.2.3',
      license: 'MIT',
      dependencies: { transitive: '2.0.0' },
    },
    'node_modules/direct/node_modules/transitive': {
      name: 'transitive',
      version: '2.0.0',
      license: 'ISC',
    },
    'node_modules/not-bundled': { name: 'not-bundled', version: '9.0.0', license: 'MIT' },
  };
  await writeFile(join(root, 'package-lock.json'), JSON.stringify({ packages }));
  for (const [path, metadata] of Object.entries(packages).filter(([path]) => path)) {
    await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, path, 'package.json'), JSON.stringify(metadata));
    await writeFile(
      join(root, path, 'LICENSE'),
      `Copyright notice for ${metadata.name}.\nActual ${'license' in metadata ? metadata.license : ''} license terms.\n`,
    );
  }
  const metafile: Metafile = {
    outputs: {},
    inputs: {
      'component-entry.ts': {
        bytes: 1,
        imports: [{ path: 'node_modules/direct/index.js', kind: 'import-statement' }],
      },
      'node_modules/direct/index.js': {
        bytes: 1,
        imports: [
          {
            path: 'node_modules/direct/node_modules/transitive/index.js',
            kind: 'import-statement',
          },
        ],
      },
      'node_modules/direct/node_modules/transitive/index.js': { bytes: 1, imports: [] },
    },
  };
  const manifest = structuredClone(componentManifest);
  manifest.dependencies = [{ name: 'direct', version: '1.2.3', license: 'MIT', bundled: true }];
  const policy = await loadPolicy(join(process.cwd(), 'release-policy.json'));
  return { root, manifest, metafile, policy, packages };
}

describe('bundled dependency provenance', () => {
  it('uses actual graph edges and nested lock paths to classify direct and transitive packages', async () => {
    const setup = await fixture();
    const inventory = await dependencyInventory(
      setup.root,
      setup.metafile,
      setup.manifest,
      setup.policy,
    );
    expect(inventory.map((value) => [value.name, value.relationship])).toEqual([
      ['direct', 'direct'],
      ['transitive', 'transitive'],
    ]);
    expect(inventory[0]!.dependencies).toEqual(['node_modules/direct/node_modules/transitive']);
    expect(dependencyNotices(inventory)).toContain('Actual MIT license terms.');
    expect(dependencyNotices(inventory)).toContain('Copyright notice for transitive.');
    expect(inventory.some((value) => value.name === 'not-bundled')).toBe(false);
  });

  it('rejects undeclared direct imports, disallowed transitives and lockfile drift', async () => {
    const setup = await fixture();
    await expect(
      dependencyInventory(
        setup.root,
        setup.metafile,
        { ...setup.manifest, dependencies: [] },
        setup.policy,
      ),
    ).rejects.toThrow('must be declared');
    await expect(
      dependencyInventory(setup.root, setup.metafile, setup.manifest, {
        ...setup.policy,
        dependencies: { ...setup.policy.dependencies, allowedLicenses: ['MIT'] },
      }),
    ).rejects.toThrow('not approved');
    await writeFile(
      join(setup.root, 'node_modules/direct/package.json'),
      JSON.stringify({ name: 'direct', version: '99.0.0', license: 'MIT' }),
    );
    await expect(
      dependencyInventory(setup.root, setup.metafile, setup.manifest, setup.policy),
    ).rejects.toThrow('differs from its lockfile');
  });

  it('recognizes only declared external global-shim inputs and preserves provider identity', async () => {
    const setup = await fixture();
    const name = '@provider/chart';
    setup.manifest.dependencies.push({
      name,
      version: '3.0.0',
      license: 'MIT',
      bundled: false,
      global: 'Charts',
      origin: 'https://cdn.example.com',
      loadOrder: 1,
      integrity: 'sha256-YQ==',
      csp: { scriptSrc: ['https://cdn.example.com'] },
    });
    setup.metafile.inputs[`osai-external:${name}`] = { bytes: 1, imports: [] };
    setup.metafile.inputs['component-entry.ts']!.imports.push({
      path: `osai-external:${name}`,
      kind: 'import-statement',
    });
    const inventory = await dependencyInventory(
      setup.root,
      setup.metafile,
      setup.manifest,
      setup.policy,
    );
    expect(inventory.find((value) => value.name === name)).toMatchObject({
      bundled: false,
      path: `osai-external:${name}`,
      origin: 'https://cdn.example.com',
    });
    setup.metafile.inputs['osai-external:undeclared'] = { bytes: 1, imports: [] };
    await expect(
      dependencyInventory(setup.root, setup.metafile, setup.manifest, setup.policy),
    ).rejects.toThrow('Undeclared runtime external shim');
  });

  it('rejects injected dependency edges absent from package-lock and unowned source files', async () => {
    const setup = await fixture();
    setup.packages['node_modules/direct'].dependencies = {} as { transitive: string };
    await writeFile(
      join(setup.root, 'package-lock.json'),
      JSON.stringify({ packages: setup.packages }),
    );
    await expect(
      dependencyInventory(setup.root, setup.metafile, setup.manifest, setup.policy),
    ).rejects.toThrow('absent from its lockfile');
    setup.metafile.inputs['undeclared.js'] = { bytes: 1, imports: [] };
    await expect(
      dependencyInventory(setup.root, setup.metafile, setup.manifest, setup.policy),
    ).rejects.toThrow('no governed package owner');
  });
});
