import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { selectComponents } from '../../packages/build-tools/src/registry.js';
import {
  loadCertification,
  validateObservations,
  SUITE_VERSION,
} from '../../packages/build-tools/src/certification.js';
import type { PreviewMetadata } from '../browser-harness/preview.js';
import type { JsonObject } from '@osai/contract-schemas';
import policy from '../../release-policy.json' with { type: 'json' };
const [selected] = await selectComponents(process.cwd(), {
  component: process.env.OSAI_COMPONENT ?? 'command-palette',
  fixtureManifests: JSON.parse(process.env.OSAI_FIXTURE_MANIFESTS ?? '[]') as string[],
});
const certification = await loadCertification(selected!);
const resourceKeys = [
  'listeners',
  'timers',
  'animationFrames',
  'observers',
  'workers',
  'portals',
] as const;
const create = (page: Page) =>
  page.evaluate(() =>
    window.preview.driver.create(
      window.previewMetadata.certification.descriptor.validConfiguration,
    ),
  );
const cleanup = (page: Page) =>
  page.evaluate(async () => {
    window.preview.reset();
    await window.observations.delay(70);
    const before = window.observations.snapshot();
    document.dispatchEvent(new Event('resource-provider'));
    document.dispatchEvent(new Event('raw-listener-probe'));
    await window.observations.delay(70);
    return {
      before,
      after: window.observations.snapshot(),
      managed: JSON.parse(window.preview.api.getInfo()).value,
    };
  });
