import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { validateExecutionMetadata } from './visual-host.js';
import { resolve } from 'node:path';

import { visualHost, visualCollectionArguments } from './visual-host.js';

const args = process.argv.slice(2);
const collection = args[0] === 'collect';
const cliArgs = collection ? visualCollectionArguments(args.slice(1)) : args;
if (!collection && args.some((arg) => arg.startsWith('--update-snapshots') || arg === '-u'))
  throw new Error(
    'Use npm run test:visual:update for explicit reference collection. Ordinary runs never write references.',
  );
if (!collection && process.env.OSAI_VISUAL_COLLECTION)
  throw new Error('Use the explicit reference collection command.');

// Use Playwright's supported cache override before the CLI imports its registry.
// A caller can share the exact pinned cache across independent source workspaces.
const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? resolve('.cache/playwright');
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const child = spawn(process.execPath, [cli, ...cliArgs], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    PLAYWRIGHT_BROWSERS_PATH: cache,
    ...(collection ? { OSAI_VISUAL_COLLECTION: visualHost() } : {}),
  },
});
child.on('error', (error) => {
  console.error(`Browser tool could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
  if (
    code === 0 &&
    !collection &&
    args[0] === 'test' &&
    !args.includes('--list') &&
    process.env.OSAI_WORKBENCH === 'true'
  ) {
    try {
      const report = JSON.parse(readFileSync('test-results/workbench/browser.json', 'utf8'));
      validateExecutionMetadata(process.cwd(), report.config?.metadata?.execution);
      if (report.config?.updateSnapshots !== 'none')
        throw new Error('Workbench snapshot updates invalidate qualification.');
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }
});
