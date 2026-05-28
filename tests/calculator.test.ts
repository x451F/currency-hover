import { describe, expect, it } from 'vitest';
import {
  evaluateCurrencyExpression,
  getExpressionCurrencies,
  tokenizeExpression
} from '../src/shared/calculator';

const ratesFromCad = {
  EUR: 0.67,
  UAH: 30,
  PLN: 0.09
};

describe('tokenizeExpression', () => {
  it('normalizes operators, currency codes, and supported aliases', () => {
    expect(tokenizeExpression('10€ + 2 грн × 3 PLN')).toEqual([
      { type: 'number', value: '10' },
      { type: 'currency', value: 'EUR' },
      { type: 'operator', value: '+' },
      { type: 'number', value: '2' },
      { type: 'currency', value: 'UAH' },
      { type: 'operator', value: '*' },
      { type: 'number', value: '3' },
      { type: 'currency', value: 'PLN' }
    ]);
    expect(getExpressionCurrencies('2 EUR + 1 EUR + 3 UAH')).toEqual(['EUR', 'UAH']);
  });
});

describe('evaluateCurrencyExpression', () => {
  it('evaluates plain calculations without assigning a currency', () => {
    const result = evaluateCurrencyExpression('30 + 2', {
      defaultCurrency: null,
      resultCurrency: null,
      rates: {}
    });
    expect(result.value).toBe(32);
    expect(result.currency).toBeNull();
  });

  it('uses the selected result currency for untagged amounts and converts tagged amounts', () => {
    const result = evaluateCurrencyExpression('30 + 2 EUR', {
      defaultCurrency: 'UAH',
      resultCurrency: 'CAD',
      rates: ratesFromCad
    });
    expect(result.value).toBeCloseTo(30 / ratesFromCad.UAH + 2 / ratesFromCad.EUR);
    expect(result.currency).toBe('CAD');
  });

  it('supports parentheses, division, decimal commas, and aliases', () => {
    const result = evaluateCurrencyExpression('(30 UAH + 2,2 €) / 2', {
      defaultCurrency: 'UAH',
      resultCurrency: 'CAD',
      rates: ratesFromCad
    });
    expect(result.value).toBeCloseTo((30 / ratesFromCad.UAH + 2.2 / ratesFromCad.EUR) / 2);
  });

  it('treats percent as a numeric postfix divided by one hundred', () => {
    const result = evaluateCurrencyExpression('200 * 10%', {
      defaultCurrency: null,
      resultCurrency: null,
      rates: {}
    });
    expect(result.value).toBe(20);
  });

  it('rejects malformed calculations and unavailable conversions', () => {
    expect(() =>
      evaluateCurrencyExpression('(10 + 2', {
        defaultCurrency: null,
        resultCurrency: null,
        rates: {}
      })
    ).toThrow('Missing closing parenthesis');
    expect(() =>
      evaluateCurrencyExpression('10 / 0', {
        defaultCurrency: null,
        resultCurrency: null,
        rates: {}
      })
    ).toThrow('Cannot divide by zero');
    expect(() =>
      evaluateCurrencyExpression('2 CAD', {
        defaultCurrency: 'UAH',
        resultCurrency: 'UAH',
        rates: {}
      })
    ).toThrow('Missing exchange rate for CAD');
    expect(() =>
      evaluateCurrencyExpression('2 EUR', {
        defaultCurrency: null,
        resultCurrency: null,
        rates: {}
      })
    ).toThrow('Select a result currency');
    expect(() => tokenizeExpression('2 XYZ')).toThrow('Unknown currency');
  });
});
