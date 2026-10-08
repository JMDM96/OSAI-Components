import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import policy from '../../release-policy.json' with { type: 'json' };
import type { Harness } from '../browser-harness/client.js';
import type { JsonObject } from '@osai/contract-schemas';
import type { ComponentDefinition, ComponentManifest } from '@osai/component-sdk';
import type { RuntimeBridge } from '../../packages/runtime-bridge/src/index.js';

import { SUITE_VERSION as suiteVersion } from '../../packages/build-tools/src/certification.js';
const gates = (...names: string[]): void => {
  for (const name of names) test.info().annotations.push({ type: 'gate', description: name });
};
const targetOf = (info: TestInfo): string => String(info.project.metadata.target);
const invoke = (page: Page, command: string, id = 'demo') =>
  page.evaluate(({ id, command }) => window.harness.command(id, command), { id, command });
const stateEvents = (page: Page) =>
  page.evaluate(() => window.harness.events.map((event) => event.value as JsonObject));
const open = async (page: Page) => {
  expect((await invoke(page, 'open')).ok).toBe(true);
  await expect(page.getByRole('dialog')).toBeVisible();
};
const selectedId = (page: Page) =>
  page.locator('[role="option"][aria-selected="true"]').getAttribute('data-command-id');

test.beforeEach(async ({ page }, info) => {
  await page.goto(`/palette?target=${targetOf(info)}`);
  await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
});
test.afterEach(async ({ page, browser, request }, info) => {
  const metadata = await (await request.get(`/metadata?target=${targetOf(info)}`)).json();
  await info.attach('compatibility-evidence', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        suiteVersion,
        policyVersion: policy.policyVersion,
        target: targetOf(info),
        browser: info.project.use.browserName,
        browserVersion: browser.version(),
        artifactChecksum: metadata.files['command-palette.js'],
        artifacts: metadata.files,
        gates: info.annotations.filter((a) => a.type === 'gate').map((a) => a.description),
      }),
    ),
  });
  await info.attach('scenario-evidence', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        schemaVersion: '2.0',
        scenarioId: `palette/${info.title}`,
        componentId: metadata.manifest.componentId,
        version: metadata.manifest.version,
        target: targetOf(info),
        browser: info.project.use.browserName,
        browserVersion: browser.version(),
        suiteVersion,
        contractHash: metadata.certification.contractHash,
        profileHash: metadata.certification.profileHash,
        descriptorHash: metadata.certification.descriptorHash,
        suiteHash: metadata.certification.suiteHash,
        policyHash: metadata.policyHash,
        artifactChecksums: metadata.artifactChecksums,
        passed: info.status === 'passed',
      }),
    ),
  });
  if (!page.isClosed()) await page.evaluate(() => window.harness?.reset());
});

test('Required Scripts expose the bridge under restrictive CSP', async ({ page }) => {
  gates('browser', 'csp');
  const response = await page.request.get('/');
  expect(response.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response.headers()['content-security-policy']).not.toContain('unsafe-');
  const initial = await page.evaluate(() => window.harness.info());
  expect(initial.instances).toBe(1);
  await open(page);
  await page.getByRole('combobox').fill('settings');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await page.evaluate(() => window.harness.violations)).toEqual([]);
});

