import {
  canonicalJson,
  diagnostic,
  orderDiagnostics,
  validateJsonSchema,
} from '@osai/contract-schemas';
import type { ComponentManifest, Diagnostic, JsonObject, JsonValue } from './index.js';

/** An instrumented driver lets the same assertions run on source and packaged bridges. */
export interface ConformanceDriver {
  create(id: string, config: JsonObject): void;
  update(id: string, config: JsonObject): void;
  invoke(id: string, command: string, args: JsonValue): JsonValue;
  dispose(id: string): void;
  snapshot(id: string): JsonValue;
  events(id: string): { name: string; payload: JsonValue }[];
  resources(id: string): Record<string, number>;
  flush(): Promise<void>;
}
export interface ConformanceScenario {
  initial: JsonObject;
  updated: JsonObject;
  command: string;
  arguments: JsonValue;
}
export async function runBehavioralConformance(
  manifest: ComponentManifest,
  driver: ConformanceDriver,
  scenario: ConformanceScenario,
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  const left = 'conformance-a';
  const right = 'conformance-b';
  try {
    driver.create(left, scenario.initial);
    driver.create(right, scenario.initial);
    await driver.flush();
    const rightBefore = canonicalJson(driver.snapshot(right));
    const rightEvents = canonicalJson(driver.events(right));
    driver.update(left, scenario.updated);
    const result = driver.invoke(left, scenario.command, scenario.arguments);
    const command = manifest.commands[scenario.command];
    if (!command)
      diagnostics.push(
        diagnostic(
          'undeclared-command',
          `/commands/${scenario.command}`,
          'The conformance scenario invoked an undeclared command.',
        ),
      );
    else
      diagnostics.push(
        ...validateJsonSchema(command.result, result, `/commands/${scenario.command}/result`),
      );
    await driver.flush();
    if (
      canonicalJson(driver.snapshot(right)) !== rightBefore ||
      canonicalJson(driver.events(right)) !== rightEvents
    )
      diagnostics.push(
        diagnostic(
          'instance-crosstalk',
          '/lifecycle/isolation',
          'Operations on one instance changed another instance.',
        ),
      );
    for (const id of [left, right])
      for (const event of driver.events(id)) {
        const contract = manifest.events[event.name];
        if (!contract)
          diagnostics.push(
            diagnostic(
              'undeclared-event',
              `/events/${event.name}`,
              'Implementation emitted an undeclared event.',
            ),
          );
        else
          diagnostics.push(
            ...validateJsonSchema(contract.schema, event.payload, `/events/${event.name}`),
          );
      }
  } catch {
    diagnostics.push(
      diagnostic(
        'lifecycle-failure',
        '/lifecycle',
        'The component did not complete its synchronous lifecycle.',
      ),
    );
  } finally {
    for (const id of [left, right]) {
      try {
        driver.dispose(id);
        driver.dispose(id);
      } catch {
        diagnostics.push(
          diagnostic(
            'dispose-failure',
            '/lifecycle/dispose',
            'Disposal must be defensive and idempotent.',
          ),
        );
      }
    }
  }
  const eventsAfterDispose = [
    canonicalJson(driver.events(left)),
    canonicalJson(driver.events(right)),
  ];
  await driver.flush();
  for (const [index, id] of [left, right].entries()) {
    for (const [resource, count] of Object.entries(driver.resources(id)))
      if (count !== 0)
        diagnostics.push(
          diagnostic(
            'resource-leak',
            `/lifecycle/resources/${resource}`,
            'Owned resources remain after disposal.',
          ),
        );
    if (canonicalJson(driver.events(id)) !== eventsAfterDispose[index])
      diagnostics.push(
        diagnostic(
          'post-dispose-callback',
          '/lifecycle/events',
          'An event was delivered after disposal.',
        ),
      );
  }
  return orderDiagnostics(diagnostics);
}
