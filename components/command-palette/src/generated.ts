// Generated authoring bindings 1.0: command-palette@2.0.0. Do not edit.
// Contract SHA-256: 336af78f7e7e1f03cdde8c6efc0527c47263ffedb944313e06cc477b443672b4
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
export type HostInput = {
  closeOnSelect?: boolean;
  commands: Array<{
    description?: string;
    disabled?: boolean;
    group?: string;
    id: string;
    keywords?: Array<string>;
    label: string;
    metadata?: { hint?: string };
  }>;
  emptyMessage?: string;
  placeholder?: string;
  shortcut?: string;
  title?: string;
};
export type Configuration = DeepReadonly<{
  closeOnSelect: boolean;
  commands: Array<{
    description?: string;
    disabled?: boolean;
    group?: string;
    id: string;
    keywords?: Array<string>;
    label: string;
    metadata?: { hint?: string };
  }>;
  emptyMessage: string;
  placeholder: string;
  shortcut: string;
  title: string;
}>;
export type Commands = {
  close: { arguments: Record<string, never>; result: { isOpen: boolean } };
  open: { arguments: Record<string, never>; result: { isOpen: boolean } };
  toggle: { arguments: Record<string, never>; result: { isOpen: boolean } };
};
export type Events = {
  closed: { instanceId: string; reason: 'host' | 'escape' | 'selection' | 'shortcut' | 'button' };
  commandSelected: {
    commandId: string;
    instanceId: string;
    query: string;
    source: 'keyboard' | 'pointer';
  };
  error: { code: string; instanceId: string; message: string };
  opened: { instanceId: string };
  queryChanged: { instanceId: string; query: string; resultCount: number };
};
export type Bindings = { configuration: Configuration; commands: Commands; events: Events };
