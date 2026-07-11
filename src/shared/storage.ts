import {
  CRYPTO_CACHE_KEY,
  HISTORY_KEY,
  HISTORY_SETTINGS_KEY,
  LAST_POPUP_AMOUNT_KEY,
  RATES_CACHE_KEY,
  SETTINGS_KEY
} from './constants';
import type { CopySettings, FormatSettings, Settings, TooltipSettings } from './settings';
import {
  DEFAULT_SETTINGS,
  isSupportedCurrency,
  mergeSettings,
  normalizeCurrencyCode,
  normalizeCurrencyList,
  sanitizeSettings
} from './settings';
import { addStorageChangedListener, storageGet, storageRemove, storageSet } from './extensionApi';

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

export interface LastPopupAmount {
  base: string;
  amount: number;
  updatedAt: number;
}

export type SettingsPatch = Omit<Partial<Settings>, 'tooltip' | 'format' | 'copy'> & {
  tooltip?: Partial<TooltipSettings>;
  format?: Partial<FormatSettings>;
  copy?: Partial<CopySettings>;
};

const DEFAULT_HISTORY_SETTINGS: HistorySettings = {
  enabled: false,
  maxItems: 200
};

export async function getSettings(): Promise<Settings> {
  const stored = await safeStorageGet('sync', SETTINGS_KEY);
  const merged = mergeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
  return sanitizeSettings(merged);
}

export async function setSettings(patch: SettingsPatch): Promise<Settings> {
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
  await storageSet('sync', { [SETTINGS_KEY]: next });
  return next;
}

export async function ensureSettings(): Promise<Settings> {
  const stored = await safeStorageGet('sync', SETTINGS_KEY);
  if (!stored[SETTINGS_KEY]) {
    await safeStorageSet('sync', { [SETTINGS_KEY]: DEFAULT_SETTINGS });
    return DEFAULT_SETTINGS;
  }
  const merged = mergeSettings(stored[SETTINGS_KEY] as Partial<Settings> | undefined);
  const sanitized = sanitizeSettings(merged);
  if (JSON.stringify(sanitized) !== JSON.stringify(stored[SETTINGS_KEY])) {
    await safeStorageSet('sync', { [SETTINGS_KEY]: sanitized });
  }
  return sanitized;
}

export function onSettingsChanged(callback: (settings: Settings) => void): void {
  addStorageChangedListener((changes, area) => {
    if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
    const next = mergeSettings(changes[SETTINGS_KEY].newValue as Partial<Settings> | undefined);
    callback(sanitizeSettings(next));
  });
}

export async function getRatesCache(): Promise<RatesCache> {
  const stored = await safeStorageGet('local', RATES_CACHE_KEY);
  return (stored[RATES_CACHE_KEY] as RatesCache | undefined) ?? {};
}

export async function getRatesCacheEntry(base: string): Promise<RatesCacheEntry | null> {
  const cache = await getRatesCache();
  return cache[base] ?? null;
}

export async function setRatesCacheEntry(entry: RatesCacheEntry): Promise<void> {
  const cache = await getRatesCache();
  cache[entry.base] = entry;
  await safeStorageSet('local', { [RATES_CACHE_KEY]: cache });
}

export async function clearRatesCache(): Promise<void> {
  await safeStorageRemove('local', RATES_CACHE_KEY);
}

export async function getCryptoCache(): Promise<CryptoCacheEntry | null> {
  const stored = await safeStorageGet('local', CRYPTO_CACHE_KEY);
  return (stored[CRYPTO_CACHE_KEY] as CryptoCacheEntry | undefined) ?? null;
}

export async function setCryptoCache(entry: CryptoCacheEntry): Promise<void> {
  await safeStorageSet('local', { [CRYPTO_CACHE_KEY]: entry });
}

export async function clearCryptoCache(): Promise<void> {
  await safeStorageRemove('local', CRYPTO_CACHE_KEY);
}

export async function getHistoryEntries(): Promise<HistoryEntry[]> {
  const stored = await safeStorageGet('local', HISTORY_KEY);
  const entries = Array.isArray(stored[HISTORY_KEY]) ? (stored[HISTORY_KEY] as unknown[]) : [];
  return entries.map(sanitizeHistoryEntry).filter((entry): entry is HistoryEntry => Boolean(entry));
}

export async function addHistoryEntry(entry: HistoryEntry, maxItems: number): Promise<void> {
  const sanitizedEntry = sanitizeHistoryEntry(entry);
  if (!sanitizedEntry) return;
  const history = await getHistoryEntries();
  history.unshift(sanitizedEntry);
  if (history.length > maxItems) {
    history.length = maxItems;
  }
  await safeStorageSet('local', { [HISTORY_KEY]: history });
}

