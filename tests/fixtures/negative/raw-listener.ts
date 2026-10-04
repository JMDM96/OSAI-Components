import type { ComponentDefinition } from '@osai/component-sdk';
import { componentDefinition } from '../minimal/src/index.js';

/** Deliberately unsafe: certification must observe this outside SDK counters. */
export function rawListenerFixture(onEffect: () => void): {
  definition: ComponentDefinition;
  releaseProbe(): void;
} {
  let releaseProbe = (): void => {};
  const erased = componentDefinition as unknown as ComponentDefinition;
  return {
    definition: {
      ...erased,
      create(context, config) {
        const document = context.root.ownerDocument;
        document.addEventListener('negative-leak-probe', onEffect);
        releaseProbe = () => document.removeEventListener('negative-leak-probe', onEffect);
        return erased.create(context, config);
      },
    },
    releaseProbe: () => releaseProbe(),
  };
}
