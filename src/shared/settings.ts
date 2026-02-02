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

export interface Settings {
  enabled: boolean;
  baseCurrency: CurrencyCode;
  targets: CurrencyCode[];
  favorites: CurrencyCode[];
  cacheTtlMinutes: number;
  tooltip: TooltipSettings;
  format: FormatSettings;
  detectCurrency: boolean;
  theme: ThemeSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  baseCurrency: 'USD',
  targets: ['EUR', 'USD', 'UAH', 'PLN'],
  favorites: ['EUR', 'USD', 'UAH', 'PLN'],
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
  detectCurrency: false,
  theme: 'system'
};

export const CURRENCY_HINTS = SUPPORTED_CURRENCIES as readonly CurrencyCode[];

export function normalizeCurrencyCode(value: string): CurrencyCode {
  return value.trim().toUpperCase();
}

export function normalizeCurrencyList(values: string[]): CurrencyCode[] {
  const seen = new Set<string>();
  const result: CurrencyCode[] = [];
  values
    .map(normalizeCurrencyCode)
    .filter((code) => code.length > 0)
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
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    baseCurrency: partial.baseCurrency
      ? normalizeCurrencyCode(partial.baseCurrency)
      : DEFAULT_SETTINGS.baseCurrency,
    targets: partial.targets ? normalizeCurrencyList(partial.targets) : DEFAULT_SETTINGS.targets,
    favorites: partial.favorites
      ? normalizeCurrencyList(partial.favorites)
      : DEFAULT_SETTINGS.favorites,
    tooltip: {
      ...DEFAULT_SETTINGS.tooltip,
      ...partial.tooltip
    },
    format,
    theme: normalizeTheme(partial.theme)
  };
}

export function sanitizeSettings(settings: Settings): Settings {
  const base = normalizeCurrencyCode(settings.baseCurrency);
  const targets = normalizeCurrencyList(settings.targets);
  const favorites = normalizeCurrencyList(settings.favorites);
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
  const fixedDecimals = clampDecimals(rawFormat.fixedDecimals, 0, 6, DEFAULT_SETTINGS.format.fixedDecimals);
  const minDecimals = clampDecimals(rawFormat.minDecimals, 0, 4, DEFAULT_SETTINGS.format.minDecimals);
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

  return {
    ...settings,
    baseCurrency: base,
    targets: targets.length ? targets : DEFAULT_SETTINGS.targets,
    favorites: favorites.length ? favorites : DEFAULT_SETTINGS.favorites,
    cacheTtlMinutes: ttl,
    tooltip: {
      ...settings.tooltip,
      autoHideSeconds: autoHide,
      refreshSeconds,
      compact
    },
    format,
    theme: normalizeTheme(settings.theme)
  };
}

function clampDecimals(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
