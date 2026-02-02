import { describe, expect, it } from 'vitest';
import { formatCopyValue } from '../src/shared/format';
import type { CopySettings, FormatSettings } from '../src/shared/settings';

const baseCopy: CopySettings = {
  decimals: 2,
  includeCode: false,
  includeSymbol: false,
  mode: 'default'
};

const format: FormatSettings = {
  mode: 'auto',
  fixedDecimals: 2,
  minDecimals: 2,
  maxDecimals: 4,
  grouping: true,
  compact: false,
  copyMode: 'formatted'
};

describe('formatCopyValue', () => {
  it('uses fixed decimals with dot and no grouping in default mode', () => {
    const value = 1234.567;
    const result = formatCopyValue(value, 'USD', baseCopy, format);
    expect(result).toBe('1234.57');
  });

  it('includes currency code when enabled', () => {
    const result = formatCopyValue(10, 'EUR', { ...baseCopy, includeCode: true }, format);
    expect(result).toBe('10.00 EUR');
  });

  it('returns raw value when mode is raw', () => {
    const result = formatCopyValue(10.5, 'EUR', { ...baseCopy, mode: 'raw' }, format);
    expect(result).toBe('10.50');
  });
});
