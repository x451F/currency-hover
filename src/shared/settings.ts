import { SUPPORTED_CURRENCIES } from './constants';
import { normalizeTheme, type ThemeSetting } from './theme';

export type CurrencyCode = string;

export interface TooltipSettings {
  autoHideSeconds: number;
  showRateDate: boolean;
  compact: boolean;
  refreshSeconds: number;
}

export interface FormatSettings {
  mode: 'auto' | 'fixed';
  fixedDecimals: number;
  minDecimals: number;
  maxDecimals: number;
  grouping: boolean;
  compact: boolean;
  copyMode: 'formatted' | 'raw';
}

export interface CopySettings {
  decimals: number;
  includeCode: boolean;
  includeSymbol: boolean;
  mode: 'default' | 'raw' | 'formatted';
}

export interface FavoritesGroup {
  id: string;
  name: string;
  favorites: CurrencyCode[];
}

export interface FavoritesGroups {
  activeId: string;
  groups: FavoritesGroup[];
}

export interface Settings {
  enabled: boolean;
  baseCurrency: CurrencyCode;
  targets: CurrencyCode[];
  favorites: CurrencyCode[];
  favoritesGroups: FavoritesGroups;
  cacheTtlMinutes: number;
  tooltip: TooltipSettings;
  format: FormatSettings;
  copy: CopySettings;
  detectCurrency: boolean;
  theme: ThemeSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  baseCurrency: 'USD',
  targets: ['EUR', 'USD', 'UAH', 'PLN'],
  favorites: ['EUR', 'USD', 'UAH', 'PLN'],
  favoritesGroups: {
    activeId: 'default',
    groups: [
      {
        id: 'default',
        name: 'Default',
        favorites: ['EUR', 'USD', 'UAH', 'PLN']
      }
    ]
  },
  cacheTtlMinutes: 60,
  tooltip: {
    autoHideSeconds: 6,
    showRateDate: true,
    compact: false,
    refreshSeconds: 300
  },
  format: {
    mode: 'auto',
    fixedDecimals: 2,
    minDecimals: 2,
    maxDecimals: 4,
    grouping: true,
    compact: false,
    copyMode: 'formatted'
  },
  copy: {
    decimals: 2,
    includeCode: false,
    includeSymbol: false,
    mode: 'default'
  },
  detectCurrency: false,
  theme: 'system'
};

export const CURRENCY_HINTS = SUPPORTED_CURRENCIES as readonly CurrencyCode[];
const SUPPORTED_SET = new Set<string>(SUPPORTED_CURRENCIES);

export function isSupportedCurrency(value: string): boolean {
  return SUPPORTED_SET.has(normalizeCurrencyCode(value));
}

export function normalizeCurrencyCode(value: string): CurrencyCode {
  return value.trim().toUpperCase();
}

export function normalizeCurrencyList(values: string[]): CurrencyCode[] {
  const seen = new Set<string>();
  const result: CurrencyCode[] = [];
  values
    .map(normalizeCurrencyCode)
    .filter((code) => SUPPORTED_SET.has(code))
    .forEach((code) => {
      if (!seen.has(code)) {
        seen.add(code);
        result.push(code);
      }
    });
  return result;
}

