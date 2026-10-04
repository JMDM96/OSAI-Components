import type {
  ComponentManifest,
  Diagnostic,
  ImplementationContract,
  JsonObject,
  JsonValue,
  CapabilityProfile,
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
  adoptProvider<T>(
    contract: ProviderContract,
    initialize: (scope: ResourceScope) => T,
  ): OwnedProvider<T>;
  child(): ResourceScope;
  dispose(): void;
  operation<T>(
    key: string,
    work: (context: OperationContext) => Promise<T>,
    complete: (value: T) => void,
    failed?: () => void,
  ): ManagedOperation;
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
export interface ProviderContract {
  id: string;
  capabilities: ('listeners' | 'timers' | 'observers' | 'workers' | 'portals')[];
  partialInitialization: 'register-cleanup-before-allocation';
  update: 'transactional';
  disposal: 'scope';
}
export interface OwnedProvider<T> {
  readonly value: T;
  dispose(): void;
}
export interface OperationContext {
  readonly signal: AbortSignal;
  readonly generation: number;
  readonly resources: ResourceScope;
  isCurrent(): boolean;
}
export interface ManagedOperation extends OperationContext {
  cancel(): void;
}
export type JsonData =
  | null
  | boolean
  | number
  | string
  | readonly JsonData[]
  | { readonly [key: string]: JsonData | undefined };
type JsonBoundary<T> = T extends JsonData ? T : never;
export interface ComponentBindings {
  configuration: object;
  commands: Record<string, { arguments: unknown; result: unknown }>;
  events: Record<string, unknown>;
}
export interface UntypedBindings extends ComponentBindings {
  configuration: JsonObject;
  commands: Record<string, { arguments: JsonValue; result: JsonValue }>;
  events: Record<string, JsonValue>;
}
export interface ComponentContext<B extends ComponentBindings = UntypedBindings> {
  readonly instanceId: string;
  readonly host: HTMLElement;
  readonly root: HTMLElement;
  readonly resources: ResourceScope;
  resolveAsset(id: string): string;
  emit<K extends keyof B['events'] & string>(name: K, payload: JsonBoundary<B['events'][K]>): void;
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
export interface ComponentController<B extends ComponentBindings = UntypedBindings> {
  prepareUpdate(next: B['configuration']): UpdateTransaction;
  commands: {
    [K in keyof B['commands']]: (
      args: JsonBoundary<B['commands'][K]['arguments']>,
    ) => JsonBoundary<B['commands'][K]['result']>;
  };
  dispose(): void;
}
export interface ComponentDefinition<B extends ComponentBindings = UntypedBindings> {
  profile?: CapabilityProfile;
  manifest: ComponentManifest;
  contract: ImplementationContract;
  validateConfig?(next: B['configuration']): Diagnostic[];
  create(context: ComponentContext<B>, config: B['configuration']): ComponentController<B>;
}
export function defineComponent<B extends ComponentBindings = UntypedBindings>(
  definition: ComponentDefinition<B>,
): ComponentDefinition<B> {
  return definition;
}