test('Ready, repeated Render, Parameters Changed, and Destroy preserve the lifecycle', async ({
  page,
}) => {
  gates('browser', 'lifecycle');
  const before = await page.evaluate(() => window.harness.info());
  const repeated = await page.evaluate(() =>
    Array.from({ length: 5 }, () => window.harness.render('demo', window.harness.config)),
  );
  expect(repeated.every((result) => result.code === 'unchanged')).toBe(true);
  expect((await page.evaluate(() => window.harness.info())).resources).toEqual(before.resources);
  await open(page);
  const identity = await page.locator('[data-osai-instance="demo"]').evaluate((element) => {
    element.setAttribute('data-test-identity', 'preserved');
    return element.getAttribute('data-osai-instance');
  });
  expect(identity).toBe('demo');
  expect(
    (
      await page.evaluate(() =>
        window.harness.render('demo', {
          commands: [{ id: 'updated', label: 'Updated from Parameters Changed' }],
        }),
      )
    ).ok,
  ).toBe(true);
  await expect(page.getByRole('option')).toHaveText('Updated from Parameters Changed');
  await expect(page.locator('[data-osai-instance="demo"]')).toHaveAttribute(
    'data-test-identity',
    'preserved',
  );
  await page.evaluate(() => window.harness.destroy('demo', true));
  expect((await page.evaluate(() => window.harness.info())).instances).toBe(0);
  expect(await page.locator('[data-osai-component]').count()).toBe(0);
  expect((await page.evaluate(() => window.harness.destroy())).ok).toBe(true);
});

test('repeated open, close and toggle calls keep one surface and an ordered event sequence', async ({
  page,
}) => {
  gates('browser', 'lifecycle');
  const before = await page.evaluate(() => window.harness.info().resources.listeners);
  await page.evaluate(() => {
    window.harness.command('demo', 'open');
    window.harness.command('demo', 'open');
  });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByRole('combobox').fill('project');
  await page.evaluate(() => {
    window.harness.command('demo', 'close');
    window.harness.command('demo', 'close');
    window.harness.command('demo', 'toggle');
  });
  await expect(page.getByRole('combobox')).toHaveValue('');
  await page.evaluate(() => window.harness.command('demo', 'toggle'));
  await expect
    .poll(async () => (await stateEvents(page)).map((event) => event.eventName))
    .toEqual(['opened', 'queryChanged', 'closed', 'opened', 'closed']);
  expect(await page.evaluate(() => window.harness.info().resources.listeners)).toBe(before);
  expect(
    await page.locator('[data-osai-instance="demo"] .osai-command-palette-overlay').count(),
  ).toBe(1);
});

test('failed creation leaves no registry or DOM and the same identifier can be retried', async ({
  page,
}) => {
  gates('browser', 'lifecycle');
  const checks = await page.evaluate(() => {
    const harness = window.harness;
    harness.reset();
    const host = document.createElement('div');
    host.id = 'invalid-host';
    document.body.append(host);
    const api = harness.api;
    const malformed = JSON.parse(api.create('command-palette', 'candidate', host.id, '{invalid'));
    const schema = JSON.parse(
      api.create('command-palette', 'candidate', host.id, '{"commands":[{"id":"missing-label"}]}'),
    );
    const afterFailure = harness.info();
    const empty = host.childElementCount === 0;
    const retry = JSON.parse(
      api.create('command-palette', 'candidate', host.id, '{"commands":[]}'),
    );
    const claimed = JSON.parse(
      api.create('command-palette', 'different', host.id, '{"commands":[]}'),
    );
    const missing = JSON.parse(
      api.create('command-palette', 'missing', 'absent-host', '{"commands":[]}'),
    );
    api.dispose('candidate');
    host.remove();
    return { malformed, schema, afterFailure, empty, retry, claimed, missing };
  });
  expect(checks.malformed.code).toBe('invalid-json');
  expect(checks.schema.code).toBe('validation-error');
  expect(checks.afterFailure.instances).toBe(0);
  expect(checks.empty).toBe(true);
  expect(checks.retry.ok).toBe(true);
  expect(checks.claimed.code).toBe('container-claimed');
  expect(checks.missing.code).toBe('missing-container');
});

