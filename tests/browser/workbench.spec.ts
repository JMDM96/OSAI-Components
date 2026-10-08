import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import type { ObservationSnapshot } from '../browser-harness/observations.js';

test.beforeEach(async ({ page }, info) => {
  await page.goto(`/?component=resources&target=${String(info.project.metadata.target)}#workspace`);
  await expect(page.locator('html')).toHaveAttribute('data-workbench-ready', 'true');
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-ready', 'true');
});

test('palette preview explains creation and selects its opening command', async ({
  page,
}, info) => {
  await page.goto(
    `/?component=command-palette&target=${String(info.project.metadata.target)}#workspace`,
  );
  await expect(page.locator('#message')).toHaveText(
    'Package loaded. Click Create, then Invoke the open command to show the component.',
  );
  await expect(page.locator('#command')).toHaveValue('open');
  const dialog = page.frameLocator('iframe').getByRole('dialog');
  await expect(dialog).toHaveCount(0);
  await page.locator('#create').click();
  await expect(page.locator('#message')).toHaveText(
    'Instance created. Select open and click Invoke to show the component.',
  );
  await expect(dialog).toBeHidden();
  await page.locator('#invoke').click();
  await expect(dialog).toBeVisible();
  await expect(page.frameLocator('iframe').getByRole('option', { name: 'One' })).toBeVisible();
  await page.locator('#dispose').click();
  await expect(page.locator('#message')).toHaveText(
    'Instance disposed. Click Create to preview it again.',
  );
  await expect(dialog).toHaveCount(0);
  await page.locator('#create').click();
  await page.locator('#invoke').click();
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: info.outputPath('palette-preview-open.png'), fullPage: true });
});

test('navigation is functional, keyboard accessible and survives deep-link reload', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Component library', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#library')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Component library', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.locator('#workspace')).toBeHidden();
  await page.reload();
  await expect(page.locator('#library')).toBeVisible();
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.locator('#activity')).toBeVisible();
  await expect(page.locator('#library')).toBeHidden();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('switching component and target disposes prior ownership and isolates styles', async ({
  page,
}, info) => {
  const baseline = await page.evaluate(() =>
    document.querySelector('iframe')!.contentWindow!.observations.snapshot(),
  );
  await page.evaluate(() => {
    window.addEventListener('message', (event) => {
      if (
        event.source === document.querySelector('iframe')?.contentWindow &&
        event.data?.source === 'osai-preview' &&
        event.data.result?.operation === 'reset'
      )
        (window as Window & { priorCleanup?: unknown }).priorCleanup = event.data.result.cleanup;
    });
  });
  await page.locator('#create').click();
  await expect(page.frameLocator('iframe').locator('output')).toHaveText('Ready');
  await page.locator('#component').selectOption('command-palette');
  await page.locator('#load').click();
  await expect(page.locator('iframe')).toHaveAttribute(
    'title',
    `command-palette 2.0.0 ${String(info.project.metadata.target)}`,
  );
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-ready', 'true');
  const old = await page.evaluate(() => {
    return (
      window as Window & {
        priorCleanup?: {
          info: { instances: number; resources: Record<string, number> };
          observed: ObservationSnapshot;
        };
      }
    ).priorCleanup!;
  });
  expect(old.info.instances).toBe(0);
  expect(Object.values(old.info.resources).every((value) => value === 0)).toBe(true);
  for (const key of ['listeners', 'timers', 'animationFrames', 'observers', 'workers', 'portals'])
    expect(old.observed[key as keyof typeof old.observed]).toBe(
      baseline[key as keyof typeof baseline],
    );
  await info.attach('preview-switch-cleanup', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({ baseline, disposed: old })),
  });
  expect(
    await page
      .frameLocator('iframe')
      .locator('link')
      .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href)),
  ).not.toEqual(expect.arrayContaining([expect.stringMatching(/\/resources\.css$/)]));
  await page
    .locator('#target')
    .selectOption(info.project.metadata.target === 'odc' ? 'o11-reactive' : 'odc');
  await page.locator('#load').click();
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-ready', 'true');
  await page.locator('#version').fill('999.0.0');
  await page.locator('#load').click();
  await expect(page.locator('#readiness')).toHaveText('Unavailable');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('forms and JSON preserve valid state, redact bounded activity and reset the session', async ({
  page,
}) => {
  await page.locator('#create').click();
  const output = page.frameLocator('iframe').locator('output');
  await expect(output).toHaveText('Ready');
  await page.locator('#fields').getByLabel('label', { exact: true }).fill('Changed');
  await page.locator('#configuration').focus();
  await page.locator('#update').click();
  await expect(output).toHaveText('Changed');
  await page.locator('#configuration').fill('{');
  await page.locator('#update').click();
  await expect(page.locator('#message')).toContainText('Invalid JSON');
  await expect(output).toHaveText('Changed');
  await page.locator('#configuration').fill('{"label":42}');
  await page.locator('#update').click();
  await expect(page.locator('#message')).toContainText('Operation rejected');
  await expect(output).toHaveText('Changed');
  await page.locator('#command').selectOption('start');
  await page.locator('#arguments').fill('{"value":"Bearer secret-do-not-export"}');
  await page.locator('#invoke').click();
  await expect(output).toHaveText('Bearer secret-do-not-export');
  await page.evaluate(() => {
    const frame = document.querySelector('iframe')!.contentWindow!;
    for (let count = 0; count < 70; count++)
      frame.postMessage(
        { source: 'osai-workbench', operation: 'invoke', command: 'read', args: {} },
        location.origin,
      );
  });
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.locator('#activity-list li')).toHaveCount(100);
  await expect(page.locator('#truncation')).toContainText('earlier entries removed');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  const exported = await readFile((await download.path())!, 'utf8');
  expect(exported).not.toContain('secret-do-not-export');
  expect(JSON.parse(exported).redacted).toBe(true);
  await page.locator('#reset').click();
  await expect(page.locator('#truncation')).toHaveText('No earlier entries removed.');
  await expect(page.locator('#activity-list li')).toHaveCount(2);
  await expect(page.locator('#activity-list li').first()).toContainText('1 ·');
  await expect(page.locator('#activity-list li').last()).toContainText('2 ·');
});

