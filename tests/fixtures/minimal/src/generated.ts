// Generated authoring bindings 1.0: minimal@1.0.0. Do not edit.
// Contract SHA-256: 34db4f031fcdb282115df4f49057bd9ddd73c873901f81e4b5a4dc710fb56781
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
