import { defineConfig } from '@playwright/test';
import policy from './release-policy.json' with { type: 'json' };

import {
  executionMetadata,
  snapshotTemplate,
  visualHost,
  assertReviewedReferences,
} from './packages/build-tools/src/visual-host.js';

const host = visualHost();
const collection = process.env.OSAI_VISUAL_COLLECTION === host;
if (process.env.OSAI_VISUAL_COLLECTION && !collection)
  throw new Error('Reference collection cannot target another host.');
if (!collection) assertReviewedReferences(process.cwd(), host);

const port = Number(process.env.OSAI_HARNESS_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid harness port.');
const baseURL = `http://127.0.0.1:${port}`;

const reportName =
  process.env.OSAI_WORKBENCH === 'true'
    ? 'workbench'
    : (process.env.OSAI_COMPONENT ?? 'command-palette');
const reportDirectory = collection
  ? `test-results/reference-collection/${host}/${reportName}`
  : `test-results/${reportName}`;

export default defineConfig({
  metadata: { execution: executionMetadata(process.cwd(), collection) },
  updateSnapshots: collection ? 'all' : 'none',
  testDir: './tests/browser',
  testMatch:
    process.env.OSAI_WORKBENCH === 'true'
      ? ['workbench.spec.ts']
      : process.env.OSAI_COMPONENT && process.env.OSAI_COMPONENT !== 'command-palette'
        ? ['shared.spec.ts']
        : ['pipeline.spec.ts', 'shared.spec.ts'],
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixels: policy.visual.maxDiffPixels,
      threshold: policy.visual.threshold,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile: `${reportDirectory}/browser.json`,
      },
    ],
  ],
  outputDir: `${reportDirectory}/browser-artifacts`,
  snapshotPathTemplate: snapshotTemplate(host),
  use: {
    baseURL,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: policy.targets.flatMap((target) =>
    policy.browsers.map((browserName) => ({
      name: `${target}-${browserName}`,
      use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit' },
      metadata: { target },
    })),
  ),
  webServer: {
    command: 'npm run preview',
    url: `${baseURL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
