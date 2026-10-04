import { readFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { scanManagedAllocations } from './ownership.js';
import { parseSelection } from './selection.js';

it('resolves repository skill references and executable selected-component commands', async () => {
  const root = process.cwd();
  const workflow = JSON.parse(
    await readFile(join(root, 'tests/workflows/authoring-v1.json'), 'utf8'),
  );
  const metadata = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  expect(workflow.schemaVersion).toBe('1.0');
  for (const skill of workflow.skills as string[]) {
    const file = join(root, '.agents/skills', skill, 'SKILL.md');
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1]!;
      expect(link.startsWith('http')).toBe(false);
      await access(resolve(dirname(file), link));
    }
  }
  for (const command of workflow.positive.commands as { script: string; arguments: string[] }[]) {
    expect(metadata.scripts[command.script]).toBeTruthy();
    if (command.arguments.includes('--component'))
      expect(parseSelection(command.arguments).selection.component).toBe(
        workflow.positive.componentId,
      );
  }
  for (const example of workflow.negative as { source: string; gate: string }[])
    expect(
      scanManagedAllocations(example.source).some((issue) => issue.code === example.gate),
    ).toBe(true);
});
