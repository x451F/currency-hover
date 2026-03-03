import { describe, expect, it } from 'vitest';
import { detectCurrencyFromText, extractFirstNumber, shouldTriggerSelection } from '../src/shared/parser';

describe('extractFirstNumber', () => {
  it('parses simple integers', () => {
    expect(extractFirstNumber('530')?.value).toBe(530);
    expect(extractFirstNumber('-99')?.value).toBe(-99);
  });

  it('parses decimals with dot or comma', () => {
    expect(extractFirstNumber('530.5')?.value).toBeCloseTo(530.5);
    expect(extractFirstNumber('530,5')?.value).toBeCloseTo(530.5);
  });

  it('parses thousands with commas or spaces', () => {
    expect(extractFirstNumber('1,234.56')?.value).toBeCloseTo(1234.56);
    expect(extractFirstNumber('1 234,56')?.value).toBeCloseTo(1234.56);
    expect(extractFirstNumber('1,234')?.value).toBe(1234);
  });

  it('handles nbspace separators', () => {
    const nbsp = String.fromCharCode(160);
    expect(extractFirstNumber(`1${nbsp}234,56`)?.value).toBeCloseTo(1234.56);
  });

  it('returns null for no numbers', () => {
    expect(extractFirstNumber('hello')).toBeNull();
  });
});

describe('detectCurrencyFromText', () => {
  it('detects currency symbols', () => {
    expect(detectCurrencyFromText('$5')).toBe('USD');
    expect(detectCurrencyFromText('10€')).toBe('EUR');
    expect(detectCurrencyFromText('99₴')).toBe('UAH');
    expect(detectCurrencyFromText('₿1')).toBe('BTC');
  });

  it('detects currency codes near numbers', () => {
    expect(detectCurrencyFromText('100uah')).toBe('UAH');
    expect(detectCurrencyFromText('USD 5')).toBe('USD');
    expect(detectCurrencyFromText('5pln')).toBe('PLN');
  });

  it('detects гривня abbreviations', () => {
    expect(detectCurrencyFromText('200 грн')).toBe('UAH');
    expect(detectCurrencyFromText('200ГРН')).toBe('UAH');
  });
});

describe('shouldTriggerSelection', () => {
  it('returns true for number-like selections', () => {
    expect(shouldTriggerSelection('1 234,56')).toBe(true);
    expect(shouldTriggerSelection('530.5')).toBe(true);
  });

  it('returns true when currency markers are present', () => {
    expect(shouldTriggerSelection('€ 12,00')).toBe(true);
    expect(shouldTriggerSelection('12 EUR')).toBe(true);
    expect(shouldTriggerSelection('0.5 BTC')).toBe(true);
  });

  it('returns false for sentences with digits and no currency', () => {
    expect(shouldTriggerSelection('On 19 July 2026 we paid 10 for lunch')).toBe(false);
  });
});
