// Generated authoring bindings 1.0: recreation@1.0.0. Do not edit.
// Contract SHA-256: 2eb5862b7c4e356d9f596f0b28a94455062826d11155d620c34562079bc258d7
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
export type HostInput = {
  label?: string;
};
export type Configuration = DeepReadonly<{
  label: string;
}>;
export type Commands = {
  read: { arguments: Record<string, never>; result: string };
};
export type Events = {
  read: { label: string };
};
export type Bindings = { configuration: Configuration; commands: Commands; events: Events };