export function mergeSettings(partial: Partial<Settings> | undefined | null): Settings {
  if (!partial) {
    return DEFAULT_SETTINGS;
  }
  const legacyCompact = (partial as { tooltip?: { compact?: boolean } }).tooltip?.compact;
  const format: FormatSettings = {
    ...DEFAULT_SETTINGS.format,
    ...(partial.format ?? {})
  };
  if (typeof legacyCompact === 'boolean' && partial.format?.compact === undefined) {
    format.compact = legacyCompact;
  }
  const legacyCopyMode = partial.format?.copyMode;
  const copy: CopySettings = {
    ...DEFAULT_SETTINGS.copy,
    ...(partial.copy ?? {})
  };
  if (legacyCopyMode && partial.copy?.mode === undefined) {
    copy.mode = legacyCopyMode === 'raw' ? 'raw' : 'formatted';
  }
  const partialSettings = { ...partial } as Partial<Settings> & {
    entitlements?: unknown;
  };
  delete partialSettings.entitlements;
  const favoritesGroups = buildFavoritesGroups(partial);
  const normalizedTargets = partial.targets
    ? normalizeCurrencyList(partial.targets)
    : DEFAULT_SETTINGS.targets;
  const normalizedFavorites = partial.favorites
    ? normalizeCurrencyList(partial.favorites)
    : partial.targets
      ? normalizeCurrencyList(partial.targets)
      : DEFAULT_SETTINGS.favorites;
  return {
    ...DEFAULT_SETTINGS,
    ...partialSettings,
    baseCurrency: partial.baseCurrency
      ? normalizeCurrencyCode(partial.baseCurrency)
      : DEFAULT_SETTINGS.baseCurrency,
    targets: normalizedTargets,
    favorites: normalizedFavorites,
    favoritesGroups,
    tooltip: {
      ...DEFAULT_SETTINGS.tooltip,
      ...partial.tooltip
    },
    format,
    copy,
    theme: normalizeTheme(partial.theme)
  };
}

export function sanitizeSettings(settings: Settings): Settings {
  const normalizedBase = normalizeCurrencyCode(settings.baseCurrency);
  const base = SUPPORTED_SET.has(normalizedBase) ? normalizedBase : DEFAULT_SETTINGS.baseCurrency;
  const targets = normalizeCurrencyList(settings.targets);
  const favorites = normalizeCurrencyList(settings.favorites);
  const favoritesGroups = sanitizeFavoritesGroups(settings.favoritesGroups, favorites);
  const ttl = Number.isFinite(settings.cacheTtlMinutes)
    ? Math.max(1, Math.round(settings.cacheTtlMinutes))
    : DEFAULT_SETTINGS.cacheTtlMinutes;
  const autoHide = Number.isFinite(settings.tooltip.autoHideSeconds)
    ? Math.max(0, Math.round(settings.tooltip.autoHideSeconds))
    : DEFAULT_SETTINGS.tooltip.autoHideSeconds;
  const refreshSeconds = Number.isFinite(settings.tooltip.refreshSeconds)
    ? Math.max(30, Math.round(settings.tooltip.refreshSeconds))
    : DEFAULT_SETTINGS.tooltip.refreshSeconds;
  const rawFormat = settings.format ?? DEFAULT_SETTINGS.format;
  const mode = rawFormat.mode === 'fixed' ? 'fixed' : 'auto';
  const fixedDecimals = clampDecimals(rawFormat.fixedDecimals, 0, 8, DEFAULT_SETTINGS.format.fixedDecimals);
  const minDecimals = clampDecimals(rawFormat.minDecimals, 0, 6, DEFAULT_SETTINGS.format.minDecimals);
  const maxDecimals = clampDecimals(
    rawFormat.maxDecimals,
    minDecimals,
    6,
    DEFAULT_SETTINGS.format.maxDecimals
  );
  const legacyCompact = (settings as { tooltip?: { compact?: boolean } }).tooltip?.compact;
  const compact =
    typeof legacyCompact === 'boolean'
      ? legacyCompact
      : typeof rawFormat.compact === 'boolean'
        ? rawFormat.compact
        : DEFAULT_SETTINGS.format.compact;
  const grouping = typeof rawFormat.grouping === 'boolean' ? rawFormat.grouping : DEFAULT_SETTINGS.format.grouping;
  const copyMode = rawFormat.copyMode === 'raw' ? 'raw' : 'formatted';
  const format: FormatSettings = {
    mode,
    fixedDecimals,
    minDecimals,
    maxDecimals,
    grouping,
    compact,
    copyMode
  };
  const rawCopy = settings.copy ?? DEFAULT_SETTINGS.copy;
  const copy: CopySettings = {
    decimals: clampDecimals(rawCopy.decimals, 0, 8, DEFAULT_SETTINGS.copy.decimals),
    includeCode: Boolean(rawCopy.includeCode),
    includeSymbol: Boolean(rawCopy.includeSymbol),
    mode: rawCopy.mode === 'raw' || rawCopy.mode === 'formatted' ? rawCopy.mode : 'default'
  };
  const settingsWithoutLegacy = { ...settings } as Settings & {
    entitlements?: unknown;
  };
  delete settingsWithoutLegacy.entitlements;
  let activeFavorites = getActiveFavorites(favoritesGroups, favorites);
  let syncedGroups = favoritesGroups;
  if (favorites.length && !arraysEqual(activeFavorites, favorites)) {
    syncedGroups = syncActiveGroupFavorites(favoritesGroups, favorites);
    activeFavorites = getActiveFavorites(syncedGroups, favorites);
  }

  return {
    ...settingsWithoutLegacy,
    baseCurrency: base,
    targets: targets.length ? targets : activeFavorites.length ? activeFavorites : DEFAULT_SETTINGS.targets,
    favorites: activeFavorites.length ? activeFavorites : DEFAULT_SETTINGS.favorites,
    favoritesGroups: syncedGroups,
    cacheTtlMinutes: ttl,
    tooltip: {
      ...settings.tooltip,
      autoHideSeconds: autoHide,
      refreshSeconds,
      compact
    },
    format,
    copy,
    theme: normalizeTheme(settings.theme)
  };
}

