import { ensureSettings, getSettings } from '../shared/storage';
import { isSupportedCurrency, normalizeCurrencyCode, normalizeCurrencyList } from '../shared/settings';
import { getRates } from './fxService';
import { getCryptoRates, isCryptoCurrency } from './cryptoService';
import type { ConvertRequest, ConvertResponse, RefreshRatesRequest, RefreshResponse } from './messaging';

const MAX_TARGETS = 32;
const MAX_ABS_AMOUNT = 1_000_000_000_000_000;

chrome.runtime.onInstalled.addListener(() => {
  void ensureSettings();
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const request = parseRequest(message);
  if (!request.ok) {
    sendResponse(request.response);
    return false;
  }

  if (request.message.type === 'CONVERT') {
    void handleConvert(request.message).then(sendResponse);
    return true;
  }

  if (request.message.type === 'REFRESH_RATES') {
    void handleRefresh(request.message).then(sendResponse);
    return true;
  }

  return false;
});

type ParsedRequest =
  | { ok: true; message: ConvertRequest | RefreshRatesRequest }
  | { ok: false; response: ConvertResponse | RefreshResponse };

function parseRequest(message: unknown): ParsedRequest {
  if (!message || typeof message !== 'object' || !('type' in message)) {
    return invalidConvertResponse();
  }

  const raw = message as { type?: unknown; payload?: unknown };
  if (raw.type === 'CONVERT') {
    return parseConvertRequest(raw.payload);
  }
  if (raw.type === 'REFRESH_RATES') {
    return parseRefreshRequest(raw.payload);
  }
  return invalidConvertResponse();
}

function parseConvertRequest(payload: unknown): ParsedRequest {
  if (!payload || typeof payload !== 'object') {
    return invalidConvertResponse();
  }
  const raw = payload as {
    amount?: unknown;
    base?: unknown;
    targets?: unknown;
    forceRefresh?: unknown;
  };
  if (!Number.isFinite(raw.amount) || Math.abs(raw.amount as number) > MAX_ABS_AMOUNT) {
    return invalidConvertResponse();
  }
  if (typeof raw.base !== 'string' || !isSupportedCurrency(raw.base)) {
    return invalidConvertResponse();
  }
  if (!Array.isArray(raw.targets)) {
    return invalidConvertResponse();
  }
  const targets = normalizeCurrencyList(
    raw.targets.filter((target): target is string => typeof target === 'string')
  ).slice(0, MAX_TARGETS);
  if (!targets.length) {
    return invalidConvertResponse();
  }

  return {
    ok: true,
    message: {
      type: 'CONVERT',
      payload: {
        amount: raw.amount as number,
        base: normalizeCurrencyCode(raw.base),
        targets,
        forceRefresh: raw.forceRefresh === true
      }
    }
  };
}

function parseRefreshRequest(payload: unknown): ParsedRequest {
  if (payload === undefined) {
    return { ok: true, message: { type: 'REFRESH_RATES' } };
  }
  if (!payload || typeof payload !== 'object') {
    return { ok: false, response: { ok: false, error: 'Invalid request.' } };
  }
  const raw = payload as { base?: unknown };
  if (raw.base !== undefined && (typeof raw.base !== 'string' || !isSupportedCurrency(raw.base))) {
    return { ok: false, response: { ok: false, error: 'Invalid request.' } };
  }
  return {
    ok: true,
    message: {
      type: 'REFRESH_RATES',
      payload: raw.base ? { base: normalizeCurrencyCode(raw.base) } : undefined
    }
  };
}

function invalidConvertResponse(): ParsedRequest {
  return {
    ok: false,
    response: { base: '', conversions: {}, error: 'Invalid request.' }
  };
}

async function handleConvert(message: ConvertRequest): Promise<ConvertResponse> {
  const settings = await getSettings();
  const base = normalizeCurrencyCode(message.payload.base || settings.baseCurrency);
  const targets = normalizeCurrencyList(message.payload.targets).slice(0, MAX_TARGETS);

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
    const fxTargets = fiatTargets.filter((code) => code !== 'USD');
    const fxResult =
      fxTargets.length > 0
        ? await getRates('USD', message.payload.forceRefresh ?? false, fxTargets)
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
      if (target === 'USD') {
        conversions[target] = usdAmount;
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
      stale: Boolean(fxResult?.stale || cryptoResult.stale)
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
    stale: Boolean(fxResult.stale || cryptoResult.stale)
  };
}

async function handleRefresh(message: RefreshRatesRequest): Promise<RefreshResponse> {
  const settings = await getSettings();
  const base = normalizeCurrencyCode(message.payload?.base ?? settings.baseCurrency);
  const targets = normalizeCurrencyList(settings.targets);
  const needsCrypto = isCryptoCurrency(base) || targets.some((code) => isCryptoCurrency(code));
  if (needsCrypto) {
    const cryptoResult = await getCryptoRates(true);
    if (cryptoResult.error) {
      return { ok: false, error: cryptoResult.error };
    }
  }
  if (isCryptoCurrency(base)) {
    return { ok: true };
  }
  const result = await getRates(base, true);
  if (result.error) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}
