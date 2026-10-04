globalThis.addEventListener('message', (event) => {
  globalThis.postMessage(String(event.data));
});
