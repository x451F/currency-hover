import { SUPPORTED_CURRENCIES } from '../shared/constants';
import { getCurrencyFlag } from '../shared/currencyMeta';
import { sendMessage } from '../shared/runtime';
import { getSettings, onSettingsChanged, setSettings } from '../shared/storage';
import { normalizeCurrencyList, type Settings } from '../shared/settings';
import { applyTheme, type ThemeSetting } from '../shared/theme';
import type { ConvertResponse, RefreshResponse } from '../background/messaging';

const openSettingsBtn = document.querySelector<HTMLButtonElement>('#open-settings')!;
const converterView = document.querySelector<HTMLDivElement>('#converter-view')!;
const settingsView = document.querySelector<HTMLDivElement>('#settings-view')!;
const backBtn = document.querySelector<HTMLButtonElement>('#back')!;

const converterList = document.querySelector<HTMLDivElement>('#converter-list')!;
const converterError = document.querySelector<HTMLDivElement>('#converter-error')!;
const addCurrencyBtn = document.querySelector<HTMLButtonElement>('#add-currency-btn')!;
const picker = document.querySelector<HTMLDivElement>('#currency-picker')!;
const pickerSearch = document.querySelector<HTMLInputElement>('#currency-search')!;
const pickerOptions = document.querySelector<HTMLDivElement>('#currency-options')!;
const detectToggle = document.querySelector<HTMLInputElement>('#detect-currency')!;
const compactToggle = document.querySelector<HTMLInputElement>('#compact')!;
const ratesUpdated = document.querySelector<HTMLSpanElement>('#rates-updated')!;
const refreshBtn = document.querySelector<HTMLButtonElement>('#refresh')!;

const themeSelect = document.querySelector<HTMLSelectElement>('#theme')!;
const favoritesList = document.querySelector<HTMLDivElement>('#favorites-list')!;
const favoritesAddBtn = document.querySelector<HTMLButtonElement>('#favorites-add')!;
const favoritesPicker = document.querySelector<HTMLDivElement>('#favorites-picker')!;
const favoritesSearch = document.querySelector<HTMLInputElement>('#favorites-search')!;
const favoritesOptions = document.querySelector<HTMLDivElement>('#favorites-options')!;
const autoHideSelect = document.querySelector<HTMLSelectElement>('#auto-hide')!;
const showDateToggle = document.querySelector<HTMLInputElement>('#show-date')!;
const compactSettingToggle = document.querySelector<HTMLInputElement>('#compact-setting')!;
const ttlInput = document.querySelector<HTMLInputElement>('#ttl')!;

const supportedSet = new Set(SUPPORTED_CURRENCIES);

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  UAH: 'Ukrainian Hryvnia',
  PLN: 'Polish Zloty',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  CHF: 'Swiss Franc',
  CNY: 'Chinese Yuan',
  SEK: 'Swedish Krona',
  NZD: 'New Zealand Dollar',
  NOK: 'Norwegian Krone',
  DKK: 'Danish Krone',
  CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint',
  BRL: 'Brazilian Real',
  MXN: 'Mexican Peso',
  INR: 'Indian Rupee',
  KRW: 'South Korean Won',
  SGD: 'Singapore Dollar',
  HKD: 'Hong Kong Dollar',
  ZAR: 'South African Rand'
};

const CURRENCY_ALIASES: Record<string, string[]> = {
  USD: ['dollar', 'buck', '$'],
  EUR: ['euro', '€', 'євро'],
  GBP: ['pound', '£'],
  UAH: ['hryvnia', 'грн', 'гривня', 'гривні', 'гривень', '₴'],
  PLN: ['zloty', 'zł', 'злотий'],
  JPY: ['yen', '¥'],
  INR: ['rupee', '₹'],
  KRW: ['won', '₩']
};

const DEFAULT_FAVORITES = ['EUR', 'USD', 'UAH', 'PLN'];

