export const CURRENCY_FLAGS: Record<string, string> = {
  USD: '🇺🇸',
  EUR: '🇪🇺',
  GBP: '🇬🇧',
  JPY: '🇯🇵',
  CAD: '🇨🇦',
  AUD: '🇦🇺',
  CHF: '🇨🇭',
  CNY: '🇨🇳',
  SEK: '🇸🇪',
  NZD: '🇳🇿',
  NOK: '🇳🇴',
  DKK: '🇩🇰',
  PLN: '🇵🇱',
  UAH: '🇺🇦',
  CZK: '🇨🇿',
  HUF: '🇭🇺',
  BRL: '🇧🇷',
  MXN: '🇲🇽',
  INR: '🇮🇳',
  KRW: '🇰🇷',
  SGD: '🇸🇬',
  HKD: '🇭🇰',
  ZAR: '🇿🇦'
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
  ZAR: 'R'
};

export function getCurrencyFlag(code: string): string {
  return CURRENCY_FLAGS[code] ?? '';
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function getCurrencyLabel(code: string): string {
  const flag = getCurrencyFlag(code);
  return flag ? `${flag} ${code}` : code;
}
