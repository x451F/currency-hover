export function formatCurrency(value: number, currency: string, compact = false): string {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'code',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : 4,
      minimumFractionDigits: compact ? 0 : 2
    });
    return formatter.format(value);
  } catch {
    const fixed = compact ? value.toFixed(2) : value.toFixed(4);
    return `${currency} ${fixed}`;
  }
}

export function formatAmount(value: number, compact = false): string {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'decimal',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : 4,
      minimumFractionDigits: compact ? 0 : 2
    });
    return formatter.format(value);
  } catch {
    return compact ? value.toFixed(2) : value.toFixed(4);
  }
}

export function formatCurrencyParts(
  value: number,
  currency: string,
  compact = false
): { symbol: string; amount: string } {
  try {
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 2 : 4,
      minimumFractionDigits: compact ? 0 : 2
    });
    const parts = formatter.formatToParts(value);
    const symbol = parts.find((part) => part.type === 'currency')?.value ?? currency;
    const amount = parts
      .filter((part) => part.type !== 'currency')
      .map((part) => part.value)
      .join('')
      .trim();
    return { symbol, amount };
  } catch {
    const amount = compact ? value.toFixed(2) : value.toFixed(4);
    return { symbol: currency, amount };
  }
}
