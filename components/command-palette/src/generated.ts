// Generated authoring bindings 1.0: command-palette@3.0.0. Do not edit.
// Contract SHA-256: 9bf74c6e38b0ef2d65a06684de755325d722058ec83369e6bff9fa39ff276dd3
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
