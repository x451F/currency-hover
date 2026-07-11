const DEBUG_KEY = 'currencyHoverDebug';

export function debugLog(scope: string, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  console.info(`[Currency Hover:${scope}]`, ...args);
}

export function debugWarn(scope: string, ...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  console.warn(`[Currency Hover:${scope}]`, ...args);
}

function isDebugEnabled(): boolean {
  try {
    const search = globalThis.location?.search ?? '';
    if (new URLSearchParams(search).get(DEBUG_KEY) === '1') {
      return true;
    }
  } catch {
    // ignore
  }

  try {
    return globalThis.localStorage?.getItem(DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}
