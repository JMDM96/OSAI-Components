import { defineComponent } from '@osai/component-sdk';
import type { ComponentManifest, ImplementationContract } from '@osai/component-sdk';
import manifest from '../component.manifest.json';
import configurationSchema from '../schemas/config.schema.json';
import argumentsSchema from '../schemas/command-arguments.schema.json';
import resultSchema from '../schemas/command-result.schema.json';
import eventSchemas from '../schemas/events.schema.json';
import { validateConfiguration } from './configuration.js';
import { createCommandPalette } from './palette.js';
import type { Bindings } from './generated.js';

const commandContract = {
  arguments: argumentsSchema,
  result: resultSchema,
  execution: 'sync' as const,
};

// These imports produce a browser-ready contract without a filesystem resolver.
// Build conformance compares this resolved contract against the source manifest.
export const componentManifest: ComponentManifest = {
  ...manifest,
  properties: Object.entries(manifest.properties).reduce<ComponentManifest['properties']>(
    (properties, [name, property]) => {
      properties[name] = {
        ...property,
        access: 'readwrite',
        updateMode: 'live',
        schema: configurationSchema.properties[name as keyof typeof configurationSchema.properties],
      };
      return properties;
    },
    {},
  ),
  commands: { open: commandContract, close: commandContract, toggle: commandContract },
  events: Object.entries(eventSchemas.definitions).reduce<ComponentManifest['events']>(
    (events, [name, schema]) => {
      events[name] = { schema };
      return events;
    },
    {},
  ),
} as ComponentManifest;

export const commandPaletteContract: ImplementationContract = {
  properties: configurationSchema.properties,
  commands: { open: commandContract, close: commandContract, toggle: commandContract },
  events: eventSchemas.definitions,
};

export const commandPaletteDefinition = defineComponent<Bindings>({
  manifest: componentManifest,
  contract: commandPaletteContract,
  validateConfig: validateConfiguration,
  create: createCommandPalette,
});

/** Standard entry point used by the component build pipeline. */
export const componentDefinition = commandPaletteDefinition;

export { createCommandPalette } from './palette.js';
export {
  filterCommands,
  normalizeConfiguration,
  normalizeQuery,
  validateConfiguration,
} from './configuration.js';
export type { CommandItem, PaletteConfiguration } from './configuration.js';
