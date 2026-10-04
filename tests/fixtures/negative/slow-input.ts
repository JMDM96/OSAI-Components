/** Deliberately unsafe synchronous provider used only by negative qualification. */
export function installSlowInput(element: HTMLElement, milliseconds: number): () => void {
  const block = () => {
    const start = performance.now();
    while (performance.now() - start <= milliseconds) {
      // Intentionally blocks input to prove the finite profile rejects it.
    }
  };
  element.addEventListener('negative-slow-input', block);
  return () => element.removeEventListener('negative-slow-input', block);
}