let settings: Settings;
let favorites: string[] = [];
let activeBase = '';
let values: Record<string, number> = {};
let editingCode: string | null = null;
let isProgrammatic = false;
let debounceTimer: number | null = null;
let requestSeq = 0;

const rowMap = new Map<string, { row: HTMLDivElement; input: HTMLInputElement; baseTag: HTMLSpanElement }>();

async function init(): Promise<void> {
  settings = await getSettings();
  applyTheme(document.documentElement, settings.theme);
  initializeFavorites();
  renderConverter();
  renderSettings();

  onSettingsChanged((next) => {
    settings = next;
    applyTheme(document.documentElement, settings.theme);
    initializeFavorites();
    renderConverter();
    renderSettings();
  });

  openSettingsBtn.addEventListener('click', () => switchView('settings'));
  backBtn.addEventListener('click', () => switchView('converter'));

  addCurrencyBtn.addEventListener('click', () => togglePicker(picker));
  favoritesAddBtn.addEventListener('click', () => togglePicker(favoritesPicker));

  setupPicker(pickerSearch, pickerOptions, (code) => addFavorite(code));
  setupPicker(favoritesSearch, favoritesOptions, (code) => addFavorite(code));

  detectToggle.addEventListener('change', () => {
    void setSettings({ detectCurrency: detectToggle.checked });
  });

  compactToggle.addEventListener('change', () => {
    void setSettings({ tooltip: { compact: compactToggle.checked } });
  });

  refreshBtn.addEventListener('click', async () => {
    if (!activeBase) return;
    const response = await sendMessage<RefreshResponse>({
      type: 'REFRESH_RATES',
      payload: { base: activeBase }
    });
    if (response.ok) {
      if (editingCode && values[editingCode] !== undefined) {
        scheduleConvert(editingCode, values[editingCode]);
      }
    } else {
      converterError.textContent = response.error ?? 'Unable to refresh rates.';
    }
  });

  themeSelect.addEventListener('change', () => {
    const theme = themeSelect.value as ThemeSetting;
    void setSettings({ theme });
    applyTheme(document.documentElement, theme);
  });

  autoHideSelect.addEventListener('change', () => {
    const value = Number(autoHideSelect.value);
    void setSettings({ tooltip: { autoHideSeconds: value } });
  });

  showDateToggle.addEventListener('change', () => {
    void setSettings({ tooltip: { showRateDate: showDateToggle.checked } });
  });

  compactSettingToggle.addEventListener('change', () => {
    void setSettings({ tooltip: { compact: compactSettingToggle.checked } });
  });

  ttlInput.addEventListener('change', () => {
    const value = Math.max(1, Math.round(Number(ttlInput.value)) || 1);
    void setSettings({ cacheTtlMinutes: value });
  });

  document.addEventListener('click', (event) => {
    if (!picker.contains(event.target as Node) && event.target !== addCurrencyBtn) {
      hidePicker(picker);
    }
    if (!favoritesPicker.contains(event.target as Node) && event.target !== favoritesAddBtn) {
      hidePicker(favoritesPicker);
    }
  });

  pickerSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hidePicker(picker);
      addCurrencyBtn.focus();
    }
  });

  favoritesSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hidePicker(favoritesPicker);
      favoritesAddBtn.focus();
    }
  });
}

function initializeFavorites(): void {
  favorites = settings.favorites.length ? [...settings.favorites] : [...DEFAULT_FAVORITES];
  if (!settings.favorites.length) {
    void setSettings({ favorites, targets: favorites });
  }
  if (!favorites.includes(settings.baseCurrency)) {
    activeBase = favorites[0] ?? settings.baseCurrency;
  } else {
    activeBase = settings.baseCurrency;
  }
}

function switchView(view: 'converter' | 'settings'): void {
  converterView.classList.toggle('hidden', view !== 'converter');
  settingsView.classList.toggle('hidden', view !== 'settings');
}

