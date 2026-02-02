import { SUPPORTED_CURRENCIES } from '../shared/constants';
import { getCurrencyLabel } from '../shared/currencyMeta';
import { getSettings, onSettingsChanged, setSettings } from '../shared/storage';
import { normalizeCurrencyCode, normalizeCurrencyList } from '../shared/settings';
import { applyTheme, type ThemeSetting } from '../shared/theme';
import { hasFeature } from '../shared/capabilities';

const enabledEl = document.querySelector<HTMLInputElement>('#enabled')!;
const baseEl = document.querySelector<HTMLSelectElement>('#base')!;
const targetsEl = document.querySelector<HTMLSelectElement>('#targets')!;
const favoritesListEl = document.querySelector<HTMLDivElement>('#favorites-list')!;
const favoriteAddEl = document.querySelector<HTMLSelectElement>('#favorite-add')!;
const favoriteAddBtn = document.querySelector<HTMLButtonElement>('#favorite-add-btn')!;
const detectEl = document.querySelector<HTMLInputElement>('#detect-currency')!;
const autoHideEl = document.querySelector<HTMLInputElement>('#auto-hide')!;
const showDateEl = document.querySelector<HTMLInputElement>('#show-date')!;
const compactEl = document.querySelector<HTMLInputElement>('#compact')!;
const ttlEl = document.querySelector<HTMLInputElement>('#ttl')!;
const themeEl = document.querySelector<HTMLSelectElement>('#theme')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;

let currentBase = 'USD';
let currentFavorites: string[] = [];
const CRYPTO_CODES = new Set(['BTC', 'ETH', 'USDT', 'SOL']);

