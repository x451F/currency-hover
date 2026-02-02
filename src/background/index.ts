import { ensureSettings, getSettings } from '../shared/storage';
import { normalizeCurrencyList } from '../shared/settings';
import { getRates } from './fxService';
import type { BackgroundRequest, ConvertResponse, RefreshResponse } from './messaging';

const normalizeTargets = (targets: string[], _base: string): string[] => normalizeCurrencyList(targets);

chrome.runtime.onInstalled.addListener(() => {
  void ensureSettings();
});

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse) => {
  if (message.type === 'CONVERT') {
    void handleConvert(message).then(sendResponse);
    return true;
  }

  if (message.type === 'REFRESH_RATES') {
    void handleRefresh(message).then(sendResponse);
    return true;
  }

  return false;
});

async function handleConvert(message: BackgroundRequest): Promise<ConvertResponse> {
  if (message.type !== 'CONVERT') {
    return { base: '', conversions: {}, error: 'Invalid request.' };
  }

  const settings = await getSettings();
  const base = (message.payload.base || settings.baseCurrency).toUpperCase();
  const targets = normalizeTargets(
    message.payload.targets && message.payload.targets.length
      ? message.payload.targets
      : settings.targets,
    base
  );

  const ratesResult = await getRates(base, message.payload.forceRefresh ?? false, targets);
  const conversions: Record<string, number> = {};

  for (const target of targets) {
    if (target === base) {
      conversions[target] = message.payload.amount;
      continue;
    }
    const rate = ratesResult.rates[target];
    if (typeof rate === 'number') {
      conversions[target] = message.payload.amount * rate;
    }
  }

  return {
    base,
    conversions,
    date: ratesResult.date,
    fetchedAt: ratesResult.fetchedAt,
    error: ratesResult.error,
    stale: ratesResult.stale
  };
}

async function handleRefresh(message: BackgroundRequest): Promise<RefreshResponse> {
  if (message.type !== 'REFRESH_RATES') {
    return { ok: false, error: 'Invalid request.' };
  }
  const settings = await getSettings();
  const base = (message.payload?.base ?? settings.baseCurrency).toUpperCase();
  const result = await getRates(base, true);
  if (result.error) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}
