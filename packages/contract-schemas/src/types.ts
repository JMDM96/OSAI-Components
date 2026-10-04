export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}
export interface JsonSchema {
  [key: string]: unknown;
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: JsonValue[];
  const?: JsonValue;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
}
export interface Diagnostic {
  code: string;
  path: string;
  message: string;
}
export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  diagnostics: Diagnostic[];
}
export type Target = 'odc' | 'o11-reactive';
export interface PropertyContract {
  schema: JsonSchema;
  required: boolean;
  default?: JsonValue;
  access: 'read' | 'write' | 'readwrite';
  updateMode: 'live' | 'recreate';
}
export interface CommandContract {
  arguments: JsonSchema;
  result: JsonSchema;
  execution: 'sync';
}
export interface ThemeTokenContract {
  schema: JsonSchema;
  default: string;
}
export interface PortalCapability {
  name: string;
  selector: string;
  owner: 'instance';
  accessibility: string;
  cleanup: string;
}
export interface Capabilities {
  browserApis: string[];
  networkOrigins: string[];
  workers: string[];
  portals: PortalCapability[];
  globalStyles: string[];
  keyframes: string[];
  fonts: string[];
}
export interface RuntimeDependency {
  name: string;
  version: string;
  license: string;
  bundled: boolean;
  global?: string;
  origin?: string;
  loadOrder?: number;
  integrity?: string;
  csp?: Record<string, string[]>;
}
export interface Asset {
  path: string;
  type: 'script' | 'style' | 'image' | 'font' | 'worker' | 'data';
  origin?: string;
  integrity?: string;
}
export interface ComponentManifest {
  schemaVersion: '1.0';
  componentId: string;
  version: string;
  contractVersion: '1.0';
  targets: Target[];
  entry: string;
  styles: string[];
  properties: Record<string, PropertyContract>;
  commands: Record<string, CommandContract>;
  events: Record<string, { schema: JsonSchema }>;
  themeTokens: Record<string, ThemeTokenContract>;
  capabilities: Capabilities;
  dependencies: RuntimeDependency[];
  assets: Asset[];
}
export interface ImplementationContract {
  properties: Record<string, JsonSchema>;
  commands: Record<string, CommandContract>;
  events: Record<string, JsonSchema>;
}
