import { getRatesCacheEntry, setRatesCacheEntry, getSettings } from '../shared/storage';
import type { RatesCacheEntry } from '../shared/storage';

const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1/latest';
const OPEN_ER_BASE = 'https://open.er-api.com/v6/latest';

export interface RatesResult {
  base: string;
  rates: Record<string, number>;
  date: string;
  error?: string;
  stale?: boolean;
}

interface ProviderResult {
  rates: Record<string, number>;
  date: string;
  error?: string;
}

export async function getRates(
  base: string,
  forceRefresh = false,
  targets: string[] = []
): Promise<RatesResult> {
  const settings = await getSettings();
  const ttlMs = settings.cacheTtlMinutes * 60 * 1000;
  const cached = await getRatesCacheEntry(base);
  const now = Date.now();
  const desiredTargets = targets.filter((code) => code !== base);

  const cacheValid = cached && now - cached.fetchedAt < ttlMs;
  const cacheMissing =
    desiredTargets.length > 0
      ? desiredTargets.some((code) => !cached?.rates || typeof cached.rates[code] !== 'number')
      : false;

  if (!forceRefresh && cacheValid && !cacheMissing && cached) {
    return { base, rates: cached.rates, date: cached.date };
  }

  let combinedRates: Record<string, number> = {};
  let combinedDate = '';
  let errorMessage: string | undefined;

  const frankfurter = await fetchFrankfurter(base);
  if (!frankfurter.error) {
    combinedRates = frankfurter.rates;
    combinedDate = frankfurter.date;
  } else {
    errorMessage = frankfurter.error;
  }

  const missingTargets = desiredTargets.filter(
    (code) => typeof combinedRates[code] !== 'number'
  );

  if (missingTargets.length > 0 || frankfurter.error) {
    const openEr = await fetchOpenEr(base);
    if (!openEr.error) {
      if (missingTargets.length > 0 && Object.keys(combinedRates).length > 0) {
        const supplement: Record<string, number> = {};
        for (const code of missingTargets) {
          const rate = openEr.rates[code];
          if (typeof rate === 'number') {
            supplement[code] = rate;
          }
        }
        combinedRates = { ...combinedRates, ...supplement };
      } else {
        combinedRates = openEr.rates;
      }
      if (!combinedDate) {
        combinedDate = openEr.date;
      }
      errorMessage = undefined;
    } else if (errorMessage) {
      errorMessage = `${errorMessage}; ${openEr.error}`;
    } else {
      errorMessage = openEr.error;
    }
  }

  if (Object.keys(combinedRates).length > 0) {
    const entry: RatesCacheEntry = {
      base,
      rates: combinedRates,
      date: combinedDate,
      fetchedAt: now
    };
    await setRatesCacheEntry(entry);
    return { base, rates: combinedRates, date: combinedDate, error: errorMessage };
  }

  if (cached) {
    return {
      base,
      rates: cached.rates,
      date: cached.date,
      error: errorMessage ?? 'Unable to fetch rates.',
      stale: true
    };
  }

  return {
    base,
    rates: {},
    date: '',
    error: errorMessage ?? 'Unable to fetch rates.'
  };
}

async function fetchFrankfurter(base: string): Promise<ProviderResult> {
  const url = `${FRANKFURTER_BASE}?from=${encodeURIComponent(base)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(`Frankfurter API error: ${response.status}${statusText} for ${url}`);
    }
    const data = (await response.json()) as unknown;
    const parsed = data as {
      base?: string;
      rates: Record<string, number>;
      date: string;
    };
    if (
      !data ||
      typeof data !== 'object' ||
      !parsed.rates ||
      typeof parsed.rates !== 'object' ||
      Array.isArray(parsed.rates) ||
      typeof parsed.date !== 'string'
    ) {
      throw new Error(`Invalid Frankfurter response from ${url}`);
    }
    return { rates: parsed.rates, date: parsed.date };
  } catch (error) {
    return {
      rates: {},
      date: '',
      error: error instanceof Error ? error.message : 'Unable to fetch rates.'
    };
  }
}

async function fetchOpenEr(base: string): Promise<ProviderResult> {
  const url = `${OPEN_ER_BASE}/${encodeURIComponent(base)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      throw new Error(`Open ER API error: ${response.status}${statusText} for ${url}`);
    }
    const data = (await response.json()) as unknown;
    const parsed = data as {
      result?: string;
      rates: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (
      !data ||
      typeof data !== 'object' ||
      parsed.result !== 'success' ||
      !parsed.rates ||
      typeof parsed.rates !== 'object' ||
      Array.isArray(parsed.rates)
    ) {
      throw new Error(`Invalid Open ER response from ${url}`);
    }
    const date = normalizeDate(parsed.time_last_update_utc);
    return { rates: parsed.rates, date };
  } catch (error) {
    return {
      rates: {},
      date: '',
      error: error instanceof Error ? error.message : 'Unable to fetch rates.'
    };
  }
}

function normalizeDate(value?: string): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}
