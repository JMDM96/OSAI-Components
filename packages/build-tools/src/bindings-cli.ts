import { selectComponents } from './registry.js';
import { generateBindings } from './bindings.js';

const args = process.argv.slice(2);
if (args.some((arg) => !['--check', '--all'].includes(arg)))
  throw new Error('Unknown binding option.');
const components = await selectComponents(process.cwd(), {
  all: args.includes('--all'),
  fixtureManifests: [
    'tests/fixtures/minimal/component.manifest.json',
    'tests/fixtures/resources/component.manifest.json',
  ],
});
for (const component of components) {
  await generateBindings(component.manifestFile, args.includes('--check'));
  console.log(
    `${args.includes('--check') ? 'Checked' : 'Generated'} bindings: ${component.manifest.componentId}`,
  );
}
