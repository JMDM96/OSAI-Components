import { defineComponent, implementationContractFromManifest } from '@osai/component-sdk';
import type { ComponentManifest } from '@osai/component-sdk';
import { capabilityProfile } from '@osai/contract-schemas';
import data from '../component.manifest.json';
import type { Bindings } from './generated.js';

export const manifest = data as ComponentManifest;
export const componentDefinition = defineComponent<Bindings>({
  manifest,
  profile: capabilityProfile('combined'),
  contract: implementationContractFromManifest(manifest),
  create(context, initial) {
    const { resources, root } = context;
    let config = initial;
    let value = initial.label;
    const doc = root.ownerDocument;
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = 'Start local work';
    const output = doc.createElement('output');
    output.textContent = value;
    const portal = doc.createElement('span');
    portal.dataset.osaiResourcePortal = context.instanceId;
    portal.setAttribute('role', 'status');
    resources.portal(portal);
    root.append(button, output);
    const glyph = doc.createElement('span');
    glyph.className = 'fixture-glyph';
    glyph.textContent = 'A';
    glyph.setAttribute('aria-hidden', 'true');
    root.append(glyph);
    const provider = resources.adoptProvider(
      {
        id: 'local-status',
        capabilities: ['listeners'],
        partialInitialization: 'register-cleanup-before-allocation',
        update: 'transactional',
        disposal: 'scope',
      },
      (scope) => {
        const owned = doc.createElement('span');
        owned.dataset.provider = 'local-status';
        owned.hidden = true;
        scope.add(() => owned.remove());
        root.append(owned);
        const handler = () => {
          portal.textContent = value;
        };
        scope.add(() => doc.removeEventListener('resource-provider', handler));
        doc.addEventListener('resource-provider', handler);
        return { refresh: handler };
      },
    );
    const observer = new MutationObserver(() => provider.value.refresh());
    resources.observer(observer);
    observer.observe(output, { childList: true });
    const start = (next: string) => {
      const operation = resources.operation(
        'local',
        ({ resources: scope, signal }) =>
          new Promise<string>((resolve, reject) => {
            const worker = new Worker(context.resolveAsset('workers/local.js'));
            scope.worker(worker);
            scope.listen(worker, 'message', (event) =>
              resolve(String((event as MessageEvent).data)),
            );
            scope.listen(worker, 'error', () => reject(new Error('Worker failed.')));
            scope.listen(signal, 'abort', () => reject(new Error('Cancelled.')));
            worker.postMessage(next);
          }),
        (next) => {
          value = next;
          output.textContent = value;
          provider.value.refresh();
          context.emit('completed', { value });
        },
      );
      return { accepted: true, generation: operation.generation };
    };
    resources.listen(button, 'click', () => start(config.label));
    return {
      prepareUpdate(next) {
        const prior = config;
        const previous = value;
        start(next.label);
        const scope = resources.child();
        scope.adoptProvider(
          {
            id: 'update-check',
            capabilities: ['timers'],
            partialInitialization: 'register-cleanup-before-allocation',
            update: 'transactional',
            disposal: 'scope',
          },
          (owner) => {
            const provisional = doc.createElement('span');
            owner.add(() => provisional.remove());
            root.append(provisional);
            let cancel = () => {};
            owner.add(() => cancel());
            cancel = owner.timeout(() => {}, 50);
            if (next.fail) throw new Error('Partial provider failure.');
            return true;
          },
        );
        return {
          commit() {
            config = next;
            value = next.label;
            output.textContent = value;
            scope.dispose();
          },
          rollback() {
            config = prior;
            value = previous;
            output.textContent = value;
          },
        };
      },
      commands: { start: ({ value }) => start(value), read: () => value },
      dispose() {
        root.replaceChildren();
      },
    };
  },
});
