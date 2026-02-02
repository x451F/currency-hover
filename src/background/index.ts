import { ensureSettings, getSettings } from '../shared/storage';
import { normalizeCurrencyList } from '../shared/settings';
import { getRates } from './fxService';
import { getCryptoRates, isCryptoCurrency } from './cryptoService';
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

  const needsCrypto = isCryptoCurrency(base) || targets.some((code) => isCryptoCurrency(code));
  if (!needsCrypto) {
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

  const cryptoResult = await getCryptoRates(message.payload.forceRefresh ?? false);
  const conversions: Record<string, number> = {};
  const cryptoRates = cryptoResult.rates;
  const errorMessages: string[] = [];
  if (cryptoResult.error) {
    errorMessages.push(cryptoResult.error);
  }

  if (isCryptoCurrency(base)) {
    const basePrice = cryptoRates[base];
    if (!basePrice) {
      return { base, conversions: {}, error: `Missing crypto rate for ${base}.` };
    }
    const usdAmount = message.payload.amount * basePrice;
    const fiatTargets = targets.filter((code) => !isCryptoCurrency(code));
    const fxResult =
      fiatTargets.length > 0
        ? await getRates('USD', message.payload.forceRefresh ?? false, fiatTargets)
        : null;

    if (fxResult?.error) {
      errorMessages.push(fxResult.error);
    }

    for (const target of targets) {
      if (target === base) {
        conversions[target] = message.payload.amount;
        continue;
      }
      if (isCryptoCurrency(target)) {
        const price = cryptoRates[target];
        if (price) {
          conversions[target] = usdAmount / price;
        }
        continue;
      }
      const rate = fxResult?.rates[target];
      if (typeof rate === 'number') {
        conversions[target] = usdAmount * rate;
      }
    }

    return {
      base,
      conversions,
      date: fxResult?.date ?? '',
      fetchedAt: fxResult?.fetchedAt ?? cryptoResult.fetchedAt,
      error: errorMessages.length ? errorMessages.join('; ') : undefined,
      stale: fxResult?.stale
    };
  }

  const fiatTargets = targets.filter((code) => !isCryptoCurrency(code));
  const needsUsd = targets.some((code) => isCryptoCurrency(code)) && base !== 'USD';
  const fxTargets = needsUsd ? [...fiatTargets, 'USD'] : fiatTargets;
  const fxResult = await getRates(base, message.payload.forceRefresh ?? false, fxTargets);
  if (fxResult.error) {
    errorMessages.push(fxResult.error);
  }

  let usdAmount = base === 'USD' ? message.payload.amount : null;
  if (needsUsd) {
    const usdRate = fxResult.rates['USD'];
    if (typeof usdRate === 'number') {
      usdAmount = message.payload.amount * usdRate;
    } else {
      errorMessages.push('Missing USD rate for crypto conversion.');
    }
  }

  for (const target of targets) {
    if (target === base) {
      conversions[target] = message.payload.amount;
      continue;
    }
    if (isCryptoCurrency(target)) {
      if (usdAmount === null) continue;
      const price = cryptoRates[target];
      if (price) {
        conversions[target] = usdAmount / price;
      }
      continue;
    }
    const rate = fxResult.rates[target];
    if (typeof rate === 'number') {
      conversions[target] = message.payload.amount * rate;
    }
  }

  return {
    base,
    conversions,
    date: fxResult.date,
    fetchedAt: fxResult.fetchedAt,
    error: errorMessages.length ? errorMessages.join('; ') : undefined,
    stale: fxResult.stale
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