function clampDecimals(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function buildFavoritesGroups(partial: Partial<Settings> | undefined | null): FavoritesGroups {
  const existing = partial?.favoritesGroups;
  if (existing && Array.isArray(existing.groups) && existing.groups.length > 0) {
    return existing as FavoritesGroups;
  }
  const favorites = partial?.favorites?.length
    ? normalizeCurrencyList(partial.favorites)
    : partial?.targets?.length
      ? normalizeCurrencyList(partial.targets)
      : DEFAULT_SETTINGS.favorites;
  return {
    activeId: 'default',
    groups: [
      {
        id: 'default',
        name: 'Default',
        favorites
      }
    ]
  };
}

function sanitizeFavoritesGroups(groups: FavoritesGroups | undefined, fallbackFavorites: CurrencyCode[]): FavoritesGroups {
  const baseGroups = groups && Array.isArray(groups.groups) && groups.groups.length > 0 ? groups : null;
  const normalizedGroups: FavoritesGroup[] = baseGroups
    ? baseGroups.groups.map((group) => ({
        id: group.id || `group-${Math.random().toString(36).slice(2, 8)}`,
        name: group.name || 'Group',
        favorites: normalizeCurrencyList(group.favorites ?? [])
      }))
    : [
        {
          id: 'default',
          name: 'Default',
          favorites: fallbackFavorites.length ? fallbackFavorites : DEFAULT_SETTINGS.favorites
        }
      ];
  const activeId = baseGroups?.activeId ?? normalizedGroups[0].id;
  const activeExists = normalizedGroups.some((group) => group.id === activeId);
  return {
    activeId: activeExists ? activeId : normalizedGroups[0].id,
    groups: normalizedGroups
  };
}

function getActiveFavorites(groups: FavoritesGroups, fallbackFavorites: CurrencyCode[]): CurrencyCode[] {
  const active = groups.groups.find((group) => group.id === groups.activeId);
  if (active && active.favorites.length) return active.favorites;
  if (fallbackFavorites.length) return fallbackFavorites;
  return DEFAULT_SETTINGS.favorites;
}

function syncActiveGroupFavorites(groups: FavoritesGroups, favorites: CurrencyCode[]): FavoritesGroups {
  const index = groups.groups.findIndex((group) => group.id === groups.activeId);
  const activeIndex = index >= 0 ? index : 0;
  const nextGroups = [...groups.groups];
  nextGroups[activeIndex] = {
    ...nextGroups[activeIndex],
    favorites
  };
  return {
    activeId: nextGroups[activeIndex].id,
    groups: nextGroups
  };
}

function arraysEqual(a: CurrencyCode[], b: CurrencyCode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}
