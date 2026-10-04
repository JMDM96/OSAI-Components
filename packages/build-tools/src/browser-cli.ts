import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Use Playwright's supported cache override before the CLI imports its registry.
// A caller can share the exact pinned cache across independent source workspaces.
const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? resolve('.cache/playwright');
const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: cache },
});
child.on('error', (error) => {
  console.error(`Browser tool could not start: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
