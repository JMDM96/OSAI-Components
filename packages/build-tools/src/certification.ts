import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  canonicalJson,
  capabilityProfile,
  normalizeConfig,
  validateCertificationDescriptor,
} from '@osai/contract-schemas';
import type {
  ComponentManifest,
  CapabilityProfile,
  CertificationDescriptor,
} from '@osai/contract-schemas';
import { build } from 'esbuild';
import { containedPath } from './registry.js';
import type { RegisteredComponent } from './registry.js';
import { checksum } from './release.js';
import ts from 'typescript';

export const SUITE_VERSION = '2.0.0';
export const SHARED_SCENARIOS = [
  'lifecycle',
  'isolation',
  'contract',
  'accessibility',
  'security',
  'cleanup',
  'negative-listener',
  'negative-performance',
  'benchmark',
] as const;
export interface Certification {
  descriptor: CertificationDescriptor;
  profile: CapabilityProfile;
  scenarioModule: string;
  inventory: string[];
  contractHash: string;
  profileHash: string;
  descriptorHash: string;
  suiteHash: string;
}
export async function loadCertification(
  component: RegisteredComponent,
  root = process.cwd(),
): Promise<Certification> {
  const manifest = component.manifest;
  const descriptorFile = await containedPath(component.directory, 'certification.json');
  const rawDescriptor = JSON.parse(
    await readFile(descriptorFile, 'utf8'),
  ) as CertificationDescriptor;
  const profile = capabilityProfile(rawDescriptor.profile?.id);
  const validation = validateCertificationDescriptor(rawDescriptor, manifest, profile);
  if (!validation.value)
    throw new Error(`Invalid certification descriptor: ${JSON.stringify(validation.diagnostics)}`);
  const descriptor = validation.value;
  if (
    !normalizeConfig(manifest, descriptor.validConfiguration).ok ||
    descriptor.invalidConfigurations.some((config) => normalizeConfig(manifest, config).ok)
  )
    throw new Error('Certification requires valid and rejected configuration witnesses.');
  const scenarioModule = await containedPath(component.directory, descriptor.scenarioModule);
  const compiled = await build({
    entryPoints: [scenarioModule],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.text).toString('base64')}`
  )) as {
    scenarios: Record<string, unknown>;
  };
  if (
    canonicalJson(Object.keys(module.scenarios ?? {}).sort()) !==
      canonicalJson(descriptor.scenarios.map((scenario) => scenario.id).sort()) ||
    Object.values(module.scenarios).some((value) => typeof value !== 'function')
  )
    throw new Error('Scenario module must implement exactly the declared cases.');
  const inventory = [...new Set([...SHARED_SCENARIOS, ...profile.requiredScenarios])]
    .map((id) => `platform/${id}`)
    .concat(
      descriptor.scenarios
        .filter((scenario) => scenario.kind !== 'capability')
        .map((scenario) => `component/${scenario.id}`),
    );
  const suiteFiles = [
    'tests/browser/shared.spec.ts',
    'tests/browser-harness/observations.ts',
    'tests/browser-harness/preview.ts',
    'tests/browser-harness/server.ts',
    'tests/browser-harness/resource-document.ts',
    'playwright.config.ts',
    'tests/fixtures/negative/slow-input.ts',
    'packages/build-tools/src/certification.ts',
    'tests/browser/pipeline.spec.ts',
    'packages/build-tools/src/verify.ts',
  ];
  const suiteHash = checksum(
    canonicalJson(
      await Promise.all(
        suiteFiles.map(async (path) => [path, checksum(await readFile(join(root, path)))]),
      ),
    ),
  );
  return {
    descriptor,
    profile: JSON.parse(canonicalJson(profile)) as CapabilityProfile,
    scenarioModule,
    inventory,
    contractHash: checksum(canonicalJson(manifest)),
    profileHash: checksum(canonicalJson(profile)),
    descriptorHash: checksum(
      canonicalJson({ descriptor, source: await readFile(scenarioModule, 'utf8') }),
    ),
    suiteHash,
  };
}

export async function requiredInventory(
  root: string,
  certification: Certification,
): Promise<string[]> {
  if (certification.descriptor.componentId !== 'command-palette')
    return [...certification.inventory];
  const source = await readFile(join(root, 'tests/browser/pipeline.spec.ts'), 'utf8');
  const file = ts.createSourceFile('pipeline.spec.ts', source, ts.ScriptTarget.Latest, true);
  const titles: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'test'
    ) {
      const title = node.arguments[0];
      if (title && ts.isStringLiteralLike(title)) titles.push(`palette/${title.text}`);
      else if (title && ts.isTemplateExpression(title) && title.head.text === 'visual baseline: ') {
        let parent: ts.Node | undefined = node.parent;
        while (parent && !ts.isForOfStatement(parent)) parent = parent.parent;
        if (
          !parent ||
          !ts.isForOfStatement(parent) ||
          !ts.isArrayLiteralExpression(parent.expression)
        )
          throw new Error('Dynamic palette scenario inventory is unsupported.');
        for (const value of parent.expression.elements) {
          if (!ts.isStringLiteralLike(value))
            throw new Error('Palette visual state must be literal.');
          titles.push(`palette/visual baseline: ${value.text}`);
        }
      } else throw new Error('Unresolved palette test identifier.');
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!titles.length) throw new Error('Missing palette behavioral suite.');
  return [...certification.inventory, ...titles];
}
export function validateScenarioInventory(expected: string[], actual: string[]): void {
  if (
    new Set(actual).size !== actual.length ||
    canonicalJson([...expected].sort()) !== canonicalJson([...actual].sort())
  )
    throw new Error('Required scenario inventory is incomplete, duplicated or unexpected.');
}
export function validateObservations(
  manifest: ComponentManifest,
  observation: { workers: string[]; origins: string[]; portals: string[]; apis: string[] },
  assetUrls: Record<string, string>,
): void {
  if (
    observation.workers.some(
      (url) => !manifest.capabilities.workers.some((id) => assetUrls[id] === url),
    ) ||
    observation.origins.some((origin) => !manifest.capabilities.networkOrigins.includes(origin)) ||
    observation.portals.some(
      (selector) => !manifest.capabilities.portals.some((portal) => portal.selector === selector),
    ) ||
    observation.apis.some((api) => !manifest.capabilities.browserApis.includes(api))
  )
    throw new Error('Observed capability is not declared by the component.');
}
