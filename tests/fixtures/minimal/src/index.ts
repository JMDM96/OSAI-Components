import { defineComponent, implementationContractFromManifest } from '@osai/component-sdk';
import type { ComponentManifest } from '@osai/component-sdk';
import manifestData from '../component.manifest.json';
import labelSchema from '../schemas/label.json';
import type { Bindings } from './generated.js';

export const manifest = {
  ...manifestData,
  properties: { label: { ...manifestData.properties.label, schema: labelSchema } },
} as ComponentManifest;
export const componentDefinition = defineComponent<Bindings>({
  manifest,
  contract: implementationContractFromManifest(manifest),
  create(context, initial) {
    let config = initial;
    context.root.textContent = String(config.label);
    return {
      prepareUpdate(next) {
        const previous = config;
        return {
          commit() {
            config = next;
            context.root.textContent = String(next.label);
          },
          rollback() {
            config = previous;
            context.root.textContent = String(previous.label);
          },
        };
      },
      commands: {
        read() {
          context.emit('read', { label: String(config.label) });
          return String(config.label);
        },
      },
      dispose() {
        context.root.replaceChildren();
      },
    };
  },
});
export default componentDefinition;
