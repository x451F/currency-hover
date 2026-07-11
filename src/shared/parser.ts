import { SUPPORTED_CURRENCIES } from './constants';

const NBSP_REGEX = /\u00A0/g;

export interface ParsedNumber {
  value: number;
  token: string;
}

const SUPPORTED_SET = new Set<string>(SUPPORTED_CURRENCIES);

const CURRENCY_SYMBOLS: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '₴': 'UAH',
  '₹': 'INR',
  '₩': 'KRW',
  '₿': 'BTC',
  'Ξ': 'ETH',
  '₮': 'USDT'
};

const CURRENCY_WORDS: Array<{ token: string; code: string }> = [
  { token: 'uah', code: 'UAH' },
  { token: 'грн', code: 'UAH' },
  { token: 'гривня', code: 'UAH' },
  { token: 'гривні', code: 'UAH' },
  { token: 'гривень', code: 'UAH' },
  { token: 'usd', code: 'USD' },
  { token: 'eur', code: 'EUR' },
  { token: 'gbp', code: 'GBP' },
  { token: 'jpy', code: 'JPY' },
  { token: 'btc', code: 'BTC' },
  { token: 'eth', code: 'ETH' },
  { token: 'usdt', code: 'USDT' },
  { token: 'pln', code: 'PLN' },
  { token: 'zł', code: 'PLN' },
  { token: 'zl', code: 'PLN' },
  { token: 'cad', code: 'CAD' },
  { token: 'aud', code: 'AUD' },
  { token: 'chf', code: 'CHF' },
  { token: 'cny', code: 'CNY' },
  { token: 'sek', code: 'SEK' },
  { token: 'nok', code: 'NOK' },
  { token: 'dkk', code: 'DKK' },
  { token: 'czk', code: 'CZK' },
  { token: 'huf', code: 'HUF' },
  { token: 'brl', code: 'BRL' },
  { token: 'mxn', code: 'MXN' },
  { token: 'inr', code: 'INR' },
  { token: 'krw', code: 'KRW' },
  { token: 'sgd', code: 'SGD' },
  { token: 'hkd', code: 'HKD' },
  { token: 'zar', code: 'ZAR' }
];

export function detectCurrencyFromText(text: string): string | null {
  const normalized = text.toUpperCase();
  for (const symbol of Object.keys(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) {
      const code = CURRENCY_SYMBOLS[symbol];
      return SUPPORTED_SET.has(code) ? code : null;
    }
  }

  for (const entry of CURRENCY_WORDS) {
    if (containsToken(text, entry.token)) {
      return SUPPORTED_SET.has(entry.code) ? entry.code : null;
    }
  }

  const codeMatch = normalized.match(/(?:^|[^A-Z])([A-Z]{3})(?:$|[^A-Z])/);
  if (codeMatch && SUPPORTED_SET.has(codeMatch[1])) {
    return codeMatch[1];
  }

  return null;
}

function containsToken(text: string, token: string): boolean {
  const lowerText = text.toLocaleLowerCase();
  const lowerToken = token.toLocaleLowerCase();
  let index = lowerText.indexOf(lowerToken);

  while (index >= 0) {
    const before = index > 0 ? lowerText[index - 1] : '';
    const afterIndex = index + lowerToken.length;
    const after = afterIndex < lowerText.length ? lowerText[afterIndex] : '';
    if (!isLetter(before) && !isLetter(after)) {
      return true;
    }
    index = lowerText.indexOf(lowerToken, index + lowerToken.length);
  }

  return false;
}

function isLetter(value: string): boolean {
  return value.length > 0 && value.toLocaleLowerCase() !== value.toLocaleUpperCase();
}

export function extractFirstNumber(text: string): ParsedNumber | null {
  if (!text) return null;
  const normalized = text.replace(NBSP_REGEX, ' ');
  const match = normalized.match(/[-+]?\d[\d\s.,]*/);
  if (!match) return null;

  const token = match[0].trim();
  const parsed = parseNumberToken(token);
  if (parsed === null) return null;

  return { value: parsed, token };
}

export function shouldTriggerSelection(text: string): boolean {
  if (!text || !text.trim()) return false;
  const parsed = extractFirstNumber(text);
  if (!parsed) return false;

  if (detectCurrencyFromText(text)) return true;

  const compact = text.trim().replace(/\s+/g, '');
  if (!compact) return false;
  const tokenLength = parsed.token.replace(/\s+/g, '').length;
  if (compact.length <= tokenLength + 2) return true;

  const numericCount = compact.replace(/[^0-9.,+-]/g, '').length;
  const ratio = numericCount / compact.length;
  if (ratio >= 0.6 && compact.length <= 32) return true;

  return false;
}

function parseNumberToken(token: string): number | null {
  let cleaned = token.replace(/\s+/g, '');
  cleaned = cleaned.replace(/^[^\d+-]+/, '');
  cleaned = cleaned.replace(/[^\d.,+-]+$/, '');
  if (!/\d/.test(cleaned)) return null;

  let sign = 1;
  if (cleaned.startsWith('-')) sign = -1;
  cleaned = cleaned.replace(/^[-+]/, '');
  cleaned = cleaned.replace(/[.,]+$/, '');

  const hasDot = cleaned.includes('.');
  const hasComma = cleaned.includes(',');

  if (hasDot && hasComma) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastDot > lastComma) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(/\./g, '');
      cleaned = cleaned.replace(/,/g, '.');
    }
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const parts = cleaned.split(sep);
    if (parts.length > 2) {
      const re = new RegExp(`\\${sep}`, 'g');
      cleaned = cleaned.replace(re, '');
    } else {
      const [intPart, fracPart = ''] = parts;
      if (fracPart.length === 0) {
        cleaned = intPart;
      } else if (fracPart.length === 3 && intPart.length <= 3) {
        cleaned = `${intPart}${fracPart}`;
      } else {
        cleaned = `${intPart}.${fracPart}`;
      }
    }
  }

  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return value * sign;
}
