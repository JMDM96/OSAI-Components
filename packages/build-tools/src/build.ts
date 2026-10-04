import { build as bundle } from 'esbuild';
import { readFile, writeFile, mkdir, mkdtemp, cp } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import {
  canonicalJson,
  validateImplementationParity,
  validateJsonSchema,
} from '@osai/contract-schemas';
import type { ComponentManifest, Target, JsonSchema } from '@osai/contract-schemas';
import type { ComponentDefinition } from '@osai/component-sdk';
import {
  loadManifest,
  validateCssContract,
  generateTypeDeclarations,
} from '@osai/contract-schemas/authoring';
import {
  generateAdapter,
  validateAdapter,
  generateIntegrationGuide,
  generateMentorRecipe,
  recipeSchema,
  validateEvidence,
} from '@osai/adapter-schema';
import type { CompatibilityEvidence } from '@osai/adapter-schema';
import { loadPolicy } from './policy.js';
import type { ReleasePolicy } from './policy.js';
import { scanJavaScript, scanCssResources } from './security.js';
import { checksum, payloadChecksums, writeJson } from './release.js';
import { dependencyInventory, dependencyNotices } from './dependency.js';
import { externalGlobals, targetProfile } from './bundler.js';
import type { TargetOverride } from './bundler.js';

export interface BuildConfig {
  namespace: string;
  component: string;
  manifest: string;
  targets: Target[];
  target: string;
  policy: string;
  targetOverrides?: Partial<Record<Target, TargetOverride>>;
}
export interface BuiltRelease {
  root: string;
  manifest: ComponentManifest;
  policy: ReleasePolicy;
  config: BuildConfig;
  checksums: Record<string, string>;
  measurements: Record<
    Target,
    {
      javascriptGzipBytes: number;
      cssGzipBytes: number;
      securityFindings: number;
      dependencyFindings: number;
    }
  >;
}
export async function readConfiguration(root: string): Promise<BuildConfig> {
  const config = JSON.parse(await readFile(join(root, 'build.config.json'), 'utf8')) as BuildConfig;
  if (
    config.target !== 'es2017' ||
    !Array.isArray(config.targets) ||
    new Set(config.targets).size !== config.targets.length
  )
    throw new Error('Build requires ES2017 and distinct declared targets.');
  for (const target of config.targets) targetProfile(target, config.targetOverrides?.[target]);
  for (const target of Object.keys(config.targetOverrides ?? {}))
    if (!config.targets.includes(target as Target))
      throw new Error(`Override for undeclared target: ${target}`);
  return config;
}
function requireClean(issues: unknown[], label: string): void {
  if (issues.length) throw new Error(`${label}: ${JSON.stringify(issues)}`);
}
export async function validateComponent(
  root: string,
  manifestFile?: string,
): Promise<{
  manifest: ComponentManifest;
  definition: ComponentDefinition;
  css: string;
  directory: string;
}> {
  const config = await readConfiguration(root);
  const path = resolve(root, manifestFile ?? config.manifest);
  const loaded = await loadManifest(path);
  if (!loaded.ok || !loaded.value)
    throw new Error(`Manifest validation failed: ${JSON.stringify(loaded.diagnostics)}`);
  const manifest = loaded.value;
  const directory = dirname(path);
  const module = (await import(pathToFileURL(resolve(directory, manifest.entry)).href)) as {
    componentDefinition?: ComponentDefinition;
  };
  const definition = module.componentDefinition;
  if (!definition || typeof definition.create !== 'function')
    throw new Error('Entry must export a conforming componentDefinition.');
  if (canonicalJson(manifest) !== canonicalJson(definition.manifest))
    throw new Error('Implementation manifest differs from the normalized file.');
  requireClean(
    validateImplementationParity(manifest, definition.contract),
    'Implementation parity failed',
  );
  const css = (
    await Promise.all(manifest.styles.map((file) => readFile(resolve(directory, file), 'utf8')))
  )
    .join('\n')
    .replaceAll('\r\n', '\n');
  requireClean(validateCssContract(manifest, css), 'Stylesheet conformance failed');
  requireClean(scanCssResources(css, manifest), 'Stylesheet resource policy failed');
  for (const asset of manifest.assets.filter((item) => !item.origin))
    await readFile(resolve(directory, asset.path));
  return { manifest, definition, css, directory };
}

