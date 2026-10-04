import { expect, it } from 'vitest';
import { qualificationMatrix, validateMatrixSummaries } from './ci-matrix.js';
import type { CompatibilityEvidence } from '@osai/adapter-schema';

it('includes every discovered production component plus explicit platform fixtures', async () => {
  const matrix = await qualificationMatrix(process.cwd());
  expect(matrix).toContainEqual({ component: 'command-palette', version: '2.0.0', fixture: '' });
  expect(matrix.filter((item) => item.fixture).map((item) => item.component)).toEqual([
    'minimal',
    'resources',
  ]);
});
it('rejects missing components, target/browser cells and reused sibling reports', () => {
  const matrix = [
    { component: 'first', version: '1.0.0', fixture: '' },
    { component: 'second', version: '1.0.0', fixture: '' },
  ];
  const reports = matrix.map((item) => ({
    componentId: item.component,
    version: item.version,
    status: 'browser-verified',
    records: ['odc', 'o11-reactive'].map((target) => ({
      componentId: item.component,
      version: item.version,
      target,
      status: 'browser-verified',
      browserResults: ['chromium', 'firefox', 'webkit'].map((browser) => ({
        browser,
        passed: 12,
        failed: 0,
        skipped: 0,
      })),
    })) as CompatibilityEvidence[],
  }));
  const check = (value: typeof reports) =>
    validateMatrixSummaries(
      matrix,
      value,
      ['odc', 'o11-reactive'],
      ['chromium', 'firefox', 'webkit'],
    );
  expect(() => check(reports)).not.toThrow();
  expect(() => check(reports.slice(1))).toThrow();
  for (const mutation of [
    (value: typeof reports) => value[1]!.records.pop(),
    (value: typeof reports) => value[1]!.records[0]!.browserResults.pop(),
    (value: typeof reports) => {
      value[1]!.records = value[0]!.records;
    },
  ]) {
    const copy = structuredClone(reports);
    mutation(copy);
    expect(() => check(copy)).toThrow();
  }
});
