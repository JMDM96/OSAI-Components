// Generated authoring bindings 1.0: resources@1.0.0. Do not edit.
// Contract SHA-256: 93c01c1cb91f3973bc2d6a70baeef23c10d0c383a6a206ad75e2d5b614649fee
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue | undefined };
export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
export type HostInput = {
  fail?: boolean;
  label?: string;
  records?: Array<string>;
};
export type Configuration = DeepReadonly<{
  fail: boolean;
  label: string;
  records: Array<string>;
}>;
export type Commands = {
  read: { arguments: Record<string, never>; result: string };
  start: { arguments: { value: string }; result: { accepted: boolean; generation: number } };
};
export type Events = {
  completed: { value: string };
};
export type Bindings = { configuration: Configuration; commands: Commands; events: Events };
