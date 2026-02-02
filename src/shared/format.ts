import { getCurrencySymbol } from './currencyMeta';
import { DEFAULT_SETTINGS, type FormatSettings } from './settings';

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

export function formatRawNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(value);
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
