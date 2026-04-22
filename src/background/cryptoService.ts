import { getCryptoCache, setCryptoCache } from '../shared/storage';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3/simple/price';
const CRYPTO_TTL_MS = 90 * 1000;

const CRYPTO_ASSETS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  SOL: 'solana'
};

export interface CryptoRatesResult {
  rates: Record<string, number>;
  fetchedAt: number;
  error?: string;
  stale?: boolean;
}

export function isCryptoCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CRYPTO_ASSETS, code);
}

export function getSupportedCrypto(): string[] {
  return Object.keys(CRYPTO_ASSETS);
}

export async function getCryptoRates(forceRefresh = false): Promise<CryptoRatesResult> {
  const cached = await getCryptoCache();
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.fetchedAt < CRYPTO_TTL_MS) {
    return { rates: cached.rates, fetchedAt: cached.fetchedAt };
  }

  const ids = Object.values(CRYPTO_ASSETS).join(',');
  const url = `${COINGECKO_BASE}?ids=${encodeURIComponent(ids)}&vs_currencies=usd`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const statusText = response.statusText ? ` ${response.statusText}` : '';
      const message =
        response.status === 429
          ? 'Crypto rates are temporarily rate limited.'
          : `Crypto API error: ${response.status}${statusText}`;
      throw new Error(message);
    }
    const data = (await response.json()) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Invalid crypto response.');
    }
    const rates: Record<string, number> = {};
    for (const [code, id] of Object.entries(CRYPTO_ASSETS)) {
      const entry = (data as Record<string, { usd?: unknown }>)[id];
      const usd = entry?.usd;
      if (typeof usd === 'number' && Number.isFinite(usd) && usd > 0) {
        rates[code] = usd;
      }
    }
    if (!Object.keys(rates).length) {
      throw new Error('Invalid crypto response.');
    }
    const entry = { rates, fetchedAt: now };
    await setCryptoCache(entry);
    return entry;
  } catch (error) {
    if (cached && Object.keys(cached.rates).length) {
      return {
        rates: cached.rates,
        fetchedAt: cached.fetchedAt,
        stale: true
      };
    }
    return {
      rates: {},
      fetchedAt: now,
      error: error instanceof Error ? error.message : 'Unable to fetch crypto rates.'
    };
  }
}
