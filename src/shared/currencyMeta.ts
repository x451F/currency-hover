export const CURRENCY_FLAG_CODES: Record<string, string> = {
  USD: 'us',
  EUR: 'eu',
  GBP: 'gb',
  JPY: 'jp',
  CAD: 'ca',
  AUD: 'au',
  CHF: 'ch',
  CNY: 'cn',
  SEK: 'se',
  NZD: 'nz',
  NOK: 'no',
  DKK: 'dk',
  PLN: 'pl',
  UAH: 'ua',
  CZK: 'cz',
  HUF: 'hu',
  BRL: 'br',
  MXN: 'mx',
  INR: 'in',
  KRW: 'kr',
  SGD: 'sg',
  HKD: 'hk',
  ZAR: 'za'
};

export const CURRENCY_MARKERS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  SOL: '◎'
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'CHF',
  CNY: '¥',
  SEK: 'kr',
  NZD: 'NZ$',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  UAH: '₴',
  CZK: 'Kč',
  HUF: 'Ft',
  BRL: 'R$',
  MXN: 'MX$',
  INR: '₹',
  KRW: '₩',
  SGD: 'S$',
  HKD: 'HK$',
  ZAR: 'R',
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  SOL: '◎'
};

export function getCurrencyFlagCode(code: string): string | null {
  return CURRENCY_FLAG_CODES[code] ?? null;
}

export function getCurrencyMarker(code: string): string {
  return CURRENCY_MARKERS[code] ?? '';
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function getCurrencyLabel(code: string): string {
  const marker = getCurrencyMarker(code);
  return marker ? `${marker} ${code}` : code;
}
