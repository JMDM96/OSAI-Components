import type { ComponentScenarios } from '@osai/component-sdk/certification';
export const scenarios: ComponentScenarios = {
  'command-read'(driver) {
    driver.assert(driver.invoke('read', {}) === 'Ready', 'Read returns configured label');
  },
  'command-start'(driver) {
    const result = driver.invoke('start', { value: 'worker' });
    driver.assert(
      typeof result === 'object' &&
        result !== null &&
        'accepted' in result &&
        result.accepted === true,
      'Synchronous acknowledgement',
    );
  },
  async 'event-completed'(driver) {
    driver.invoke('start', { value: 'worker' });
    for (let i = 0; i < 100 && !driver.events().length; i++) await driver.flush();
    driver.assert(
      driver.events().some((event) => event.name === 'completed'),
      'Worker completion delivered',
    );
  },
  accessible(driver) {
    driver.assert(
      driver.root.querySelector('button')?.textContent === 'Start local work',
      'Named native button',
    );
  },
  default(driver) {
    driver.assert(driver.root.querySelector('output')?.textContent === 'Ready', 'Default state');
  },
  async 'async-supersession'(driver) {
    driver.invoke('start', { value: 'old' });
    driver.invoke('start', { value: 'current' });
    for (let count = 0; count < 100 && !driver.events().length; count++) await driver.flush();
    driver.assert(
      JSON.stringify(driver.events()) ===
        JSON.stringify([{ name: 'completed', payload: { value: 'current' } }]),
      'Only current generation may complete',
    );
  },
  async 'async-disposal'(driver) {
    driver.invoke('start', { value: 'old' });
    driver.invoke('start', { value: 'current' });
    driver.dispose();
    for (let count = 0; count < 4; count++) await driver.flush();
    driver.assert(driver.events().length === 0, 'Disposal suppresses late completions');
  },
  async 'worker-lifecycle'(driver) {
    await scenarios['async-supersession']!(driver);
    const fonts = await driver.root.ownerDocument.fonts.load('12px "OSAI Fixture"', 'A');
    const image = new Image();
    image.src = driver.resolveAsset('assets/images/pixel.png');
    await image.decode();
    driver.assert(fonts.length === 1 && image.naturalWidth === 1, 'Declared font and image decode');
  },
  'portal-lifecycle'(driver) {
    driver.assert(
      driver.root.ownerDocument.querySelector('[data-osai-resource-portal]') !== null,
      'Owned live portal exists',
    );
  },
  'provider-partial-failure'(driver) {
    const before = driver.root.innerHTML;
    let rejected = false;
    try {
      driver.update({ label: 'Changed', fail: true });
    } catch {
      rejected = true;
    }
    driver.assert(
      rejected && driver.root.innerHTML === before,
      'Partial provider failure preserves committed state',
    );
  },
  async 'provider-lifecycle'(driver) {
    const sibling = driver.sibling({ label: 'Sibling' });
    const before = sibling.root.innerHTML;
    for (let cycle = 0; cycle < 100; cycle++) {
      const host = driver.root.parentElement!;
      host.hidden = cycle % 2 === 0;
      host.style.width = `${320 + cycle}px`;
      driver.invoke('start', { value: 'old' });
      driver.invoke('start', { value: 'current' });
      await scenarios['provider-partial-failure']!(driver);
      if (cycle % 3 === 0) host.remove();
      driver.dispose();
      driver.create({ label: 'Ready' });
    }
    driver.dispose();
    for (let count = 0; count < 4; count++) await driver.flush();
    driver.assert(driver.events().length === 0, '100 busy disposals have no late callbacks');
    driver.assert(
      sibling.root.innerHTML === before && sibling.events().length === 0,
      'Sibling state and callbacks stay isolated',
    );
    sibling.dispose();
  },
};