function populateOptions(): void {
  for (const code of SUPPORTED_CURRENCIES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = getCurrencyLabel(code);
    baseEl.appendChild(option);
  }

  for (const code of SUPPORTED_CURRENCIES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = getCurrencyLabel(code);
    targetsEl.appendChild(option);
  }

  for (const code of SUPPORTED_CURRENCIES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = getCurrencyLabel(code);
    favoriteAddEl.appendChild(option);
  }
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function getSelectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function applySettings(settings: Awaited<ReturnType<typeof getSettings>>): void {
  enabledEl.checked = settings.enabled;
  currentBase = settings.baseCurrency;
  currentFavorites = settings.favorites;
  baseEl.value = settings.baseCurrency;
  Array.from(targetsEl.options).forEach((option) => {
    option.selected = settings.targets.includes(option.value);
  });
  detectEl.checked = settings.detectCurrency;
  autoHideEl.value = String(settings.tooltip.autoHideSeconds);
  showDateEl.checked = settings.tooltip.showRateDate;
  compactEl.checked = settings.tooltip.compact;
  ttlEl.value = String(settings.cacheTtlMinutes);
  themeEl.value = settings.theme;
  applyTheme(document.documentElement, settings.theme);
  renderFavorites();
  applyCryptoGating(settings);
}

async function init(): Promise<void> {
  populateOptions();

  const settings = await getSettings();
  applySettings(settings);

  onSettingsChanged((next) => applySettings(next));

  enabledEl.addEventListener('change', async () => {
    await setSettings({ enabled: enabledEl.checked });
    setStatus(enabledEl.checked ? 'Enabled.' : 'Disabled.');
  });

  baseEl.addEventListener('change', async () => {
    const base = baseEl.value;
    currentBase = base;
    const targets = normalizeCurrencyList(getSelectedValues(targetsEl));
    await setSettings({ baseCurrency: base, targets });
    setStatus('Base currency updated.');
  });

  targetsEl.addEventListener('change', async () => {
    const targets = normalizeCurrencyList(getSelectedValues(targetsEl));
    await setSettings({ targets });
    setStatus('Targets updated.');
  });

  favoriteAddBtn.addEventListener('click', async () => {
    const code = normalizeCurrencyCode(favoriteAddEl.value);
    if (!code) return;
    if (currentFavorites.includes(code)) {
      setStatus('Already in favorites.');
      return;
    }
    const next = [...currentFavorites, code];
    await setSettings({ favorites: next });
    setStatus('Favorite added.');
  });

  detectEl.addEventListener('change', async () => {
    await setSettings({ detectCurrency: detectEl.checked });
    setStatus(detectEl.checked ? 'Currency detection enabled.' : 'Currency detection disabled.');
  });

  autoHideEl.addEventListener('change', async () => {
    const value = Math.max(1, Math.round(Number(autoHideEl.value)) || 1);
    autoHideEl.value = String(value);
    await setSettings({ tooltip: { autoHideSeconds: value } });
    setStatus('Tooltip timeout updated.');
  });

  showDateEl.addEventListener('change', async () => {
    await setSettings({ tooltip: { showRateDate: showDateEl.checked } });
    setStatus('Tooltip date setting updated.');
  });

  compactEl.addEventListener('change', async () => {
    await setSettings({ tooltip: { compact: compactEl.checked } });
    setStatus('Compact mode updated.');
  });

  ttlEl.addEventListener('change', async () => {
    const value = Math.max(1, Math.round(Number(ttlEl.value)) || 1);
    ttlEl.value = String(value);
    await setSettings({ cacheTtlMinutes: value });
    setStatus('Cache TTL updated.');
  });

  themeEl.addEventListener('change', async () => {
    const theme = themeEl.value as ThemeSetting;
    await setSettings({ theme });
    applyTheme(document.documentElement, theme);
    setStatus('Theme updated.');
  });
}

init().catch((error) => {
  console.error('Currency Hover options init failed:', error);
});

function renderFavorites(): void {
  favoritesListEl.innerHTML = '';
  if (!currentFavorites.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No favorites yet.';
    favoritesListEl.appendChild(empty);
    return;
  }

  currentFavorites.forEach((code, index) => {
    const row = document.createElement('div');
    row.className = 'favorite-row';

    const label = document.createElement('div');
    label.className = 'favorite-code';
    label.textContent = getCurrencyLabel(code);

    const actions = document.createElement('div');
    actions.className = 'favorite-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = 'Up';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', async () => {
      await moveFavorite(index, -1);
    });

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = 'Down';
    downBtn.disabled = index === currentFavorites.length - 1;
    downBtn.addEventListener('click', async () => {
      await moveFavorite(index, 1);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async () => {
      const next = currentFavorites.filter((item) => item !== code);
      await setSettings({ favorites: next });
      setStatus('Favorite removed.');
    });

    actions.append(upBtn, downBtn, removeBtn);
    row.append(label, actions);
    favoritesListEl.appendChild(row);
  });
}

function applyCryptoGating(settings: Awaited<ReturnType<typeof getSettings>>): void {
  const allowCrypto = hasFeature(settings, 'crypto');
  Array.from(baseEl.options).forEach((option) => {
    if (CRYPTO_CODES.has(option.value)) {
      option.disabled = !allowCrypto;
    }
  });
  Array.from(targetsEl.options).forEach((option) => {
    if (CRYPTO_CODES.has(option.value)) {
      option.disabled = !allowCrypto;
      if (!allowCrypto && option.selected) {
        option.selected = false;
      }
    }
  });
  Array.from(favoriteAddEl.options).forEach((option) => {
    if (CRYPTO_CODES.has(option.value)) {
      option.disabled = !allowCrypto;
    }
  });
  if (!allowCrypto && CRYPTO_CODES.has(currentBase)) {
    baseEl.value = 'USD';
    void setSettings({ baseCurrency: 'USD' });
  }
}

async function moveFavorite(index: number, delta: number): Promise<void> {
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= currentFavorites.length) return;
  const next = [...currentFavorites];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  await setSettings({ favorites: next });
  setStatus('Favorites reordered.');
}
