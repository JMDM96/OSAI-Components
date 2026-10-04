import { defineConfig } from '@playwright/test';
import policy from './release-policy.json' with { type: 'json' };

const port = Number(process.env.OSAI_HARNESS_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid harness port.');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/browser',
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
  reporter: [['list'], ['json', { outputFile: 'test-results/browser.json' }]],
  outputDir: 'test-results/browser-artifacts',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
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