function renderConverter(): void {
  converterList.innerHTML = '';
  converterError.textContent = '';
  rowMap.clear();

  detectToggle.checked = settings.detectCurrency;
  compactToggle.checked = settings.tooltip.compact;

  favorites.forEach((code) => {
    const row = document.createElement('div');
    row.className = 'converter-row';
    row.dataset.code = code;

    const pill = document.createElement('div');
    pill.className = 'currency-pill';
    const flag = document.createElement('span');
    flag.textContent = getCurrencyFlag(code);
    const label = document.createElement('span');
    label.className = 'code';
    label.textContent = code;
    pill.append(flag, label);

    const baseTag = document.createElement('span');
    baseTag.className = 'base-tag';
    baseTag.textContent = 'Base';

    const input = document.createElement('input');
    input.className = 'amount-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.placeholder = '0.00';
    input.value = values[code] !== undefined ? formatNumber(values[code]) : '';

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => removeFavorite(code));

    input.addEventListener('focus', () => setActiveBase(code));
    input.addEventListener('input', () => handleInput(code, input.value));
    input.addEventListener('blur', () => {
      if (values[code] !== undefined) {
        input.value = formatNumber(values[code]);
      }
      editingCode = null;
    });

    const left = document.createElement('div');
    left.className = 'row-left';
    left.append(pill, baseTag);

    row.append(left, input, remove);
    converterList.appendChild(row);
    rowMap.set(code, { row, input, baseTag });
  });

  updateActiveRow();
}

function renderSettings(): void {
  themeSelect.value = settings.theme;
  showDateToggle.checked = settings.tooltip.showRateDate;
  compactSettingToggle.checked = settings.tooltip.compact;
  autoHideSelect.value = String(settings.tooltip.autoHideSeconds);
  ttlInput.value = String(settings.cacheTtlMinutes);

  favoritesList.innerHTML = '';
  favorites.forEach((code, index) => {
    const item = document.createElement('div');
    item.className = 'fav-item';

    const label = document.createElement('div');
    label.textContent = `${getCurrencyFlag(code)} ${code}`;

    const actions = document.createElement('div');
    actions.className = 'fav-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = 'Up';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveFavorite(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = 'Down';
    downBtn.disabled = index === favorites.length - 1;
    downBtn.addEventListener('click', () => moveFavorite(index, 1));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeFavorite(code));

    actions.append(upBtn, downBtn, removeBtn);
    item.append(label, actions);
    favoritesList.appendChild(item);
  });
}

function setActiveBase(code: string): void {
  activeBase = code;
  editingCode = code;
  updateActiveRow();
}

function updateActiveRow(): void {
  rowMap.forEach(({ row, baseTag }, code) => {
    const active = code === activeBase;
    row.classList.toggle('active', active);
    baseTag.style.display = active ? 'inline-flex' : 'none';
  });
}

function handleInput(code: string, raw: string): void {
  if (isProgrammatic) return;
  setActiveBase(code);
  const parsed = parseNumber(raw);
  if (parsed === null) {
    converterError.textContent = '';
    return;
  }
  values[code] = parsed;
  scheduleConvert(code, parsed);
}

function scheduleConvert(base: string, amount: number): void {
  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    void convertFromBase(base, amount);
  }, 300);
}

async function convertFromBase(base: string, amount: number): Promise<void> {
  if (!favorites.length) return;
  converterError.textContent = '';
  const requestId = ++requestSeq;
  let response: ConvertResponse;
  try {
    response = await sendMessage<ConvertResponse>({
      type: 'CONVERT',
      payload: {
        amount,
        base,
        targets: favorites
      }
    });
  } catch (error) {
    if (requestId !== requestSeq) return;
    converterError.textContent = error instanceof Error ? error.message : 'Conversion failed.';
    return;
  }

  if (requestId !== requestSeq) return;

  if (response.error) {
    converterError.textContent = response.error;
  }

  values[base] = amount;
  favorites.forEach((code) => {
    if (code === base) return;
    const value = response.conversions[code];
    if (typeof value === 'number') {
      values[code] = value;
    }
  });

  applyValuesToInputs(base);
  updateRatesLabel(response);
  void setSettings({ baseCurrency: base, targets: favorites });
}

