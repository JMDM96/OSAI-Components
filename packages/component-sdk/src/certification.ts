import type { JsonObject, JsonValue } from '@osai/contract-schemas';

/** Component scenario modules execute through the public host boundary in the harness. */
export interface ScenarioDriver {
  readonly root: HTMLElement;
  create(config: JsonObject): void;
  update(config: JsonObject): void;
  invoke(command: string, args: JsonValue): JsonValue;
  dispose(): void;
  events(): { name: string; payload: JsonValue }[];
  flush(): Promise<void>;
  assert(condition: boolean, message: string): void;
  sibling(config: JsonObject): ScenarioDriver;
  resolveAsset(id: string): string;
}
export type ComponentScenarios = Record<string, (driver: ScenarioDriver) => void | Promise<void>>;