for (const id of certification.inventory) {
  test(
    id,
    {
      tag: certification.descriptor.scenarios.some(
        (scenario) => `component/${scenario.id}` === id && scenario.kind === 'visual',
      )
        ? '@visual'
        : [],
    },
    async ({ page, browser, request }, info) => {
      test.setTimeout(90000);
      const target = String(info.project.metadata.target);
      const query = new URLSearchParams({ component: selected!.manifest.componentId, target });
      await page.goto(`/preview?${query}`);
      await expect(page.locator('html')).toHaveAttribute('data-ready', 'true');
      const metadata = (await page.evaluate(() => window.previewMetadata)) as PreviewMetadata;
      let measurement: unknown;
      let passed = false;
      try {
        if (id.startsWith('component/')) {
          const scenario = certification.descriptor.scenarios.find(
            (scenario) => `component/${scenario.id}` === id,
          )!;
          measurement = await page.evaluate(
            ({ name, preserve }) => window.preview.run(name, preserve),
            { name: scenario.id, preserve: scenario.kind === 'visual' },
          );
          if (scenario.kind === 'visual')
            await expect(page).toHaveScreenshot(
              `${metadata.manifest.componentId}-${scenario.id}.png`,
            );
        } else if (id === 'platform/lifecycle') {
          await create(page);
          const result = await page.evaluate(() => {
            const { driver, api } = window.preview;
            const config = window.previewMetadata.certification.descriptor.validConfiguration;
            driver.update(config);
            driver.dispose();
            driver.dispose();
            driver.create(config);
            return JSON.parse(api.getInfo()).value.instances;
          });
          expect(result).toBe(1);
        } else if (id === 'platform/isolation') {
          await create(page);
          const result = await page.evaluate(() => {
            const driver = window.preview.driver;
            const config = window.previewMetadata.certification.descriptor.validConfiguration;
            const sibling = driver.sibling(config);
            const before = sibling.root.innerHTML;
            driver.update(config);
            driver.dispose();
            const same = sibling.root.innerHTML === before;
            sibling.dispose();
            return same;
          });
          expect(result).toBe(true);
        } else if (id === 'platform/contract') {
          await create(page);
          const result = await page.evaluate(() => {
            const { api, driver } = window.preview;
            const before = driver.root.innerHTML;
            const results =
              window.previewMetadata.certification.descriptor.invalidConfigurations.map(
                (config) => JSON.parse(api.update('preview', JSON.stringify(config))).ok,
              );
            results.push(JSON.parse(api.invoke('preview', 'unlisted', '{}')).ok);
            results.push(JSON.parse(api.update('preview', '{')).ok);
            return { results, preserved: driver.root.innerHTML === before };
          });
          expect(result.results.every((ok) => ok === false)).toBe(true);
          expect(result.preserved).toBe(true);
        } else if (id === 'platform/accessibility') {
          await create(page);
          await page.evaluate(async () => {
            const scenario = window.previewMetadata.certification.descriptor.scenarios.find(
              (item) => item.kind === 'accessibility',
            )!;
            await window.componentScenarios[scenario.id]!(window.preview.driver);
          });
          const componentObservations = await page.evaluate(() => window.observations.snapshot());
          const audit = await new AxeBuilder({ page })
            .withTags(policy.accessibility.axeTags)
            .analyze();
          expect(audit.violations).toEqual([]);
          await page.keyboard.press('Tab');
          await page.keyboard.press('Escape');
          await page.setViewportSize({ width: 320, height: 720 });
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await page.evaluate(() => {
            document.documentElement.dir = 'rtl';
            document.documentElement.style.zoom = '2';
          });
          expect(await page.locator('main').count()).toBe(1);
          measurement = { violations: audit.violations.length, componentObservations };
        } else if (id === 'platform/security') {
          await create(page);
          const response = await request.get(`/preview?${query}`);
          expect(response.headers()['content-security-policy']).not.toContain('unsafe-');
          const observed = await page.evaluate(() => window.observations.snapshot());
          validateObservations(
            metadata.manifest,
            {
              workers: observed.workerUrls,
              origins: observed.origins,
              portals: observed.portalSelectors,
              apis: observed.apis,
            },
            Object.fromEntries(
              metadata.resources.registration.assets.map((asset) => [
                asset.id,
                new URL(metadata.assetBase + asset.id, page.url()).href,
              ]),
            ),
          );
          expect((await request.get(`${metadata.assetBase}not-registered.js`)).status()).toBe(404);
          expect((await request.get('/package.json')).status()).toBe(404);
          measurement = { observed };
        } else if (id === 'platform/cleanup') {
          measurement = await page.evaluate(async (cycles) => {
            const { driver, api } = window.preview;
            const configuration =
              window.previewMetadata.certification.descriptor.validConfiguration;
            for (let cycle = 0; cycle < cycles; cycle++) {
              driver.create(configuration);
              const host = driver.root.parentElement!;
              host.hidden = cycle % 2 === 0;
              host.style.width = `${320 + cycle}px`;
              driver.update(configuration);
              if (cycle % 3 === 0) host.remove();
              driver.dispose();
            }
            await window.observations.delay(70);
            return {
              cycles,
              snapshot: JSON.parse(api.getInfo()).value,
              observed: window.observations.snapshot(),
            };
          }, certification.profile.benchmark.lifecycleCycles);
          const result = await cleanup(page);
          for (const key of resourceKeys) expect(result.after[key], key).toBe(0);
          expect(result.after.effects).toBe(result.before.effects);
          expect(result.managed.instances).toBe(0);
          expect(Object.values(result.managed.resources).every((value) => value === 0)).toBe(true);
        } else if (id === 'platform/negative-listener') {
          const result = await page.evaluate(() => {
            let effects = 0;
            const listener = () => effects++;
            document.addEventListener('raw-listener-probe', listener);
            window.preview.reset();
            const managed = JSON.parse(window.preview.api.getInfo()).value;
            document.dispatchEvent(new Event('raw-listener-probe'));
            const observed = window.observations.snapshot();
            document.removeEventListener('raw-listener-probe', listener);
            return { effects, managed, observed };
          });
          expect(Object.values(result.managed.resources).every((value) => value === 0)).toBe(true);
          expect(result.effects).toBe(1);
          expect(result.observed.listeners).toBeGreaterThan(0);
          measurement = { rejected: true };
        } else if (id === 'platform/negative-performance') {
          await create(page);
          const result = await page.evaluate(() => window.preview.measureSlowInput());
          measurement = result;
          expect(result.rejected).toBe(true);
          expect(result.measuredMs).toBeGreaterThan(certification.profile.benchmark.input.worstMs);
        } else if (id === 'platform/benchmark') {
          measurement = await benchmark(page, info);
        } else {
          const scenario = certification.descriptor.scenarios.find(
            (item) => item.kind === 'capability' && `platform/${item.member}` === id,
          )!;
          measurement = await page.evaluate((name) => window.preview.run(name), scenario.id);
          const observed = await page.evaluate(() => window.observations.snapshot());
          if (id === 'platform/worker-lifecycle')
            expect(observed.workerUrls.length).toBeGreaterThan(0);
          if (id === 'platform/portal-lifecycle')
            expect(observed.portalSelectors.length).toBeGreaterThan(0);
        }
        passed = true;
      } finally {
        const after = await cleanup(page);
        await info.attach('scenario-evidence', {
          contentType: 'application/json',
          body: Buffer.from(
            JSON.stringify({
              schemaVersion: '2.0',
              scenarioId: id,
              componentId: metadata.manifest.componentId,
              version: metadata.manifest.version,
              target,
              browser: info.project.use.browserName,
              browserVersion: browser.version(),
              suiteVersion: SUITE_VERSION,
              contractHash: metadata.certification.contractHash,
              profileHash: metadata.certification.profileHash,
              descriptorHash: metadata.certification.descriptorHash,
              suiteHash: metadata.certification.suiteHash,
              policyHash: metadata.policyHash,
              artifactChecksums: metadata.artifactChecksums,
              passed,
              measurement,
              afterCleanup: after,
            }),
          ),
        });
        if (id !== 'platform/accessibility')
          for (const key of resourceKeys) expect(after.after[key], key).toBe(0);
      }
    },
  );
}

