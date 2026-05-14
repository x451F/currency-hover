import { getCurrencyFlagCode, getCurrencyMarker } from './currencyMeta';

const FLAG_BASE_PATH = 'flag-icons/flags/4x3';

export function renderCurrencyIcon(target: HTMLElement, code: string): void {
  target.textContent = '';
  target.style.removeProperty('background-image');
  target.classList.remove('currency-flag-icon', 'currency-marker-icon', 'ccx-flag-icon');

  const flagCode = getCurrencyFlagCode(code);
  if (flagCode) {
    target.classList.add('currency-flag-icon', 'ccx-flag-icon');
    target.style.backgroundImage = `url("${getAssetUrl(`${FLAG_BASE_PATH}/${flagCode}.svg`)}")`;
    return;
  }

  const marker = getCurrencyMarker(code);
  target.classList.add('currency-marker-icon');
  target.textContent = marker || code.slice(0, 2);
}

function getAssetUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return `/${path}`;
}
