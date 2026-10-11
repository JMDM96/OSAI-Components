import type { ComponentScenarios } from '@osai/component-sdk/certification';
export const scenarios: ComponentScenarios = {
  'command-read'(driver) {
    driver.assert(driver.invoke('read', {}) === 'Hello', 'Read returns configured label');
  },
  async 'event-read'(driver) {
    driver.invoke('read', {});
    await driver.flush();
    driver.assert(
      driver.events().some((event) => event.name === 'read'),
      'Read event delivered',
    );
  },
  accessible(driver) {
    driver.assert(driver.root.textContent === 'Hello', 'Visible text');
  },
  default(driver) {
    driver.assert(driver.root.textContent === 'Hello', 'Default appearance');
  },
};
