import { RATES_CACHE_KEY, SETTINGS_KEY } from './constants';
import type { Settings } from './settings';
import { DEFAULT_SETTINGS, mergeSettings, sanitizeSettings } from './settings';

export interface RatesCacheEntry {
  base: string;
  rates: Record<string, number>;
  date: string;
  fetchedAt: number;
}

export type RatesCache = Record<string, RatesCacheEntry>;

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
