import { expect, it } from 'vitest';
import { scanManagedAllocations } from './ownership.js';

it.each([
  'document.addEventListener("x", handler)',
  'const target=document; target["addEventListener"]("x", handler)',
  'setTimeout(handler,1)',
  'window.setInterval(handler,1)',
  'requestAnimationFrame(handler)',
  'new MutationObserver(handler)',
  'new ResizeObserver(handler)',
  'new IntersectionObserver(handler)',
  'new Worker("worker.js")',
  'document.body.appendChild(portal)',
  'const body=document.body;body.append(portal)',
])('rejects direct allocation: %s', (source) =>
  expect(scanManagedAllocations(source)).toHaveLength(1),
);
it('permits managed adoption and a narrowly declared provider callback', () => {
  expect(
    scanManagedAllocations(
      'resources.listen(document,"x",handler);resources.worker(new Worker("worker.js"));scope.observer(new ResizeObserver(handler));',
    ),
  ).toEqual([]);
  const boundary = `resources.adoptProvider({id:'test',capabilities:['listeners'],partialInitialization:'register-cleanup-before-allocation',update:'transactional',disposal:'scope'}, scope => {scope.add(()=>document.removeEventListener('x',handler));document.addEventListener('x',handler);});`;
  expect(scanManagedAllocations(boundary)).toEqual([]);
  expect(scanManagedAllocations(boundary.replace("['listeners']", "['workers']"))).toHaveLength(1);
  expect(
    scanManagedAllocations(
      boundary.replace("scope.add(()=>document.removeEventListener('x',handler));", ''),
    ),
  ).toHaveLength(1);
  expect(
    scanManagedAllocations(boundary + 'document.addEventListener("outside",handler);'),
  ).toHaveLength(1);
});
