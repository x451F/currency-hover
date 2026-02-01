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

export function getCurrencyFlag(code: string): string {
  return CURRENCY_FLAGS[code] ?? '';
}

export function getCurrencyLabel(code: string): string {
  const flag = getCurrencyFlag(code);
  return flag ? `${flag} ${code}` : code;
}