test('serves only selected graph paths and refuses traversal or absent releases', async ({
  request,
}, info) => {
  const base = `/artifacts/resources/1.0.0/${String(info.project.metadata.target)}/`;
  for (const path of ['workers/local.js', 'assets/fonts/fixture.woff', 'assets/images/pixel.png'])
    expect((await request.get(base + path)).status()).toBe(200);
  expect((await request.get(base + 'private.txt')).status()).toBe(404);
  expect((await request.get('/artifacts/unknown/1.0.0/odc/unknown.js')).status()).toBe(404);
  expect((await request.get('/artifacts/resources/999.0.0/odc/resources.js')).status()).toBe(404);
  expect((await request.get(base + '%2e%2e%2fpackage.json')).status()).toBe(400);
  const infoResponse = await request.get(
    `/metadata?component=resources&target=${String(info.project.metadata.target)}`,
  );
  expect(['generated', 'missing', 'stale', 'browser-verified']).toContain(
    (await infoResponse.json()).status,
  );
});

for (const view of ['library', 'workspace', 'activity'])
  test(`workbench visual: ${view}`, { tag: '@visual' }, async ({ page }) => {
    // Fix only the readiness state for layout snapshots. A mask still changes size
    // with the real evidence label; readiness semantics have separate gate tests.
    await page.route('**/metadata?*', async (route) => {
      const response = await route.fetch();
      const metadata = (await response.json()) as Record<string, unknown>;
      await route.fulfill({ response, json: { ...metadata, status: 'generated' } });
    });
    await page.goto(`/?component=resources#${view}`);
    await expect(page.locator('html')).toHaveAttribute('data-workbench-ready', 'true');
    await expect(page.locator('#message')).toHaveText(
      'Package loaded. Create an instance to begin.',
    );
    await expect(page).toHaveScreenshot(`workbench/${view}.png`, {
      fullPage: true,
      mask: [page.locator('#readiness')],
    });
  });
