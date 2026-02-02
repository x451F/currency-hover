import {
  CRYPTO_CACHE_KEY,
  HISTORY_KEY,
  HISTORY_SETTINGS_KEY,
  RATES_CACHE_KEY,
  SETTINGS_KEY
} from './constants';
import type { Settings } from './settings';
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from './settings';

export interface RatesCacheEntry {
  base: string;
  rates: Record<string, number>;
  date: string;
  fetchedAt: number;
}

export type RatesCache = Record<string, RatesCacheEntry>;

export interface CryptoCacheEntry {
  rates: Record<string, number>;
  fetchedAt: number;
}

export interface HistoryEntry {
  ts: number;
  base: string;
  amount: number;
  favoritesSnapshot: string[];
  conversions: Record<string, number>;
  provider?: string;
}

export interface HistorySettings {
  enabled: boolean;
  maxItems: number;
}

const DEFAULT_HISTORY_SETTINGS: HistorySettings = {
  enabled: false,
  maxItems: 200
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  const merged = mergeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
  return sanitizeSettings(merged);
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = sanitizeSettings({
    ...current,
    ...patch,
    tooltip: {
      ...current.tooltip,
      ...(patch.tooltip ?? {})
    },
    format: {
      ...current.format,
      ...(patch.format ?? {})
    },
    copy: {
      ...current.copy,
      ...(patch.copy ?? {})
    }
  });
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function ensureSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }
  const merged = mergeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
  const sanitized = sanitizeSettings(merged);
  if (JSON.stringify(sanitized) !== JSON.stringify(stored[SETTINGS_KEY])) {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: sanitized });
  }
  return sanitized;
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
    const next = mergeSettings(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined);
    callback(sanitizeSettings(next));
  });
}

export async function getRatesCache(): Promise<RatesCache> {
  const stored = await chrome.storage.local.get(RATES_CACHE_KEY);
  return (stored[RATES_CACHE_KEY] as RatesCache | undefined) ?? {};
}

export async function getRatesCacheEntry(base: string): Promise<RatesCacheEntry | null> {
  const cache = await getRatesCache();
  return cache[base] ?? null;
}

export async function setRatesCacheEntry(entry: RatesCacheEntry): Promise<void> {
  const cache = await getRatesCache();
  cache[entry.base] = entry;
  await chrome.storage.local.set({ [RATES_CACHE_KEY]: cache });
}

export async function clearRatesCache(): Promise<void> {
  await chrome.storage.local.remove(RATES_CACHE_KEY);
}

export async function getCryptoCache(): Promise<CryptoCacheEntry | null> {
  const stored = await chrome.storage.local.get(CRYPTO_CACHE_KEY);
  return (stored[CRYPTO_CACHE_KEY] as CryptoCacheEntry | undefined) ?? null;
}

export async function setCryptoCache(entry: CryptoCacheEntry): Promise<void> {
  await chrome.storage.local.set({ [CRYPTO_CACHE_KEY]: entry });
}

export async function clearCryptoCache(): Promise<void> {
  await chrome.storage.local.remove(CRYPTO_CACHE_KEY);
}

export async function getHistoryEntries(): Promise<HistoryEntry[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return (stored[HISTORY_KEY] as HistoryEntry[] | undefined) ?? [];
}

export async function addHistoryEntry(entry: HistoryEntry, maxItems: number): Promise<void> {
  const history = await getHistoryEntries();
  history.unshift(entry);
  if (history.length > maxItems) {
    history.length = maxItems;
  }
  await chrome.storage.local.set({ [HISTORY_KEY]: history });
}

export async function clearHistoryEntries(): Promise<void> {
  await chrome.storage.local.remove(HISTORY_KEY);
}

export async function getHistorySettings(): Promise<HistorySettings> {
  const stored = await chrome.storage.local.get(HISTORY_SETTINGS_KEY);
  const settings = (stored[HISTORY_SETTINGS_KEY] as HistorySettings | undefined) ?? DEFAULT_HISTORY_SETTINGS;
  return sanitizeHistorySettings(settings);
}

export async function setHistorySettings(patch: Partial<HistorySettings>): Promise<HistorySettings> {
  const current = await getHistorySettings();
  const next = sanitizeHistorySettings({ ...current, ...patch });
  await chrome.storage.local.set({ [HISTORY_SETTINGS_KEY]: next });
  return next;
}

function sanitizeHistorySettings(settings: HistorySettings): HistorySettings {
  const enabled = Boolean(settings.enabled);
  const maxItems = Number.isFinite(settings.maxItems)
    ? Math.max(50, Math.min(2000, Math.round(settings.maxItems)))
    : DEFAULT_HISTORY_SETTINGS.maxItems;
  return { enabled, maxItems };
}