async function benchmark(page: Page, info: TestInfo) {
  const measurements = await page.evaluate(async () => {
    const { manifest, certification } = window.previewMetadata;
    const settings = certification.profile.benchmark;
    const array = Object.entries(manifest.properties).find(
      ([, property]) => property.schema.type === 'array',
    );
    const workloads = [];
    for (const size of settings.datasets) {
      const records = Array.from({ length: size }, (_, index) => ({
        id: `item-${index}`,
        label: `Record ${index}`,
      }));
      const config: JsonObject = { ...certification.descriptor.validConfiguration };
      if (array)
        config[array[0]] =
          array[1].schema.items?.type === 'string'
            ? records.map((record) => record.label)
            : records;
      const samples: { create: number[]; update: number[]; input: number[] } = {
        create: [],
        update: [],
        input: [],
      };
      for (let sample = -settings.warmup; sample < settings.samples; sample++) {
        const driver = window.preview.driver;
        let start = performance.now();
        driver.create(config);
        const create = performance.now() - start;
        start = performance.now();
        driver.update(config);
        const update = performance.now() - start;
        start = performance.now();
        const input = driver.root.querySelector<HTMLInputElement>('input');
        if (input) {
          input.value = records[size - 1]!.label;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else
          driver.root.dispatchEvent(
            new CustomEvent('benchmark-input', { detail: records[size - 1]!.label }),
          );
        const latency = performance.now() - start;
        driver.dispose();
        if (sample >= 0) {
          samples.create.push(create);
          samples.update.push(update);
          samples.input.push(latency);
        }
      }
      const stats = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return { p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!, worstMs: sorted.at(-1)! };
      };
      workloads.push({
        records: size,
        configurationRecords: array ? size : 0,
        mode: array ? 'configuration-array' : 'bridge-lifecycle-with-fixed-input-corpus',
        samples,
        create: stats(samples.create),
        update: stats(samples.update),
        input: stats(samples.input),
      });
    }
    await window.observations.delay(70);
    return {
      protocolVersion: settings.protocolVersion,
      settings,
      environment: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        viewport: [innerWidth, innerHeight],
      },
      workloads,
      resources: window.observations.snapshot(),
    };
  });
  await info.attach('benchmark-measurements', {
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify(measurements)),
  });
  for (const workload of measurements.workloads)
    for (const operation of ['create', 'update', 'input'] as const) {
      expect(workload[operation].p95Ms).toBeLessThanOrEqual(measurements.settings[operation].p95Ms);
      expect(workload[operation].worstMs).toBeLessThanOrEqual(
        measurements.settings[operation].worstMs,
      );
    }
  for (const key of resourceKeys) expect(measurements.resources[key]).toBe(0);
  return measurements;
}
