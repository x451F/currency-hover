import { isSupportedCurrency, normalizeCurrencyCode } from './settings';

export type CalculatorTokenType =
  | 'number'
  | 'currency'
  | 'operator'
  | 'leftParen'
  | 'rightParen'
  | 'percent';

export interface CalculatorToken {
  type: CalculatorTokenType;
  value: string;
}

export interface CurrencyExpressionOptions {
  defaultCurrency: string | null;
  resultCurrency: string | null;
  /**
   * Conversion factors expressed as units of each currency per one unit of
   * the selected result currency, matching the extension's CONVERT response.
   */
  rates: Record<string, number>;
}

export interface CurrencyExpressionResult {
  value: number;
  currency: string | null;
  currencies: string[];
}

interface EvaluatedValue {
  value: number;
  money: boolean;
}

const CURRENCY_ALIASES: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '₴': 'UAH',
  грн: 'UAH',
  'zł': 'PLN'
};

export function tokenizeExpression(expression: string): CalculatorToken[] {
  const tokens: CalculatorToken[] = [];
  let cursor = 0;

  while (cursor < expression.length) {
    const remaining = expression.slice(cursor);
    const whitespace = remaining.match(/^\s+/);
    if (whitespace) {
      cursor += whitespace[0].length;
      continue;
    }

    const number = remaining.match(/^(?:\d+(?:[.,]\d*)?|[.,]\d+)/);
    if (number) {
      tokens.push({ type: 'number', value: number[0] });
      cursor += number[0].length;
      continue;
    }

    const char = remaining[0];
    if ('+-*/×÷'.includes(char)) {
      tokens.push({ type: 'operator', value: normalizeOperator(char) });
      cursor += 1;
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'leftParen', value: char });
      cursor += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rightParen', value: char });
      cursor += 1;
      continue;
    }
    if (char === '%') {
      tokens.push({ type: 'percent', value: char });
      cursor += 1;
      continue;
    }

    const marker = remaining.match(/^[\p{L}$€₴£¥₹₩₿Ξ◎₮]+/u);
    if (marker) {
      const code = resolveCurrency(marker[0]);
      if (!code) {
        throw new Error(`Unknown currency "${marker[0]}".`);
      }
      tokens.push({ type: 'currency', value: code });
      cursor += marker[0].length;
      continue;
    }

    throw new Error(`Unsupported character "${char}".`);
  }

  return tokens;
}

export function getExpressionCurrencies(expression: string): string[] {
  return Array.from(
    new Set(
      tokenizeExpression(expression)
        .filter((token) => token.type === 'currency')
        .map((token) => token.value)
    )
  );
}

export function evaluateCurrencyExpression(
  expression: string,
  options: CurrencyExpressionOptions
): CurrencyExpressionResult {
  if (!expression.trim()) {
    throw new Error('Enter an expression.');
  }

  const resultCurrency = options.resultCurrency
    ? requireCurrency(options.resultCurrency)
    : null;
  const defaultCurrency = options.defaultCurrency
    ? requireCurrency(options.defaultCurrency)
    : resultCurrency;
  const tokens = tokenizeExpression(expression);
  const currencies = Array.from(
    new Set(tokens.filter((token) => token.type === 'currency').map((token) => token.value))
  );
  if ((currencies.length || defaultCurrency) && !resultCurrency) {
    throw new Error('Select a result currency for currency amounts.');
  }
  let position = 0;

  const peek = (): CalculatorToken | undefined => tokens[position];
  const consume = (): CalculatorToken => tokens[position++]!;

  const convertToResultCurrency = (amount: number, currency: string): number => {
    if (currency === resultCurrency) return amount;
    const rate = options.rates[currency];
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Missing exchange rate for ${currency}.`);
    }
    return amount / rate;
  };

  const toDefaultCurrency = (value: EvaluatedValue): EvaluatedValue => {
    if (value.money || !defaultCurrency) return value;
    return {
      value: convertToResultCurrency(value.value, defaultCurrency),
      money: true
    };
  };

  const parsePrimary = (): EvaluatedValue => {
    const token = peek();
    if (!token) {
      throw new Error('Expression is incomplete.');
    }
    if (token.type === 'number') {
      consume();
      const amount = Number(token.value.replace(',', '.'));
      if (!Number.isFinite(amount)) {
        throw new Error('Invalid number.');
      }
      const currencyToken = peek();
      if (currencyToken?.type === 'currency') {
        return { value: convertToResultCurrency(amount, consume().value), money: true };
      }
      return { value: amount, money: false };
    }
    if (token.type === 'leftParen') {
      consume();
      const value = parseAdditive();
      if (peek()?.type !== 'rightParen') {
        throw new Error('Missing closing parenthesis.');
      }
      consume();
      return value;
    }
    if (token.type === 'currency') {
      throw new Error('A currency must follow a number.');
    }
    throw new Error(`Unexpected "${token.value}".`);
  };

  const parsePostfix = (): EvaluatedValue => {
    let value = parsePrimary();
    while (peek()?.type === 'percent') {
      consume();
      value = { ...value, value: value.value / 100 };
    }
    return value;
  };

  const parseUnary = (): EvaluatedValue => {
    const token = peek();
    if (token?.type === 'operator' && (token.value === '+' || token.value === '-')) {
      consume();
      const value = parseUnary();
      return token.value === '-' ? { ...value, value: -value.value } : value;
    }
    return parsePostfix();
  };

  const parseMultiplicative = (): EvaluatedValue => {
    let value = parseUnary();
    while (peek()?.type === 'operator' && (peek()?.value === '*' || peek()?.value === '/')) {
      const operator = consume().value;
      const right = parseUnary();
      if (operator === '/' && right.value === 0) {
        throw new Error('Cannot divide by zero.');
      }
      value =
        operator === '*'
          ? {
              value: value.value * right.value,
              money: value.money || right.money
            }
          : {
              value: value.value / right.value,
              money: value.money && !right.money
            };
    }
    return value;
  };

  function parseAdditive(): EvaluatedValue {
    let value = parseMultiplicative();
    while (peek()?.type === 'operator' && (peek()?.value === '+' || peek()?.value === '-')) {
      const operator = consume().value;
      const right = parseMultiplicative();
      const leftMoney = value.money || right.money ? toDefaultCurrency(value) : value;
      const rightMoney = value.money || right.money ? toDefaultCurrency(right) : right;
      value = {
        value:
          operator === '+'
            ? leftMoney.value + rightMoney.value
            : leftMoney.value - rightMoney.value,
        money: leftMoney.money || rightMoney.money
      };
    }
    return value;
  }

  let result = parseAdditive();
  if (position < tokens.length) {
    throw new Error(`Unexpected "${tokens[position]!.value}".`);
  }
  result = toDefaultCurrency(result);
  if (!Number.isFinite(result.value)) {
    throw new Error('Result is not finite.');
  }

  return { value: result.value, currency: result.money ? resultCurrency : null, currencies };
}

function normalizeOperator(operator: string): string {
  if (operator === '×') return '*';
  if (operator === '÷') return '/';
  return operator;
}

function resolveCurrency(value: string): string | null {
  const alias = CURRENCY_ALIASES[value.toLowerCase()];
  if (alias) return alias;
  const normalized = normalizeCurrencyCode(value);
  return isSupportedCurrency(normalized) ? normalized : null;
}

function requireCurrency(value: string): string {
  const normalized = normalizeCurrencyCode(value);
  if (!isSupportedCurrency(normalized)) {
    throw new Error(`Unknown currency "${value}".`);
  }
  return normalized;
}
