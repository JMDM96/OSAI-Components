import type {
  ComponentManifest,
  Diagnostic,
  ImplementationContract,
  JsonObject,
  JsonValue,
} from '@osai/contract-schemas';
export type {
  ComponentManifest,
  Diagnostic,
  ImplementationContract,
  JsonObject,
  JsonSchema,
  JsonValue,
} from '@osai/contract-schemas';
export { implementationContractFromManifest } from '@osai/contract-schemas';

export interface ResourceScope {
  add(cleanup: () => void): () => void;
  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): () => void;
  timeout(callback: () => void, delay: number): () => void;
  interval(callback: () => void, delay: number): () => void;
  animationFrame(callback: FrameRequestCallback): () => void;
  observer<T extends { disconnect(): void }>(observer: T): () => void;
  worker(worker: { terminate(): void }): () => void;
  portal(element: HTMLElement, parent?: HTMLElement): () => void;
  lockBackground(modalRoot: HTMLElement): () => void;
}
export interface ComponentContext {
  readonly instanceId: string;
  readonly host: HTMLElement;
  readonly root: HTMLElement;
  readonly resources: ResourceScope;
  emit(name: string, payload: JsonValue): void;
  diagnostic(code: string, message: string, path?: string): void;
  registerShortcut(
    shortcut: string,
    handler: (event: KeyboardEvent) => void,
    options?: { isOpen?: () => boolean; onConflict?: () => void },
  ): () => void;
}
/** Prepare must leave the live view unchanged. Rollback restores it if commit throws. */
export interface UpdateTransaction {
  commit(): void;
  rollback(): void;
}
export interface ComponentController {
  prepareUpdate(next: JsonObject): UpdateTransaction;
  commands: Record<string, (args: JsonValue) => JsonValue>;
  dispose(): void;
}
export interface ComponentDefinition {
  manifest: ComponentManifest;
  contract: ImplementationContract;
  validateConfig?(next: JsonObject): Diagnostic[];
  create(context: ComponentContext, config: JsonObject): ComponentController;
}
export function defineComponent<T extends ComponentDefinition>(definition: T): T {
  return definition;
}