export { dependencyInventory } from './dependency.js';

export async function buildRelease(
  root: string,
  options: { outputRoot?: string; manifestFile?: string } = {},
): Promise<BuiltRelease> {
  const config = await readConfiguration(root);
  const policy = await loadPolicy(resolve(root, config.policy));
  const { manifest, css, directory } = await validateComponent(root, options.manifestFile);
  for (const target of config.targets)
    if (!manifest.targets.includes(target) || !policy.targets.includes(target))
      throw new Error(`Unsupported target: ${target}`);
  for (const target of config.targets) {
    const profile = targetProfile(target, config.targetOverrides?.[target]);
    const unsupported = manifest.capabilities.browserApis.filter(
      (api) => !(profile.browserApis as readonly string[]).includes(api),
    );
    requireClean(unsupported, `Unsupported browser capability for ${target}`);
  }
  if (!config.targets.includes('odc') || !config.targets.includes('o11-reactive'))
    throw new Error('Bootstrap release must build both target packages.');
  const output = resolve(
    options.outputRoot ?? join(root, 'dist', manifest.componentId, manifest.version),
  );
  await mkdir(output, { recursive: true });
  const measurements = {} as BuiltRelease['measurements'];
  const componentEntry = resolve(directory, manifest.entry);
  const entry = `import {installBridge} from '@osai/runtime-bridge';\nimport {componentDefinition} from ${JSON.stringify(componentEntry.replaceAll('\\', '/'))};\nconst result = JSON.parse(installBridge({namespace:${JSON.stringify(config.namespace)}}).registerComponent(componentDefinition));\nif (!result.ok) throw new Error(result.code + ': ' + result.message);\n`;
  const compiledTargets = await Promise.all(
    config.targets.map(async (target) => {
      const compiled = await bundle({
        absWorkingDir: root,
        stdin: {
          contents: entry,
          resolveDir: root,
          sourcefile: 'component-entry.ts',
          loader: 'ts',
        },
        bundle: true,
        write: false,
        minify: true,
        format: 'iife',
        platform: 'browser',
        target: config.target,
        charset: 'utf8',
        legalComments: 'none',
        sourcemap: false,
        metafile: true,
        treeShaking: true,
        logLevel: 'silent',
        plugins: [externalGlobals(manifest)],
        define: Object.fromEntries(
          Object.entries(config.targetOverrides?.[target]?.defines ?? {}).map(([name, value]) => [
            name,
            JSON.stringify(value),
          ]),
        ),
      });
      const script = compiled.outputFiles?.[0]?.text;
      if (!script || !compiled.metafile) throw new Error('Bundler produced no browser script.');
      const findings = scanJavaScript(script, manifest, config.namespace);
      requireClean(findings, 'Production security scan failed');
      const inventory = await dependencyInventory(root, compiled.metafile, manifest, policy);
      const includedComponents = Object.keys(compiled.metafile.inputs).filter(
        (input) =>
          input.replaceAll('\\', '/').startsWith('components/') &&
          !input.replaceAll('\\', '/').startsWith(`components/${manifest.componentId}/`),
      );
      requireClean(includedComponents, 'Unrelated catalog component was bundled');
      return { target, script, findings, inventory, metafile: compiled.metafile };
    }),
  );
  const inventoryMap = new Map(
    compiledTargets.flatMap((item) => item.inventory).map((item) => [item.path, item]),
  );
  for (const { inventory: targetInventory } of compiledTargets)
    for (const item of targetInventory) {
      const shared = inventoryMap.get(item.path)!;
      shared.dependencies = [...new Set([...shared.dependencies, ...item.dependencies])].sort();
    }
  const inventory = [...inventoryMap.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const cssCompiled = await bundle({
    stdin: { contents: css, loader: 'css' },
    write: false,
    minify: true,
    target: config.target,
    logLevel: 'silent',
  });
  const style = cssCompiled.outputFiles?.[0]?.text ?? '';
  const cssBytes = gzipSync(style, { level: 9 }).byteLength;
  const configSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(manifest.properties).map(([name, property]) => [name, property.schema]),
    ),
    required: Object.entries(manifest.properties)
      .filter(([, property]) => property.required)
      .map(([name]) => name),
  };
  for (const { target, script, findings } of compiledTargets) {
    const jsBytes = gzipSync(script, { level: 9 }).byteLength;
    if (jsBytes > policy.budgets.javascriptGzipBytes || cssBytes > policy.budgets.cssGzipBytes)
      throw new Error(
        `Bundle budget exceeded for ${target}: JS ${jsBytes}/${policy.budgets.javascriptGzipBytes}; CSS ${cssBytes}/${policy.budgets.cssGzipBytes}.`,
      );
    const targetRoot = join(output, target);
    await mkdir(targetRoot, { recursive: true });
    await writeFile(join(targetRoot, `${manifest.componentId}.js`), script, 'utf8');
    await writeFile(join(targetRoot, `${manifest.componentId}.css`), style, 'utf8');
    await writeJson(join(targetRoot, 'manifest.json'), manifest);
    await writeJson(
      join(targetRoot, 'target.json'),
      targetProfile(target, config.targetOverrides?.[target]),
    );
    const adapter = generateAdapter(manifest, target, config.namespace);
    requireClean(
      validateAdapter(adapter, manifest, target, config.namespace),
      'Adapter validation failed',
    );
    await writeJson(join(targetRoot, 'adapter.json'), adapter);
    const recipe = generateMentorRecipe(adapter);
    requireClean(validateJsonSchema(recipeSchema, recipe), 'Mentor recipe validation failed');
    await writeJson(join(targetRoot, 'mentor-recipe.json'), recipe);
    await writeFile(join(targetRoot, 'integration.md'), generateIntegrationGuide(adapter), 'utf8');
    await writeJson(join(targetRoot, 'schemas/config.schema.json'), configSchema);
    for (const [name, command] of Object.entries(manifest.commands)) {
      await writeJson(
        join(targetRoot, `schemas/command-${name}-arguments.schema.json`),
        command.arguments,
      );
      await writeJson(
        join(targetRoot, `schemas/command-${name}-result.schema.json`),
        command.result,
      );
    }
    for (const [name, event] of Object.entries(manifest.events))
      await writeJson(join(targetRoot, `schemas/event-${name}.schema.json`), event.schema);
    for (const asset of manifest.assets.filter((item) => !item.origin)) {
      if (
        [
          'schemas',
          'manifest.json',
          'adapter.json',
          'target.json',
          'mentor-recipe.json',
          'integration.md',
          'csp.json',
          'licenses.txt',
          `${manifest.componentId}.js`,
          `${manifest.componentId}.css`,
        ].some((file) => asset.path === file || asset.path.startsWith(`${file}/`))
      )
        throw new Error(`Local asset collides with generated metadata: ${asset.path}`);
      const destination = resolve(targetRoot, asset.path);
      await mkdir(dirname(destination), { recursive: true });
      await cp(resolve(directory, asset.path), destination);
    }
    const sources = (type: string) =>
      [
        ...new Set(
          manifest.assets
            .filter((asset) => asset.type === type)
            .map((asset) => asset.origin ?? "'self'"),
        ),
      ].sort();
    await writeJson(join(targetRoot, 'csp.json'), {
      scriptSrc: [...new Set(["'self'", ...sources('script')])],
      styleSrc: [...new Set(["'self'", ...sources('style')])],
      imageSrc: sources('image'),
      fontSrc: sources('font'),
      workerSrc: sources('worker'),
      frameSrc: [],
      connectSrc: manifest.capabilities.networkOrigins,
      dependencies: manifest.dependencies.filter((item) => !item.bundled).map((item) => item.csp),
      findings,
    });
    await writeFile(join(targetRoot, 'licenses.txt'), dependencyNotices(inventory));
    measurements[target] = {
      javascriptGzipBytes: jsBytes,
      cssGzipBytes: cssBytes,
      securityFindings: findings.length,
      dependencyFindings: 0,
    };
  }
  await mkdir(join(output, 'shared/types'), { recursive: true });
  await writeFile(join(output, 'shared/types/index.d.ts'), generateTypeDeclarations(manifest));
  await writeJson(join(output, 'shared/dependencies.json'), inventory);
  const packageIds = new Map(
    inventory.map((item, index) => [item.path, `SPDXRef-Package-${index}`]),
  );
  await writeJson(join(output, 'shared/sbom.spdx.json'), {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `${manifest.componentId}-${manifest.version}`,
    documentNamespace: `https://osai.invalid/spdx/${manifest.componentId}/${manifest.version}/${checksum(canonicalJson(manifest))}`,
    creationInfo: { creators: ['Tool: OSAI-build-tools-1.0.0'], created: '1970-01-01T00:00:00Z' },
    hasExtractedLicensingInfos: [
      {
        licenseId: 'LicenseRef-Private-Proprietary',
        extractedText: 'Private workspace source. No redistribution license is granted.',
      },
    ],
    packages: inventory.map((item, index) => ({
      SPDXID: `SPDXRef-Package-${index}`,
      name: item.name,
      versionInfo: item.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded:
        item.license === 'UNLICENSED' ? 'LicenseRef-Private-Proprietary' : item.license,
      licenseDeclared:
        item.license === 'UNLICENSED' ? 'LicenseRef-Private-Proprietary' : item.license,
    })),
    relationships: inventory.flatMap((item) => [
      {
        spdxElementId: 'SPDXRef-DOCUMENT',
        relationshipType: 'DESCRIBES',
        relatedSpdxElement: packageIds.get(item.path),
      },
      ...item.dependencies
        .filter((path) => packageIds.has(path))
        .map((path) => ({
          spdxElementId: packageIds.get(item.path),
          relationshipType: 'DEPENDS_ON',
          relatedSpdxElement: packageIds.get(path),
        })),
    ]),
  });
  await writeFile(
    join(output, 'shared/licenses.txt'),
    await readFile(join(output, config.targets[0] ?? 'odc', 'licenses.txt'), 'utf8'),
  );
  await writeJson(join(output, 'shared/build-inputs.json'), {
    componentId: manifest.componentId,
    version: manifest.version,
    policyVersion: policy.policyVersion,
    namespace: config.namespace,
    node: process.versions.node,
    lockfileChecksum: checksum(await readFile(join(root, 'package-lock.json'))),
    inputFiles: [...new Set(compiledTargets.flatMap((item) => Object.keys(item.metafile.inputs)))]
      .map((input) => input.replaceAll('\\', '/'))
      .filter((input) => !input.startsWith('component-entry'))
      .sort(),
  });
  const esm = await bundle({
    absWorkingDir: root,
    entryPoints: [componentEntry],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'esm',
    target: config.target,
    minify: true,
    logLevel: 'silent',
    plugins: [externalGlobals(manifest)],
    define: Object.fromEntries(
      Object.entries(config.targetOverrides?.[config.targets[0] ?? 'odc']?.defines ?? {}).map(
        ([name, value]) => [name, JSON.stringify(value)],
      ),
    ),
  });
  await writeFile(
    join(output, 'shared/component.mjs'),
    esm.outputFiles?.[0]?.contents ?? new Uint8Array(),
  );
  const checksums = await payloadChecksums(output);
  await writeFile(
    join(output, 'shared/checksums.sha256'),
    Object.entries(checksums)
      .map(([path, hash]) => `${hash}  ${path}`)
      .join('\n') + '\n',
  );
  await writeJson(join(output, 'shared/release.json'), {
    componentId: manifest.componentId,
    version: manifest.version,
    targets: config.targets,
    checksums,
    measurements,
  });
  for (const target of config.targets) {
    const evidence: CompatibilityEvidence = {
      schemaVersion: '1.0',
      componentId: manifest.componentId,
      version: manifest.version,
      target,
      status: 'generated',
      policyVersion: policy.policyVersion,
      suiteVersion: '1.0.0',
      artifactChecksums: checksums,
      browserResults: [],
      gates: [],
      hostEvidence: [],
    };
    requireClean(
      validateEvidence(evidence, policy.mandatoryGates, policy.browsers),
      'Generated evidence is invalid',
    );
    await writeJson(join(output, 'evidence', `${target}.json`), evidence);
  }
  await inspectRelease(output);
  return { root: output, manifest, policy, config, checksums, measurements };
}

