import type { ComponentScenarios, ScenarioDriver } from '@osai/component-sdk/certification';
const open = (driver: ScenarioDriver) => driver.invoke('open', {});
const event = async (driver: ScenarioDriver, name: string) => {
  await driver.flush();
  driver.assert(
    driver.events().some((event) => event.name === name),
    `${name} delivered`,
  );
};
export const scenarios: ComponentScenarios = {
  'command-open'(driver) {
    open(driver);
    driver.assert(
      driver.root.querySelector('[role="dialog"]')?.getAttribute('aria-modal') === 'true',
      'Modal opens',
    );
  },
  'command-close'(driver) {
    open(driver);
    driver.invoke('close', {});
    driver.assert(
      driver.root.querySelector<HTMLElement>('[role="dialog"]')?.parentElement?.hidden === true,
      'Modal closes',
    );
  },
  'command-toggle'(driver) {
    driver.invoke('toggle', {});
    driver.assert(
      driver.root.querySelector<HTMLElement>('[role="dialog"]')?.parentElement?.hidden === false,
      'Toggle opens',
    );
  },
  async 'event-opened'(driver) {
    open(driver);
    await event(driver, 'opened');
  },
  async 'event-closed'(driver) {
    open(driver);
    driver.invoke('close', {});
    await event(driver, 'closed');
  },
  async 'event-queryChanged'(driver) {
    open(driver);
    const input = driver.root.querySelector<HTMLInputElement>('input')!;
    input.value = 'One';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await event(driver, 'queryChanged');
  },
  async 'event-commandSelected'(driver) {
    open(driver);
    driver.root.querySelector<HTMLElement>('[role="option"]')!.click();
    await event(driver, 'commandSelected');
  },
  async 'event-error'(driver) {
    const sibling = driver.sibling({ commands: [], shortcut: 'Control+K' });
    driver.update({ commands: [{ id: 'one', label: 'One' }], shortcut: 'Control+K' });
    await event(driver, 'error');
    sibling.dispose();
  },
  accessible(driver) {
    open(driver);
    driver.assert(
      driver.root.querySelector('[role="combobox"]')?.getAttribute('aria-label') !== null,
      'Search has an accessible label',
    );
  },
  default(driver) {
    open(driver);
    driver.assert(driver.root.querySelector('[role="dialog"]') !== null, 'Palette surface exists');
  },
};