export async function clearHistoryEntries(): Promise<void> {
  await safeStorageRemove('local', HISTORY_KEY);
}

export async function getLastPopupAmount(): Promise<LastPopupAmount | null> {
  const stored = await safeStorageGet('local', LAST_POPUP_AMOUNT_KEY);
  return sanitizeLastPopupAmount(stored[LAST_POPUP_AMOUNT_KEY]);
}

export async function setLastPopupAmount(entry: LastPopupAmount): Promise<void> {
  const sanitized = sanitizeLastPopupAmount(entry);
  if (!sanitized) return;
  await safeStorageSet('local', { [LAST_POPUP_AMOUNT_KEY]: sanitized });
}

export async function getHistorySettings(): Promise<HistorySettings> {
  const stored = await safeStorageGet('local', HISTORY_SETTINGS_KEY);
  const settings = (stored[HISTORY_SETTINGS_KEY] as HistorySettings | undefined) ?? DEFAULT_HISTORY_SETTINGS;
  return sanitizeHistorySettings(settings);
}

export async function setHistorySettings(patch: Partial<HistorySettings>): Promise<HistorySettings> {
  const current = await getHistorySettings();
  const next = sanitizeHistorySettings({ ...current, ...patch });
  await storageSet('local', { [HISTORY_SETTINGS_KEY]: next });
  return next;
}

async function safeStorageGet(area: 'local' | 'sync', key: string): Promise<Record<string, unknown>> {
  try {
    return await storageGet(area, key);
  } catch (error) {
    console.warn(`Currency Hover storage.${area}.get failed:`, error);
    return {};
  }
}

async function safeStorageSet(area: 'local' | 'sync', items: Record<string, unknown>): Promise<void> {
  try {
    await storageSet(area, items);
  } catch (error) {
    console.warn(`Currency Hover storage.${area}.set failed:`, error);
  }
}

async function safeStorageRemove(area: 'local' | 'sync', key: string): Promise<void> {
  try {
    await storageRemove(area, key);
  } catch (error) {
    console.warn(`Currency Hover storage.${area}.remove failed:`, error);
  }
}

function sanitizeHistorySettings(settings: HistorySettings): HistorySettings {
  const enabled = Boolean(settings.enabled);
  const maxItems = Number.isFinite(settings.maxItems)
    ? Math.max(50, Math.min(2000, Math.round(settings.maxItems)))
    : DEFAULT_HISTORY_SETTINGS.maxItems;
  return { enabled, maxItems };
}

function sanitizeLastPopupAmount(entry: unknown): LastPopupAmount | null {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as Partial<LastPopupAmount>;
  if (typeof raw.base !== 'string') return null;
  const base = normalizeCurrencyCode(raw.base);
  if (!isSupportedCurrency(base)) return null;
  if (!Number.isFinite(raw.amount)) return null;
  const amount = typeof raw.amount === 'number' ? raw.amount : 0;
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
    ? Math.max(0, Math.round(raw.updatedAt))
    : Date.now();
  return {
    base,
    amount,
    updatedAt
  };
}

function sanitizeHistoryEntry(entry: unknown): HistoryEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const raw = entry as Partial<HistoryEntry>;
  if (!Number.isFinite(raw.ts) || !Number.isFinite(raw.amount)) return null;
  if (typeof raw.base !== 'string' || !isSupportedCurrency(raw.base)) return null;
  const conversions = sanitizeConversions(raw.conversions);
  if (!Object.keys(conversions).length) return null;
  const favoritesSnapshot = Array.isArray(raw.favoritesSnapshot)
    ? normalizeCurrencyList(raw.favoritesSnapshot.filter((code): code is string => typeof code === 'string'))
    : [];
  const ts = typeof raw.ts === 'number' ? raw.ts : 0;
  const amount = typeof raw.amount === 'number' ? raw.amount : 0;
  return {
    ts: Math.max(0, Math.round(ts)),
    base: normalizeCurrencyCode(raw.base),
    amount,
    favoritesSnapshot,
    conversions,
    provider: typeof raw.provider === 'string' ? raw.provider : undefined
  };
}

function sanitizeConversions(conversions: unknown): Record<string, number> {
  if (!conversions || typeof conversions !== 'object' || Array.isArray(conversions)) return {};
  const sanitized: Record<string, number> = {};
  for (const [code, value] of Object.entries(conversions)) {
    if (!isSupportedCurrency(code) || !Number.isFinite(value)) continue;
    sanitized[normalizeCurrencyCode(code)] = value;
  }
  return sanitized;
}