export async function inspectRelease(root: string): Promise<void> {
  const { validateManifest } = await import('@osai/contract-schemas');
  const readJson = async (path: string): Promise<unknown> =>
    JSON.parse(await readFile(join(root, path), 'utf8')) as unknown;
  const same = (actual: unknown, expected: unknown, label: string): void => {
    if (canonicalJson(actual) !== canonicalJson(expected))
      throw new Error(`Packaged ${label} drift.`);
  };
  const release = JSON.parse(await readFile(join(root, 'shared/release.json'), 'utf8')) as {
    componentId: string;
    version: string;
    targets: Target[];
    checksums: Record<string, string>;
  };
  if (
    !release ||
    !Array.isArray(release.targets) ||
    canonicalJson([...release.targets].sort()) !== canonicalJson(['o11-reactive', 'odc'])
  )
    throw new Error('Release must contain exactly the supported bootstrap targets.');
  const actual = await payloadChecksums(root);
  if (canonicalJson(actual) !== canonicalJson(release.checksums))
    throw new Error('Release payload checksums or inventory do not match.');
  const index =
    Object.entries(actual)
      .map(([path, hash]) => `${hash}  ${path}`)
      .join('\n') + '\n';
  if ((await readFile(join(root, 'shared/checksums.sha256'), 'utf8')) !== index)
    throw new Error('Release checksums.sha256 index does not match the payload map.');
  const inputs = (await readJson('shared/build-inputs.json')) as {
    componentId: string;
    version: string;
    namespace: string;
  };
  const expectedFiles = new Set([
    'shared/types/index.d.ts',
    'shared/dependencies.json',
    'shared/sbom.spdx.json',
    'shared/licenses.txt',
    'shared/build-inputs.json',
    'shared/component.mjs',
  ]);
  let commonManifest: ComponentManifest | undefined;
  for (const target of release.targets) {
    const rawManifest = await readJson(`${target}/manifest.json`);
    const validation = validateManifest(rawManifest);
    if (!validation.ok || !validation.value)
      throw new Error(
        `Packaged normalized manifest is invalid: ${JSON.stringify(validation.diagnostics)}`,
      );
    const manifest = validation.value;
    if (
      manifest.componentId !== release.componentId ||
      manifest.version !== release.version ||
      inputs.componentId !== manifest.componentId ||
      inputs.version !== manifest.version
    )
      throw new Error('Packaged release/build-input identity differs from manifest.');
    same([...manifest.targets].sort(), [...release.targets].sort(), 'manifest target inventory');
    if (commonManifest) same(manifest, commonManifest, 'cross-target manifest');
    else commonManifest = manifest;
    const adapter = generateAdapter(manifest, target, inputs.namespace);
    requireClean(
      validateAdapter(await readJson(`${target}/adapter.json`), manifest, target, inputs.namespace),
      'Packaged adapter drift',
    );
    same(
      await readJson(`${target}/mentor-recipe.json`),
      generateMentorRecipe(adapter),
      'Mentor recipe',
    );
    if (
      (await readFile(join(root, target, 'integration.md'), 'utf8')) !==
      generateIntegrationGuide(adapter)
    )
      throw new Error('Packaged integration guide drift.');
    const schemas: Record<string, JsonSchema> = {
      'config.schema.json': {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(
          Object.entries(manifest.properties).map(([name, property]) => [name, property.schema]),
        ),
        required: Object.entries(manifest.properties)
          .filter(([, property]) => property.required)
          .map(([name]) => name),
      },
    };
    for (const [name, command] of Object.entries(manifest.commands)) {
      schemas[`command-${name}-arguments.schema.json`] = command.arguments;
      schemas[`command-${name}-result.schema.json`] = command.result;
    }
    for (const [name, event] of Object.entries(manifest.events))
      schemas[`event-${name}.schema.json`] = event.schema;
    for (const [file, schema] of Object.entries(schemas)) {
      const path = `${target}/schemas/${file}`;
      expectedFiles.add(path);
      same(await readJson(path), schema, `schema ${path}`);
    }
    const profile = (await readJson(`${target}/target.json`)) as { overrides?: TargetOverride[] };
    if (!profile || !Array.isArray(profile.overrides) || profile.overrides.length > 1)
      throw new Error(`Packaged target profile is invalid: ${target}`);
    const override = profile.overrides[0];
    if (
      override &&
      (typeof override.rationale !== 'string' ||
        !override.defines ||
        typeof override.defines !== 'object' ||
        Array.isArray(override.defines) ||
        canonicalJson(Object.keys(override).sort()) !== canonicalJson(['defines', 'rationale']))
    )
      throw new Error(`Packaged target override is invalid: ${target}`);
    const expectedProfile = targetProfile(target, override);
    same(profile, expectedProfile, 'target profile');
    requireClean(
      manifest.capabilities.browserApis.filter(
        (api) => !(expectedProfile.browserApis as readonly string[]).includes(api),
      ),
      'Packaged unsupported browser capabilities',
    );
    for (const file of [
      `${manifest.componentId}.js`,
      `${manifest.componentId}.css`,
      'manifest.json',
      'adapter.json',
      'integration.md',
      'mentor-recipe.json',
      'licenses.txt',
      'target.json',
      'csp.json',
    ])
      expectedFiles.add(`${target}/${file}`);
    for (const asset of manifest.assets.filter((item) => !item.origin)) {
      const path = `${target}/${asset.path}`;
      if (expectedFiles.has(path) || asset.path.split('/').some((part) => !part || part === '.'))
        throw new Error(
          `Packaged asset collides with generated metadata or is not canonical: ${asset.path}`,
        );
      expectedFiles.add(path);
    }
    const sources = (type: string) =>
      [
        ...new Set(
          manifest.assets
            .filter((asset) => asset.type === type)
            .map((asset) => asset.origin ?? "'self'"),
        ),
      ].sort();
    same(
      await readJson(`${target}/csp.json`),
      {
        scriptSrc: [...new Set(["'self'", ...sources('script')])],
        styleSrc: [...new Set(["'self'", ...sources('style')])],
        imageSrc: sources('image'),
        fontSrc: sources('font'),
        workerSrc: sources('worker'),
        frameSrc: [],
        connectSrc: manifest.capabilities.networkOrigins,
        dependencies: manifest.dependencies.filter((item) => !item.bundled).map((item) => item.csp),
        findings: [],
      },
      'CSP declarations',
    );
    if (
      (await readFile(join(root, target, 'licenses.txt'), 'utf8')) !==
      (await readFile(join(root, 'shared/licenses.txt'), 'utf8'))
    )
      throw new Error('Packaged target license notices drift.');
  }
  same(Object.keys(actual).sort(), [...expectedFiles].sort(), 'payload file inventory');
  if (
    (await readFile(join(root, 'shared/types/index.d.ts'), 'utf8')) !==
    generateTypeDeclarations(commonManifest!)
  )
    throw new Error('Packaged TypeScript declarations drift.');
}

export async function proveReproducibility(
  root: string,
): Promise<{ first: BuiltRelease; second: BuiltRelease }> {
  const temp = await mkdtemp(join(tmpdir(), 'osai-reproduce-'));
  const first = await buildRelease(root, { outputRoot: join(temp, 'first') });
  const second = await buildRelease(root, { outputRoot: join(temp, 'second') });
  if (canonicalJson(first.checksums) !== canonicalJson(second.checksums))
    throw new Error(`Reproducibility failed in ${temp}`);
  return { first, second };
}
