import type { ComponentController, ComponentDefinition, JsonValue } from './index.js';
declare const controller: ComponentController;
const validResult: JsonValue = controller.commands.open!({});
void validResult;
// @ts-expect-error Promises cannot cross the synchronous JSON command boundary.
const asyncHandler: ComponentController['commands'][string] = async () => null;
void asyncHandler;
// @ts-expect-error DOM nodes cannot cross the public boundary.
const domValue: JsonValue = document.body;
void domValue;
const arbitrary: ComponentDefinition = {
  // @ts-expect-error Arbitrary TypeScript does not conform to the SDK contract.
  render() {
    return 'hello';
  },
};
void arbitrary;
