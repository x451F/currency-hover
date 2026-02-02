import { getCurrencySymbol } from './currencyMeta';
import { DEFAULT_SETTINGS, type CopySettings, type FormatSettings } from './settings';

const DEFAULT_FORMAT = DEFAULT_SETTINGS.format;

export function formatMoney(value: number, currency: string, format?: FormatSettings): string {
  if (!Number.isFinite(value)) return '';
  const resolved = resolveFormat(format);
  const { minimumFractionDigits, maximumFractionDigits } = getFractionDigits(value, resolved);
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      notation: resolved.compact ? 'compact' : 'standard',
      useGrouping: resolved.grouping,
      minimumFractionDigits,
      maximumFractionDigits
    });
    return formatter.format(value);
  } catch {
    return `${currency} ${formatNumber(value, resolved)}`;
  }
}

export function formatNumber(value: number, format?: FormatSettings): string {
  if (!Number.isFinite(value)) return '';
  const resolved = resolveFormat(format);
  const { minimumFractionDigits, maximumFractionDigits } = getFractionDigits(value, resolved);
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'decimal',
      notation: resolved.compact ? 'compact' : 'standard',
      useGrouping: resolved.grouping,
      minimumFractionDigits,
      maximumFractionDigits
    });
    return formatter.format(value);
  } catch {
    return value.toFixed(maximumFractionDigits);
  }
}

export function normalizedFixed(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '';
  const fixed = value.toFixed(decimals);
  const normalized = fixed.replace(',', '.');
  if (Number(normalized) === 0) {
    return normalized.replace(/^-/, '');
  }
  return normalized;
}

export function formatCopyValue(
  value: number,
  currency: string,
  copy: CopySettings,
  format?: FormatSettings
): string {
  if (!Number.isFinite(value)) return '';
  const mode = copy.mode;
  const decimals = clampDecimals(Number.isFinite(copy.decimals) ? copy.decimals : 2, 0, 8);
  if (mode === 'raw') {
    const base = normalizedFixed(value, decimals);
    return copy.includeCode ? `${base} ${currency}` : base;
  }

  if (mode === 'formatted') {
    const resolved = resolveFormat(format);
    if (copy.includeCode) {
      return formatMoney(value, currency, resolved);
    }
    if (copy.includeSymbol) {
      const parts = formatCurrencyParts(value, currency, resolved);
      return `${parts.symbol}${parts.amount}`;
    }
    return formatNumber(value, resolved);
  }

  const base = normalizedFixed(value, decimals);
  const withSymbol = copy.includeSymbol ? `${getCurrencySymbol(currency)}${base}` : base;
  return copy.includeCode ? `${withSymbol} ${currency}` : withSymbol;
}

export function formatCurrencyParts(
  value: number,
  currency: string,
  format?: FormatSettings
): { symbol: string; amount: string } {
  if (!Number.isFinite(value)) {
    return { symbol: getCurrencySymbol(currency), amount: '' };
  }
  const resolved = resolveFormat(format);
  const { minimumFractionDigits, maximumFractionDigits } = getFractionDigits(value, resolved);
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: resolved.compact ? 'compact' : 'standard',
      useGrouping: resolved.grouping,
      minimumFractionDigits,
      maximumFractionDigits
    });
    const parts = formatter.formatToParts(value);
    const rawSymbol = parts.find((part) => part.type === 'currency')?.value ?? currency;
    const fallbackSymbol = getCurrencySymbol(currency);
    const symbol =
      rawSymbol.toUpperCase() === currency || /[A-Za-z]/.test(rawSymbol)
        ? fallbackSymbol
        : rawSymbol;
    const amount = parts
      .filter((part) => part.type !== 'currency')
      .map((part) => part.value)
      .join('')
      .trim();
    return { symbol, amount };
  } catch {
    const amount = formatNumber(value, resolved);
    return { symbol: getCurrencySymbol(currency), amount };
  }
}

function resolveFormat(format?: FormatSettings): FormatSettings {
  return {
    ...DEFAULT_FORMAT,
    ...(format ?? {})
  };
}

function getFractionDigits(
  value: number,
  format: FormatSettings
): { minimumFractionDigits: number; maximumFractionDigits: number } {
  if (format.mode === 'fixed') {
    const fixed = clamp(format.fixedDecimals, 0, 6);
    return { minimumFractionDigits: fixed, maximumFractionDigits: fixed };
  }
  const min = clamp(format.minDecimals, 0, 6);
  const max = clamp(Math.max(format.maxDecimals, min), 0, 6);
  if (Math.abs(value) > 0 && Math.abs(value) < 1 && max > min) {
    const boostedMin = Math.min(max, Math.max(min, 4));
    return { minimumFractionDigits: boostedMin, maximumFractionDigits: max };
  }
  return { minimumFractionDigits: min, maximumFractionDigits: max };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampDecimals(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
