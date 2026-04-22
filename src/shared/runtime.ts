export function sendMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const runtime = getRuntime();
    if (!runtime?.sendMessage) {
      reject(new Error('Extension context unavailable. Reload this tab and try again.'));
      return;
    }
    runtime.sendMessage(message, (response) => {
      const err = runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}

function getRuntime(): chrome.runtime.ExtensionContext | null {
  const chromeRuntime = globalThis.chrome?.runtime;
  if (chromeRuntime) return chromeRuntime;

  const browserRuntime = (globalThis as typeof globalThis & {
    browser?: { runtime?: chrome.runtime.ExtensionContext };
  }).browser?.runtime;
  return browserRuntime ?? null;
}
