import type { ComponentSelection } from './registry.js';

export function parseSelection(args: string[]): {
  selection: ComponentSelection;
  positional: string[];
} {
  const selection: ComponentSelection = {};
  const positional: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (argument === '--all') {
      if (selection.all) throw new Error('Duplicate --all selector.');
      selection.all = true;
    } else if (argument === '--component' || argument === '--fixture') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing ${argument} value.`);
      if (argument === '--component') {
        if (selection.component) throw new Error('Duplicate --component selector.');
        selection.component = value;
      } else (selection.fixtureManifests ??= []).push(value);
    } else if (argument.startsWith('--')) throw new Error(`Unknown selector: ${argument}`);
    else positional.push(argument);
  }
  if (selection.component && selection.all) throw new Error('Conflicting component selectors.');
  return { selection, positional };
}
