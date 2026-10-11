import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { generatePreviewSuite, evaluatePreview } from './native-preview.js';
import type { ComponentManifest } from '@osai/contract-schemas';
it('covers every declared member, distinct rejection paths and native modal sequences', async () => {
  const manifest = JSON.parse(
    await readFile('components/command-palette/component.manifest.json', 'utf8'),
  ) as ComponentManifest;
  const suite = generatePreviewSuite(manifest);
  for (const [kind, members] of [
    ['command', manifest.commands],
    ['event', manifest.events],
  ] as const)
    for (const name of Object.keys(members))
      expect(suite.cases.some((c) => c.id === `${kind}:${name}`)).toBe(true);
  expect(suite.cases.find((c) => c.id === 'close-while-open')!.entry).toContain(
    'await opened Block event → Command_close',
  );
  const context = {
    planDigest: 'plan',
    platformVersion: 'synthetic',
    appKey: 'a',
    envKey: 'e',
    deployedRevision: 'r1',
    expectedRevision: 'r1',
    observedAt: '2026-10-08T00:00:00Z',
    exactPackage: 'mismatched' as const,
  };
  const results = suite.cases.map((c) => ({
    caseId: c.id,
    status: 'passed' as const,
    entry: c.entry,
    evidence: ['capture'],
    observations: c.expectations.map(() => 'observed synthetic case'),
  }));
  expect(evaluatePreview(suite, results, context)).toMatchObject({
    previewPassed: true,
    exactPackage: 'mismatched',
    nativeQualified: false,
  });
  expect(
    evaluatePreview(
      suite,
      results.filter((r) => r.caseId !== 'bridge-rejected'),
      context,
    ).previewPassed,
  ).toBe(false);
  expect(
    evaluatePreview(suite, results, { ...context, platformVersion: undefined }).previewPassed,
  ).toBe(false);
  expect(evaluatePreview(suite, results, { ...context, deployedRevision: 'old' }).issues).toContain(
    'old-deployment',
  );
  results.find((r) => r.caseId === 'bridge-rejected')!.entry =
    'Native sample Apply with malformed JSON';
  expect(evaluatePreview(suite, results, context).previewPassed).toBe(false);
});
