import { SUPPORTED_CURRENCIES } from './constants';
import { normalizeTheme, type ThemeSetting } from './theme';

export type CurrencyCode = string;

export interface TooltipSettings {
  autoHideSeconds: number;
  showRateDate: boolean;
  compact: boolean;
  refreshSeconds: number;
}

export interface Settings {
  enabled: boolean;
  baseCurrency: CurrencyCode;
  targets: CurrencyCode[];
  favorites: CurrencyCode[];
  cacheTtlMinutes: number;
  tooltip: TooltipSettings;
  detectCurrency: boolean;
  theme: ThemeSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  baseCurrency: 'USD',
  targets: ['UAH', 'PLN', 'GBP', 'EUR'],
  favorites: ['UAH', 'PLN', 'GBP', 'EUR'],
  cacheTtlMinutes: 60,
  tooltip: {
    autoHideSeconds: 6,
    showRateDate: true,
    compact: false,
    refreshSeconds: 300
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
    ? Math.max(1, Math.round(settings.tooltip.autoHideSeconds))
    : DEFAULT_SETTINGS.tooltip.autoHideSeconds;
  const refreshSeconds = Number.isFinite(settings.tooltip.refreshSeconds)
    ? Math.max(30, Math.round(settings.tooltip.refreshSeconds))
    : DEFAULT_SETTINGS.tooltip.refreshSeconds;

  return {
    ...settings,
    baseCurrency: base,
    targets: targets.length ? targets : DEFAULT_SETTINGS.targets,
    favorites: favorites.length ? favorites : DEFAULT_SETTINGS.favorites,
    cacheTtlMinutes: ttl,
    tooltip: {
      ...settings.tooltip,
      autoHideSeconds: autoHide,
      refreshSeconds
    },
    theme: normalizeTheme(settings.theme)
  };
}