function applyValuesToInputs(active: string): void {
  isProgrammatic = true;
  rowMap.forEach(({ input }, code) => {
    if (code === active && editingCode === active) return;
    const value = values[code];
    input.value = value !== undefined ? formatNumber(value) : '';
  });
  isProgrammatic = false;
}

function updateRatesLabel(response: ConvertResponse): void {
  if (response.fetchedAt) {
    const date = new Date(response.fetchedAt);
    if (!Number.isNaN(date.getTime())) {
      ratesUpdated.textContent = `Rates updated: ${date.toISOString().slice(0, 10)}`;
      return;
    }
  }
  if (response.date) {
    ratesUpdated.textContent = `Rates updated: ${response.date}`;
    return;
  }
  ratesUpdated.textContent = 'Rates updated: --';
}

function addFavorite(code: string): void {
  if (!supportedSet.has(code)) return;
  if (favorites.includes(code)) return;
  favorites = normalizeCurrencyList([...favorites, code]);
  void setSettings({ favorites, targets: favorites });
  hidePicker(picker);
  hidePicker(favoritesPicker);
  renderConverter();
  renderSettings();
}

function removeFavorite(code: string): void {
  if (favorites.length <= 1) return;
  favorites = favorites.filter((item) => item !== code);
  void setSettings({ favorites, targets: favorites });
  renderConverter();
  renderSettings();
}

function moveFavorite(index: number, delta: number): void {
  const next = [...favorites];
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= next.length) return;
  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);
  favorites = next;
  void setSettings({ favorites, targets: favorites });
  renderConverter();
  renderSettings();
}

function setupPicker(
  searchInput: HTMLInputElement,
  optionsContainer: HTMLDivElement,
  onSelect: (code: string) => void
): void {
  const render = (query: string): void => {
    const term = query.trim().toLowerCase();
    optionsContainer.innerHTML = '';
    SUPPORTED_CURRENCIES.forEach((code) => {
      if (favorites.includes(code)) return;
      const name = CURRENCY_NAMES[code] ?? code;
      const aliases = CURRENCY_ALIASES[code] ?? [];
      if (term) {
        const match =
          code.toLowerCase().includes(term) ||
          name.toLowerCase().includes(term) ||
          aliases.some((alias) => alias.toLowerCase().includes(term));
        if (!match) return;
      }
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'picker-option';
      option.innerHTML = `<span>${getCurrencyFlag(code)} ${code}</span><span>${name}</span>`;
      option.addEventListener('click', () => onSelect(code));
      optionsContainer.appendChild(option);
    });
  };

  searchInput.addEventListener('input', () => render(searchInput.value));
  render('');
}

function togglePicker(container: HTMLDivElement): void {
  container.classList.toggle('hidden');
  if (!container.classList.contains('hidden')) {
    const input = container.querySelector('input');
    input?.focus();
  }
}

function hidePicker(container: HTMLDivElement): void {
  if (!container.classList.contains('hidden')) {
    container.classList.add('hidden');
  }
}

function parseNumber(value: string): number | null {
  let cleaned = value.replace(/\s+/g, '').replace(/\u00a0/g, '');
  if (!cleaned) return null;
  cleaned = cleaned.replace(/[^\d.,+-]/g, '');
  if (!/\d/.test(cleaned)) return null;

  let sign = 1;
  if (cleaned.startsWith('-')) sign = -1;
  cleaned = cleaned.replace(/^[-+]/, '');

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
  } else if (hasComma && !hasDot) {
    const parts = cleaned.split(',');
    if (parts.length > 2) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = `${parts[0]}.${parts[1] ?? ''}`;
    }
  }

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed * sign;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4
  }).format(value);
}

init().catch((error) => {
  console.error('Currency Hover popup init failed:', error);
});
