type StorageAreaName = 'local' | 'sync';
type StorageItems = Record<string, unknown>;
type StorageChanges = Record<string, chrome.storage.StorageChange>;
type StorageChangedListener = (changes: StorageChanges, areaName: string) => void;
type RuntimeMessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void | Promise<unknown>;

interface PromiseStorageArea {
  get(keys?: string | string[] | StorageItems | null): Promise<StorageItems>;
  set(items: StorageItems): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface BrowserLike {
  runtime?: {
    sendMessage?: (message: unknown) => Promise<unknown>;
    getURL?: (path: string) => string;
    onInstalled?: {
      addListener(callback: () => void): void;
    };
    onMessage?: {
      addListener(
        callback: (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse?: (response?: unknown) => void
        ) => boolean | void | Promise<unknown>
      ): void;
    };
  };
  storage?: {
    local?: PromiseStorageArea;
    sync?: PromiseStorageArea;
    onChanged?: {
      addListener(callback: StorageChangedListener): void;
    };
  };
}

export function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  const browserRuntime = getBrowserApi()?.runtime;
  if (browserRuntime?.sendMessage) {
    return browserRuntime.sendMessage(message) as Promise<T>;
  }

  const chromeRuntime = globalThis.chrome?.runtime;
  if (!chromeRuntime?.sendMessage) {
    return Promise.reject(new Error('Extension context unavailable. Reload this tab and try again.'));
  }

  return new Promise((resolve, reject) => {
    chromeRuntime.sendMessage(message, (response) => {
      const err = chromeRuntime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response as T);
    });
  });
}

export function addRuntimeInstalledListener(callback: () => void): void {
  const browserRuntime = getBrowserApi()?.runtime;
  if (browserRuntime?.onInstalled) {
    browserRuntime.onInstalled.addListener(callback);
    return;
  }
  globalThis.chrome?.runtime?.onInstalled.addListener(callback);
}

export function addRuntimeMessageListener(callback: RuntimeMessageListener): void {
  const browserRuntime = getBrowserApi()?.runtime;
  if (browserRuntime?.onMessage) {
    browserRuntime.onMessage.addListener((message, sender) => {
      let didRespond = false;
      let resolveResponse: ((response: unknown) => void) | null = null;
      const responsePromise = new Promise<unknown>((resolve) => {
        resolveResponse = resolve;
      });
      const sendResponse = (response?: unknown): void => {
        didRespond = true;
        resolveResponse?.(response);
      };
      const result = callback(message, sender, sendResponse);
      if (result === true || didRespond) {
        return responsePromise;
      }
      if (result instanceof Promise) {
        return result;
      }
      return result;
    });
    return;
  }
  globalThis.chrome?.runtime?.onMessage.addListener(callback);
}

export function getExtensionUrl(path: string): string {
  const browserRuntime = getBrowserApi()?.runtime;
  if (browserRuntime?.getURL) {
    return browserRuntime.getURL(path);
  }
  if (globalThis.chrome?.runtime?.getURL) {
    return globalThis.chrome.runtime.getURL(path);
  }
  return `/${path}`;
}

export function storageGet(areaName: StorageAreaName, key: string): Promise<StorageItems> {
  const browserArea = getBrowserApi()?.storage?.[areaName];
  if (browserArea?.get) {
    return browserArea.get(key);
  }

  const chromeArea = globalThis.chrome?.storage?.[areaName];
  if (!chromeArea?.get) {
    return Promise.reject(new Error('Extension storage unavailable.'));
  }

  return new Promise((resolve, reject) => {
    chromeArea.get(key, (items) => {
      const err = globalThis.chrome?.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(items as StorageItems);
    });
  });
}

export function storageSet(areaName: StorageAreaName, items: StorageItems): Promise<void> {
  const browserArea = getBrowserApi()?.storage?.[areaName];
  if (browserArea?.set) {
    return browserArea.set(items);
  }

  const chromeArea = globalThis.chrome?.storage?.[areaName];
  if (!chromeArea?.set) {
    return Promise.reject(new Error('Extension storage unavailable.'));
  }

  return new Promise((resolve, reject) => {
    chromeArea.set(items, () => {
      const err = globalThis.chrome?.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

export function storageRemove(areaName: StorageAreaName, key: string): Promise<void> {
  const browserArea = getBrowserApi()?.storage?.[areaName];
  if (browserArea?.remove) {
    return browserArea.remove(key);
  }

  const chromeArea = globalThis.chrome?.storage?.[areaName];
  if (!chromeArea?.remove) {
    return Promise.reject(new Error('Extension storage unavailable.'));
  }

  return new Promise((resolve, reject) => {
    chromeArea.remove(key, () => {
      const err = globalThis.chrome?.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

export function addStorageChangedListener(callback: StorageChangedListener): void {
  const browserStorage = getBrowserApi()?.storage;
  if (browserStorage?.onChanged) {
    browserStorage.onChanged.addListener(callback);
    return;
  }
  globalThis.chrome?.storage?.onChanged.addListener(callback);
}

function getBrowserApi(): BrowserLike | undefined {
  return (globalThis as typeof globalThis & { browser?: BrowserLike }).browser;
}