test('updates, commands and callbacks address only their own instance', async ({ page }) => {
  gates('multi-instance', 'browser', 'lifecycle');
  await page.evaluate(() =>
    window.harness.ready('sibling', {
      commands: [{ id: 'sibling-only', label: 'Sibling command' }],
    }),
  );
  const before = await page.locator('[data-osai-instance="sibling"]').innerHTML();
  await page.evaluate(() => {
    window.harness.render('demo', { commands: [{ id: 'changed', label: 'Changed command' }] });
    window.harness.command('demo', 'open');
  });
  expect(await page.locator('[data-osai-instance="sibling"]').innerHTML()).toBe(before);
  await expect.poll(async () => (await stateEvents(page)).length).toBe(1);
  expect((await stateEvents(page)).every((event) => event.instanceId === 'demo')).toBe(true);
  await page.evaluate(() => window.harness.destroy('demo', true));
  expect((await page.evaluate(() => window.harness.info())).instances).toBe(1);
  await invoke(page, 'open', 'sibling');
  await expect(page.getByRole('option')).toHaveText('Sibling command');
});

test('keyboard navigation wraps, skips disabled items, selects once, and restores focus', async ({
  page,
}) => {
  gates('keyboard', 'accessibility', 'browser');
  await page.getByRole('button', { name: 'Open command palette' }).focus();
  await page.getByRole('button', { name: 'Open command palette' }).click();
  const input = page.getByRole('combobox');
  await expect(input).toBeFocused();
  expect(await selectedId(page)).toBe('new-project');
  await page.keyboard.press('ArrowUp');
  expect(await selectedId(page)).toBe('settings');
  await page.keyboard.press('ArrowDown');
  expect(await selectedId(page)).toBe('new-project');
  await page.keyboard.press('End');
  expect(await selectedId(page)).toBe('settings');
  await page.keyboard.press('Home');
  expect(await selectedId(page)).toBe('new-project');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  expect(await selectedId(page)).toBe('settings');
  await expect(input).toHaveAttribute(
    'aria-activedescendant',
    (await page.locator('[aria-selected="true"]').getAttribute('id')) as string,
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeFocused();
  await expect
    .poll(
      async () => (await stateEvents(page)).filter((e) => e.eventName === 'commandSelected').length,
    )
    .toBe(1);
  const selection = (await stateEvents(page)).find((e) => e.eventName === 'commandSelected');
  expect(selection?.payload).toMatchObject({
    instanceId: 'demo',
    commandId: 'settings',
    query: '',
    source: 'keyboard',
  });
});

test('query filtering is normalized, ordered, announced, and safe during composition', async ({
  page,
}) => {
  gates('browser', 'keyboard', 'accessibility');
  await page.evaluate(() =>
    window.harness.render('demo', {
      commands: [
        { id: 'a', label: 'ＣＡＦＥ', keywords: ['alpha'] },
        { id: 'b', label: 'Cafeteria', disabled: true },
        { id: 'c', label: 'Other', keywords: ['cafe'] },
      ],
    }),
  );
  await open(page);
  const input = page.getByRole('combobox');
  await input.fill(' CaFe ');
  expect(
    await page
      .getByRole('option')
      .evaluateAll((options) => options.map((option) => option.getAttribute('data-command-id'))),
  ).toEqual(['a', 'b', 'c']);
  await expect(page.locator('.osai-command-palette-count')).toHaveText('3 commands');
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await input.dispatchEvent('compositionend');
  await input.fill('nothing-matches');
  await expect(page.locator('.osai-command-palette-count')).toContainText('0 commands.');
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect((await stateEvents(page)).filter((e) => e.eventName === 'commandSelected')).toEqual([]);
  await page.evaluate(() =>
    window.harness.render('demo', {
      commands: [{ id: 'disabled-only', label: 'Unavailable', disabled: true }],
    }),
  );
  await input.fill('');
  for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter']) await input.press(key);
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  expect((await stateEvents(page)).filter((e) => e.eventName === 'commandSelected')).toEqual([]);
  await page.evaluate(() =>
    window.harness.render('demo', {
      commands: [
        { id: 'a', label: 'First' },
        { id: 'b', label: 'Second' },
        { id: 'c', label: 'Third' },
      ],
    }),
  );
  await input.fill('  ');
  await expect(page.getByRole('option')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await open(page);
  await expect(input).toHaveValue('');
});

test('pointer and touch-style activation rejects disabled items and rapid duplicate clicks', async ({
  page,
}) => {
  gates('browser');
  await open(page);
  await page.getByRole('option', { name: /Manage billing/ }).dispatchEvent('click');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await stateEvents(page)).filter((e) => e.eventName === 'commandSelected')).toEqual([]);
  await page.getByRole('option', { name: /Find a project/ }).evaluate((option) => {
    option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    option.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect
    .poll(
      async () => (await stateEvents(page)).filter((e) => e.eventName === 'commandSelected').length,
    )
    .toBe(1);
  expect(
    (await stateEvents(page)).find((e) => e.eventName === 'commandSelected')?.payload,
  ).toMatchObject({ commandId: 'find-project', source: 'pointer' });
});

test('live updates retain eligible active state and invalid payloads are atomic', async ({
  page,
}) => {
  gates('browser', 'lifecycle');
  await open(page);
  await page.getByRole('combobox').fill('project');
  await page.keyboard.press('ArrowDown');
  expect(await selectedId(page)).toBe('find-project');
  const before = await page.locator('[data-osai-instance="demo"]').innerHTML();
  const invalid = await page.evaluate(() => [
    JSON.parse(window.harness.api.update('demo', '{invalid')),
    window.harness.render('demo', {
      commands: [
        { id: 'duplicate', label: 'One' },
        { id: 'duplicate', label: 'Two' },
      ],
    }),
    window.harness.render('demo', { commands: [{ id: 'bad' }] }),
  ]);
  expect(invalid.every((result) => !result.ok)).toBe(true);
  expect(await page.locator('[data-osai-instance="demo"]').innerHTML()).toBe(before);
  await page.evaluate(() =>
    window.harness.render('demo', {
      commands: [
        { id: 'find-project', label: 'Find another project' },
        { id: 'third', label: 'Third project' },
      ],
    }),
  );
  await expect(page.getByRole('combobox')).toHaveValue('project');
  expect(await selectedId(page)).toBe('find-project');
  await page.evaluate(() =>
    window.harness.render('demo', { commands: [{ id: 'third', label: 'Third project' }] }),
  );
  expect(await selectedId(page)).toBe('third');
  await page.evaluate(() => window.harness.render('demo', { commands: [] }));
  await expect(page.getByRole('option')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('host strings remain literal text throughout every presentation field', async ({ page }) => {
  gates('browser', 'csp');
  const text = '<img src=x onerror="window.injected=true">';
  await page.evaluate(
    (text) =>
      window.harness.render('demo', {
        commands: [
          {
            id: text,
            label: text,
            description: text,
            keywords: [text],
            group: text,
            metadata: { hint: text },
          },
        ],
        title: text,
        placeholder: text,
        emptyMessage: text,
      }),
    text,
  );
  await open(page);
  await expect(page.getByRole('option')).toContainText(text);
  expect(
    await page
      .locator(
        '[data-osai-component] img,[data-osai-component] script,[data-osai-component] [onerror]',
      )
      .count(),
  ).toBe(0);
  expect(await page.evaluate(() => Reflect.get(window, 'injected'))).toBeUndefined();
});

test('focus trap, background locks, restoration fallback and announcements are accessible', async ({
  page,
}) => {
  gates('accessibility', 'keyboard');
  await page.getByRole('button', { name: 'Open command palette' }).focus();
  await page.getByRole('button', { name: 'Open command palette' }).click();
  await expect(page.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Command palette');
  await expect(page.locator('#background')).toHaveAttribute('inert', '');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close command palette' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Close command palette' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('combobox')).toBeFocused();
  await expect(page.locator('.osai-command-palette-count')).toHaveAttribute('aria-live', 'polite');
  await page.evaluate(() => {
    document.getElementById('open-palette')?.remove();
    document.getElementById('host-demo')!.tabIndex = 0;
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#host-demo')).toBeFocused();
  await expect(page.locator('#background')).not.toHaveAttribute('inert');
  await page.evaluate(() => {
    document.getElementById('host-demo')!.tabIndex = -1;
    const trigger = document.createElement('button');
    trigger.id = 'temporary-trigger';
    trigger.textContent = 'Temporary trigger';
    document.body.append(trigger);
    trigger.focus();
  });
  await open(page);
  await page.evaluate(() => document.getElementById('temporary-trigger')?.remove());
  await page.keyboard.press('Escape');
  await expect(page.locator('#host-demo')).toBeFocused();
  await page.evaluate(() => {
    document.getElementById('host-demo')!.removeAttribute('tabindex');
    const trigger = document.createElement('button');
    trigger.id = 'temporary-trigger';
    trigger.textContent = 'Temporary trigger';
    document.body.append(trigger);
    trigger.focus();
  });
  await open(page);
  await page.evaluate(() => document.getElementById('temporary-trigger')?.remove());
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('automated WCAG 2.2 A/AA checks pass in closed, open and empty states', async ({
  page,
}, info) => {
  gates('accessibility');
  const measurements = [];
  for (const state of ['closed', 'open', 'empty']) {
    if (state === 'open') await open(page);
    if (state === 'empty') await page.getByRole('combobox').fill('absent-from-all-commands');
    const results = await new AxeBuilder({ page }).withTags(policy.accessibility.axeTags).analyze();
    measurements.push({
      state,
      violations: results.violations.length,
      incomplete: results.incomplete.length,
    });
    expect(results.violations).toEqual([]);
  }
  await info.attach('accessibility-measurements', {
    contentType: 'application/json',
    body: Buffer.from(
      JSON.stringify({
        standard: policy.accessibility.standard,
        violations: measurements.reduce((sum, measurement) => sum + measurement.violations, 0),
        measurements,
      }),
    ),
  });
});

test('narrow, 200 percent CSS zoom, RTL and reduced motion remain operable', async ({ page }) => {
  gates('accessibility', 'theme', 'rtl', 'keyboard');
  await page.setViewportSize({ width: 320, height: 720 });
  await open(page);
  const checkBounds = async () => {
    const dialog = await page.getByRole('dialog').boundingBox();
    expect(dialog).not.toBeNull();
    expect(dialog!.x).toBeGreaterThanOrEqual(0);
    expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(321);
    expect(
      await page
        .getByRole('dialog')
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
    await expect(page.getByRole('combobox')).toBeVisible();
  };
  await checkBounds();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add('test-zoom'));
  await open(page);
  const zoomedDialog = await page.getByRole('dialog').boundingBox();
  expect(zoomedDialog!.y + zoomedDialog!.height).toBeLessThanOrEqual(1001);
  await expect(page.getByRole('button', { name: 'Close command palette' })).toBeVisible();
  await page.keyboard.press('End');
  expect(
    await page.locator('[aria-selected="true"]').evaluate((element) => {
      const list = element.closest('[role="listbox"]')!;
      return element.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom + 1;
    }),
  ).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('2');
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.evaluate(() => {
    document.documentElement.classList.remove('test-zoom');
    document.documentElement.dir = 'rtl';
  });
  await open(page);
  expect(
    await page.getByRole('dialog').evaluate((element) => getComputedStyle(element).direction),
  ).toBe('rtl');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page.getByRole('dialog').evaluate((element) => ({
      animation: getComputedStyle(element).animationName,
      transition: getComputedStyle(element).transitionDuration,
    })),
  ).toEqual({ animation: 'none', transition: '0s' });
  await page.keyboard.press('Escape');
});

test('scoped tokens inherit host theme without changing sibling instances', async ({ page }) => {
  gates('theme', 'multi-instance');
  await page.evaluate(() => {
    document.body.classList.add('outsystems-theme');
    document.getElementById('host-demo')!.classList.add('test-theme');
    window.harness.ready('other', { commands: [] });
  });
  await open(page);
  const first = await page
    .locator('[data-osai-instance="demo"] [role="dialog"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(first).toBe('rgb(241, 248, 255)');
  await invoke(page, 'close');
  await invoke(page, 'open', 'other');
  const second = await page
    .locator('[data-osai-instance="other"] [role="dialog"]')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(second).toBe('rgb(255, 255, 255)');
});

test('shortcut collisions transfer to the earliest remaining instance and ignore editing', async ({
  page,
}) => {
  gates('multi-instance', 'keyboard', 'lifecycle');
  await page.evaluate(() => {
    window.harness.ready('second', window.harness.config);
    window.harness.ready('third', window.harness.config);
  });
  const info = await page.evaluate(() => window.harness.info());
  expect(info.diagnostics.filter((item) => item.code === 'shortcut-conflict')).toHaveLength(2);
  await page.locator('#outside-input').focus();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#open-palette').focus();
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-osai-instance="demo"] [role="dialog"]')).toBeVisible();
  await page.evaluate(() => window.harness.destroy('demo', true));
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-osai-instance="second"] [role="dialog"]')).toBeVisible();
  await page.evaluate(() =>
    window.harness.render('second', { ...window.harness.config, shortcut: 'Control+J' }),
  );
  await invoke(page, 'close', 'second');
  await page.keyboard.press('Control+k');
  await expect(page.locator('[data-osai-instance="third"] [role="dialog"]')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('duplicate packaged scripts preserve registry and callback ownership', async ({
  page,
}, info) => {
  gates('browser', 'multi-instance', 'lifecycle');
  await open(page);
  const before = await page.evaluate(() => {
    Reflect.set(window, 'originalBridge', window.harness.api);
    return window.harness.info();
  });
  await page.addScriptTag({ url: `/artifacts/${targetOf(info)}/command-palette.js` });
  expect(
    await page.evaluate(() => window.OSAI.Components.v1 === Reflect.get(window, 'originalBridge')),
  ).toBe(true);
  const after = await page.evaluate(() => window.harness.info());
  expect(after.instances).toBe(before.instances);
  expect(after.subscriptions).toBe(before.subscriptions);
  expect(after.resources.listeners).toBe(before.resources.listeners);
  expect((await page.evaluate(() => window.harness.ready())).code).toBe('duplicate-instance');
  await page.keyboard.press('Escape');
  await expect
    .poll(async () => (await stateEvents(page)).filter((e) => e.eventName === 'closed').length)
    .toBe(1);
});

test('callback failures, unsubscription and disposal cancel pending deliveries', async ({
  page,
}) => {
  gates('multi-instance', 'lifecycle', 'browser');
  await page.evaluate(() => {
    const api = window.harness.api;
    api.registerCallback('demo', 'opened', () => {
      throw new Error('PRIVATE_CALLBACK_DETAILS');
    });
    api.registerCallback('demo', 'opened', () => {
      Reflect.set(window, 'callbackAfterThrow', true);
    });
    const transient = JSON.parse(
      api.registerCallback('demo', 'opened', () => {
        Reflect.set(window, 'unsubscribedCalled', true);
      }),
    );
    window.harness.command('demo', 'open');
    api.unregisterCallback('demo', transient.value.subscriptionId);
  });
  await expect
    .poll(async () => (await stateEvents(page)).filter((e) => e.eventName === 'opened').length)
    .toBe(1);
  const diagnostics = (await page.evaluate(() => window.harness.info())).diagnostics;
  expect(diagnostics.some((item) => item.code === 'callback-error')).toBe(true);
  expect(JSON.stringify(diagnostics)).not.toContain('PRIVATE_CALLBACK_DETAILS');
  expect(await page.evaluate(() => Reflect.get(window, 'unsubscribedCalled'))).toBeUndefined();
  expect(await page.evaluate(() => Reflect.get(window, 'callbackAfterThrow'))).toBe(true);
  await page.evaluate(() => {
    window.harness.command('demo', 'close');
    window.harness.events.length = 0;
    window.harness.command('demo', 'open');
    window.harness.destroy('demo', true);
  });
  await page.waitForTimeout(20);
  expect(await stateEvents(page)).toEqual([]);
});

test('overlapping navigation, conditional removal and 100 cycles leave no resources', async ({
  page,
}, info) => {
  gates('leaks', 'lifecycle', 'multi-instance');
  const measured = await page.evaluate((cycles) => {
    const harness = window.harness;
    harness.reset();
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const id = `cycle-${cycle}`;
      const created = harness.ready(id, harness.config);
      if (!created.ok) throw new Error('Cycle create failed.');
      harness.command(id, 'open');
      harness.render(id, { ...harness.config, title: `Cycle ${cycle}` });
      const newer = `${id}-next`;
      harness.ready(newer, { commands: [] });
      harness.destroy(id, true);
      harness.command(newer, 'open');
      harness.destroy(newer, true);
    }
    return {
      cycles,
      snapshot: harness.info(),
      ownedRoots: document.querySelectorAll('[data-osai-component]').length,
      inertElements: document.querySelectorAll('[inert]').length,
    };
  }, policy.lifecycle.minCycles);
  expect(measured.snapshot.instances).toBe(0);
  expect(measured.snapshot.subscriptions).toBe(0);
  expect(measured.snapshot.pendingEvents).toBe(0);
  expect(Object.values(measured.snapshot.resources).every((value) => value === 0)).toBe(true);
  expect(measured.ownedRoots).toBe(0);
  expect(measured.inertElements).toBe(0);
  await info.attach('leak-measurements', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(measured)),
  });
});

test('omitting required Ready or Destroy lifecycle calls is detected', async ({ page }) => {
  gates('lifecycle');
  await page.evaluate(() => window.harness.reset());
  expect((await invoke(page, 'open', 'missing')).code).toBe('unknown-instance');
  await page.evaluate(() => {
    window.harness.ready('omitted');
    document.getElementById('host-omitted')?.remove();
  });
  const leaked = await page.evaluate(() => window.harness.info());
  expect(leaked.instances).toBe(1);
  expect(leaked.resources.ownedRoots).toBe(1);
  await page.evaluate(() => window.harness.destroy('omitted'));
  expect((await page.evaluate(() => window.harness.info())).instances).toBe(0);
});

test('omitted Render or Parameters Changed is detected by the rendered contract assertion', async ({
  page,
}) => {
  gates('lifecycle');
  await open(page);
  const intended = { commands: [{ id: 'new-value', label: 'Parameter changed value' }] };
  expect(await page.getByRole('option').allTextContents()).not.toContain('Parameter changed value');
  await page.evaluate((next) => window.harness.render('demo', next), intended);
  await expect(page.getByRole('option')).toHaveText('Parameter changed value');
});

test('recreation-required updates leave the packaged runtime state unchanged until explicit recreation', async ({
  page,
}) => {
  gates('browser', 'lifecycle', 'multi-instance');
  const result = await page.evaluate(() => {
    window.harness.reset();
    const api = window.harness.api;
    // Test-only registration uses the duplicate-load identity to exercise the exact packaged bridge.
    const runtime = (
      Reflect.get(api, Symbol.for('@osai/runtime-bridge')) as { runtime: RuntimeBridge }
    ).runtime;
    const schema = { type: 'string' };
    const manifest: ComponentManifest = {
      schemaVersion: '1.0',
      componentId: 'recreation-fixture',
      version: '1.0.0',
      contractVersion: '1.0',
      targets: ['odc', 'o11-reactive'],
      entry: 'fixture.ts',
      styles: ['fixture.css'],
      properties: {
        mode: {
          schema,
          required: false,
          default: 'first',
          access: 'readwrite',
          updateMode: 'recreate',
        },
      },
      commands: {},
      events: {},
      themeTokens: {},
      dependencies: [],
      assets: [],
      capabilities: {
        browserApis: [],
        networkOrigins: [],
        workers: [],
        portals: [],
        globalStyles: [],
        keyframes: [],
        fonts: [],
      },
    };
    const definition: ComponentDefinition = {
      manifest,
      contract: { properties: { mode: schema }, commands: {}, events: {} },
      create(context, config) {
        context.root.textContent = String(config.mode);
        return {
          commands: {},
          prepareUpdate(next) {
            const previous = context.root.textContent;
            return {
              commit() {
                context.root.textContent = String(next.mode);
              },
              rollback() {
                context.root.textContent = previous;
              },
            };
          },
          dispose() {},
        };
      },
    };
    const registration = JSON.parse(runtime.registerComponent(definition));
    const host = document.createElement('div');
    host.id = 'fixture-host';
    document.body.append(host);
    const created = JSON.parse(api.create('recreation-fixture', 'fixture', host.id, '{}'));
    const update = JSON.parse(api.update('fixture', '{"mode":"second"}'));
    const unchanged = host.textContent;
    api.dispose('fixture');
    const recreated = JSON.parse(
      api.create('recreation-fixture', 'fixture', host.id, '{"mode":"second"}'),
    );
    const changed = host.textContent;
    api.dispose('fixture');
    host.remove();
    return { registration, created, update, unchanged, recreated, changed };
  });
  expect(result.registration.ok).toBe(true);
  expect(result.created.ok).toBe(true);
  expect(result.update.code).toBe('recreation-required');
  expect(result.update.path).toBe('/properties/mode');
  expect(result.unchanged).toBe('first');
  expect(result.recreated.ok).toBe(true);
  expect(result.changed).toBe('second');
});

for (const visualState of [
  'closed',
  'open',
  'query',
  'empty',
  'disabled',
  'grouped',
  'rtl',
  'narrow',
  'zoomed',
  'reduced-motion',
]) {
  test(`visual baseline: ${visualState}`, { tag: '@visual' }, async ({ page }) => {
    gates('visual');
    if (visualState === 'narrow') await page.setViewportSize({ width: 320, height: 720 });
    if (visualState === 'zoomed') {
      await page.setViewportSize({ width: 1280, height: 1000 });
      await page.evaluate(() => document.documentElement.classList.add('test-zoom'));
    }
    if (visualState === 'rtl')
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
      });
    if (visualState === 'reduced-motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    if (visualState === 'disabled')
      await page.evaluate(() =>
        window.harness.render('demo', {
          commands: [
            {
              id: 'disabled',
              label: 'Manage billing',
              disabled: true,
              description: 'Available to workspace administrators',
            },
          ],
        }),
      );
    if (visualState !== 'closed') await open(page);
    // Opt-in mutation verifies that an unapproved appearance change makes the visual gate fail.
    if (visualState === 'open' && process.env.OSAI_VISUAL_MUTATION === '1')
      await page
        .getByRole('dialog')
        .getByRole('heading')
        .evaluate((element) => {
          element.textContent = 'Unapproved component appearance';
        });
    if (visualState === 'query') await page.getByRole('combobox').fill('project');
    if (visualState === 'empty') await page.getByRole('combobox').fill('nothing found');
    // The host's status output changes asynchronously; hide it to keep snapshots about UI appearance.
    await page.locator('#host-status').evaluate((element) => {
      element.textContent = 'Ready';
    });
    await expect(page).toHaveScreenshot(`${visualState}.png`, { fullPage: false });
  });
}

export type { Harness };
