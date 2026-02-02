import { HISTORY_SETTINGS_KEY, SUPPORTED_CURRENCIES } from '../shared/constants';
import { getCurrencyFlag } from '../shared/currencyMeta';
import { formatCopyValue, formatMoney, formatNumber, normalizedFixed } from '../shared/format';
import { sendMessage } from '../shared/runtime';
import {
  clearHistoryEntries,
  addHistoryEntry,
  getHistoryEntries,
  getHistorySettings,
  setHistorySettings,
  getSettings,
  onSettingsChanged,
  setSettings
} from '../shared/storage';
import { normalizeCurrencyList, type FavoritesGroups, type Settings } from '../shared/settings';
import { hasFeature, isPro } from '../shared/capabilities';
import { applyTheme, type ThemeSetting } from '../shared/theme';
import type { ConvertResponse, RefreshResponse } from '../background/messaging';

const openSettingsBtn = document.querySelector<HTMLButtonElement>('#open-settings')!;
const openHistoryBtn = document.querySelector<HTMLButtonElement>('#open-history')!;
const converterView = document.querySelector<HTMLDivElement>('#converter-view')!;
const settingsView = document.querySelector<HTMLDivElement>('#settings-view')!;
const historyView = document.querySelector<HTMLDivElement>('#history-view')!;
const backBtn = document.querySelector<HTMLButtonElement>('#back')!;
const historyBackBtn = document.querySelector<HTMLButtonElement>('#history-back')!;

const converterList = document.querySelector<HTMLDivElement>('#converter-list')!;
const converterError = document.querySelector<HTMLDivElement>('#converter-error')!;
const addCurrencyBtn = document.querySelector<HTMLButtonElement>('#add-currency-btn')!;
const picker = document.querySelector<HTMLDivElement>('#currency-picker')!;
const pickerSearch = document.querySelector<HTMLInputElement>('#currency-search')!;
const pickerOptions = document.querySelector<HTMLDivElement>('#currency-options')!;
const detectToggle = document.querySelector<HTMLInputElement>('#detect-currency')!;
const showDateQuickToggle = document.querySelector<HTMLInputElement>('#show-date-quick')!;
const ratesUpdated = document.querySelector<HTMLSpanElement>('#rates-updated')!;
const refreshBtn = document.querySelector<HTMLButtonElement>('#refresh')!;
const groupSwitcher = document.querySelector<HTMLDivElement>('#group-switcher')!;
const groupSelect = document.querySelector<HTMLSelectElement>('#group-select')!;
const manageGroupsBtn = document.querySelector<HTMLButtonElement>('#manage-groups')!;

const themeSelect = document.querySelector<HTMLSelectElement>('#theme')!;
const favoritesList = document.querySelector<HTMLDivElement>('#favorites-list')!;
const favoritesAddBtn = document.querySelector<HTMLButtonElement>('#favorites-add')!;
const favoritesPicker = document.querySelector<HTMLDivElement>('#favorites-picker')!;
const favoritesSearch = document.querySelector<HTMLInputElement>('#favorites-search')!;
const favoritesOptions = document.querySelector<HTMLDivElement>('#favorites-options')!;
const groupsSection = document.querySelector<HTMLDivElement>('#groups-section')!;
const groupsList = document.querySelector<HTMLDivElement>('#groups-list')!;
const groupAddBtn = document.querySelector<HTMLButtonElement>('#group-add')!;
const autoHideSelect = document.querySelector<HTMLSelectElement>('#auto-hide')!;
const showDateToggle = document.querySelector<HTMLInputElement>('#show-date')!;
const ttlInput = document.querySelector<HTMLInputElement>('#ttl')!;
const formatMode = document.querySelector<HTMLSelectElement>('#format-mode')!;
const formatAuto = document.querySelector<HTMLDivElement>('#format-auto')!;
const formatFixed = document.querySelector<HTMLDivElement>('#format-fixed')!;
const formatMin = document.querySelector<HTMLInputElement>('#format-min')!;
const formatMax = document.querySelector<HTMLInputElement>('#format-max')!;
const formatFixedDecimals = document.querySelector<HTMLInputElement>('#format-fixed-decimals')!;
const formatGrouping = document.querySelector<HTMLInputElement>('#format-grouping')!;
const formatCompact = document.querySelector<HTMLInputElement>('#format-compact')!;
const copyModeSelect = document.querySelector<HTMLSelectElement>('#copy-mode')!;
const formatFixedSlider = document.querySelector<HTMLInputElement>('#format-fixed-slider')!;
const formatFixedValue = document.querySelector<HTMLSpanElement>('#format-fixed-value')!;
const formatProBadge = document.querySelector<HTMLDivElement>('#format-pro-badge')!;
const formatPreview = document.querySelector<HTMLSpanElement>('#format-preview')!;
const copyDecimals = document.querySelector<HTMLInputElement>('#copy-decimals')!;
const copyDecimalsValue = document.querySelector<HTMLSpanElement>('#copy-decimals-value')!;
const copyIncludeCode = document.querySelector<HTMLInputElement>('#copy-include-code')!;
const copyIncludeSymbol = document.querySelector<HTMLInputElement>('#copy-include-symbol')!;
const copyProBadge = document.querySelector<HTMLDivElement>('#copy-pro-badge')!;
const copyPreview = document.querySelector<HTMLSpanElement>('#copy-preview')!;
const historyEnabledToggle = document.querySelector<HTMLInputElement>('#history-enabled')!;
const historyMaxInput = document.querySelector<HTMLInputElement>('#history-max')!;
const historyProBadge = document.querySelector<HTMLDivElement>('#history-pro-badge')!;

const proCard = document.querySelector<HTMLDivElement>('#pro-card')!;
const proDonateBtn = document.querySelector<HTMLButtonElement>('#pro-donate')!;
const proEnterBtn = document.querySelector<HTMLButtonElement>('#pro-enter')!;
const proRestoreBtn = document.querySelector<HTMLButtonElement>('#pro-restore')!;
const proDevBtn = document.querySelector<HTMLButtonElement>('#pro-dev')!;
const proCodeRow = document.querySelector<HTMLDivElement>('#pro-code-row')!;
const proCodeInput = document.querySelector<HTMLInputElement>('#pro-code')!;
const proApplyBtn = document.querySelector<HTMLButtonElement>('#pro-apply')!;
const proStatus = document.querySelector<HTMLDivElement>('#pro-status')!;

const historyList = document.querySelector<HTMLDivElement>('#history-list')!;
const historyLocked = document.querySelector<HTMLDivElement>('#history-locked')!;
const historyUnlockBtn = document.querySelector<HTMLButtonElement>('#history-unlock')!;
const clearHistoryBtn = document.querySelector<HTMLButtonElement>('#clear-history')!;

const supportedSet = new Set(SUPPORTED_CURRENCIES);
const CRYPTO_CODES = new Set(['BTC', 'ETH', 'USDT', 'SOL']);

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  UAH: 'Ukrainian Hryvnia',
  PLN: 'Polish Zloty',
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  USDT: 'Tether',
  SOL: 'Solana',
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
  BTC: ['bitcoin', '₿'],
  ETH: ['ethereum', 'ether', 'Ξ'],
  USDT: ['tether', 'usd t', '₮'],
  SOL: ['solana', '◎'],
  JPY: ['yen', '¥'],
  INR: ['rupee', '₹'],
  KRW: ['won', '₩']
};

const DEFAULT_FAVORITES = ['EUR', 'USD', 'UAH', 'PLN'];

let settings: Settings;
let favorites: string[] = [];
let favoritesGroups: FavoritesGroups | null = null;
let activeBase = '';
let values: Record<string, number> = {};
let editingCode: string | null = null;
let isProgrammatic = false;
let debounceTimer: number | null = null;
let requestSeq = 0;
let isProUser = false;
let historySettings = { enabled: false, maxItems: 200 };
let pendingHistory = false;

const rowMap = new Map<string, { row: HTMLDivElement; input: HTMLInputElement; baseTag: HTMLSpanElement }>();

async function init(): Promise<void> {
  settings = await getSettings();
  historySettings = await getHistorySettings();
  isProUser = isPro(settings);
  if (isProUser && !historySettings.enabled) {
    historySettings = await setHistorySettings({ enabled: true });
  }
  applyTheme(document.documentElement, settings.theme);
  initializeFavorites();
  renderConverter();
  renderSettings();
  await renderHistory();

  onSettingsChanged((next) => {
    settings = next;
    isProUser = isPro(settings);
    if (isProUser && !historySettings.enabled) {
      void setHistorySettings({ enabled: true }).then((updated) => {
        historySettings = updated;
        renderSettings();
      });
    }
    applyTheme(document.documentElement, settings.theme);
    initializeFavorites();
    renderConverter();
    renderSettings();
    void renderHistory();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[HISTORY_SETTINGS_KEY]) {
      historySettings = changes[HISTORY_SETTINGS_KEY].newValue ?? historySettings;
      renderSettings();
    }
  });

  openSettingsBtn.addEventListener('click', () => switchView('settings'));
  openHistoryBtn.addEventListener('click', () => switchView('history'));
  backBtn.addEventListener('click', () => switchView('converter'));
  historyBackBtn.addEventListener('click', () => switchView('converter'));
  historyUnlockBtn.addEventListener('click', () => {
    switchView('settings');
    proCard.scrollIntoView({ block: 'nearest' });
  });

  addCurrencyBtn.addEventListener('click', () => togglePicker(picker));
  favoritesAddBtn.addEventListener('click', () => togglePicker(favoritesPicker));
  manageGroupsBtn.addEventListener('click', () => switchView('settings'));

  setupPicker(pickerSearch, pickerOptions, (code) => addFavorite(code));
  setupPicker(favoritesSearch, favoritesOptions, (code) => addFavorite(code));

  detectToggle.addEventListener('change', () => {
    void setSettings({ detectCurrency: detectToggle.checked });
  });

  showDateQuickToggle.addEventListener('change', () => {
    void setSettings({ tooltip: { showRateDate: showDateQuickToggle.checked } });
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

  ttlInput.addEventListener('change', () => {
    const value = Math.max(1, Math.round(Number(ttlInput.value)) || 1);
    void setSettings({ cacheTtlMinutes: value });
  });

  groupSelect.addEventListener('change', () => {
    if (!hasFeature(settings, 'favorites-groups')) {
      openProSection();
      groupSelect.value = favoritesGroups?.activeId ?? groupSelect.value;
      return;
    }
    if (!favoritesGroups) return;
    favoritesGroups = {
      ...favoritesGroups,
      activeId: groupSelect.value
    };
    const active = favoritesGroups.groups.find((group) => group.id === favoritesGroups?.activeId);
    const groupFavorites = active?.favorites?.length ? active.favorites : favorites;
    void setSettings({ favoritesGroups, favorites: groupFavorites, targets: groupFavorites });
  });

  groupAddBtn.addEventListener('click', () => {
    if (!hasFeature(settings, 'favorites-groups')) {
      openProSection();
      return;
    }
    const name = prompt('Group name', 'New group');
    if (!name) return;
    const id = `group-${Date.now().toString(36)}`;
    const next: FavoritesGroups = favoritesGroups ?? {
      activeId: id,
      groups: []
    };
    next.groups = [
      ...next.groups,
      {
        id,
        name,
        favorites: [...favorites]
      }
    ];
    next.activeId = id;
    favoritesGroups = next;
    void setSettings({ favoritesGroups: next, favorites: favorites });
  });

  clearHistoryBtn.addEventListener('click', async () => {
    if (!isProUser) {
      openProSection();
      return;
    }
    const confirmed = confirm('Clear history?');
    if (!confirmed) return;
    await clearHistoryEntries();
    await renderHistory();
  });

  historyEnabledToggle.addEventListener('change', async () => {
    if (!isProUser) {
      openProSection();
      historyEnabledToggle.checked = historySettings.enabled;
      return;
    }
    historySettings = await setHistorySettings({ enabled: historyEnabledToggle.checked });
  });

  historyMaxInput.addEventListener('change', async () => {
    if (!isProUser) {
      openProSection();
      historyMaxInput.value = String(historySettings.maxItems);
      return;
    }
    const value = Math.max(50, Math.min(2000, Math.round(Number(historyMaxInput.value)) || 200));
    historyMaxInput.value = String(value);
    historySettings = await setHistorySettings({ maxItems: value });
  });

  formatMode.addEventListener('change', () => {
    const mode = formatMode.value === 'fixed' ? 'fixed' : 'auto';
    const next = { ...settings.format, mode };
    void setSettings({ format: next });
    updateFormatVisibility(next.mode);
  });

  formatMin.addEventListener('change', () => {
    const min = clampNumber(formatMin.value, 0, 4, settings.format.minDecimals);
    const max = clampNumber(formatMax.value, min, 6, settings.format.maxDecimals);
    formatMin.value = String(min);
    formatMax.value = String(max);
    void setSettings({ format: { ...settings.format, minDecimals: min, maxDecimals: max } });
  });

  formatMax.addEventListener('change', () => {
    const min = clampNumber(formatMin.value, 0, 4, settings.format.minDecimals);
    const max = clampNumber(formatMax.value, min, 6, settings.format.maxDecimals);
    formatMin.value = String(min);
    formatMax.value = String(max);
    void setSettings({ format: { ...settings.format, minDecimals: min, maxDecimals: max } });
  });

  formatGrouping.addEventListener('change', () => {
    void setSettings({ format: { ...settings.format, grouping: formatGrouping.checked } });
  });

  formatCompact.addEventListener('change', () => {
    void setSettings({ format: { ...settings.format, compact: formatCompact.checked } });
  });

  copyModeSelect.addEventListener('change', () => {
    const value = copyModeSelect.value;
    const copyMode = value === 'raw' || value === 'formatted' ? value : 'default';
    const legacyMode = copyMode === 'raw' ? 'raw' : 'formatted';
    void setSettings({ copy: { ...settings.copy, mode: copyMode }, format: { ...settings.format, copyMode: legacyMode } });
  });

  formatFixedSlider.addEventListener('input', () => {
    if (!hasFeature(settings, 'formatting-advanced')) {
      openProSection();
      formatFixedSlider.value = String(settings.format.fixedDecimals);
      formatFixedValue.textContent = String(settings.format.fixedDecimals);
      return;
    }
    const value = clampNumber(formatFixedSlider.value, 0, 8, settings.format.fixedDecimals);
    formatFixedSlider.value = String(value);
    formatFixedValue.textContent = String(value);
    formatFixedDecimals.value = String(value);
    void setSettings({ format: { ...settings.format, fixedDecimals: value } });
  });

  formatFixedDecimals.addEventListener('change', () => {
    if (!hasFeature(settings, 'formatting-advanced')) {
      openProSection();
      formatFixedDecimals.value = String(settings.format.fixedDecimals);
      formatFixedSlider.value = String(settings.format.fixedDecimals);
      formatFixedValue.textContent = String(settings.format.fixedDecimals);
      return;
    }
    const max = 8;
    const fixed = clampNumber(formatFixedDecimals.value, 0, max, settings.format.fixedDecimals);
    formatFixedDecimals.value = String(fixed);
    formatFixedSlider.value = String(fixed);
    formatFixedValue.textContent = String(fixed);
    void setSettings({ format: { ...settings.format, fixedDecimals: fixed } });
  });

  copyDecimals.addEventListener('input', () => {
    if (!hasFeature(settings, 'copy-advanced')) {
      openProSection();
      copyDecimals.value = String(settings.copy.decimals);
      copyDecimalsValue.textContent = String(settings.copy.decimals);
      return;
    }
    const value = clampNumber(copyDecimals.value, 0, 8, settings.copy.decimals);
    copyDecimals.value = String(value);
    copyDecimalsValue.textContent = String(value);
    void setSettings({ copy: { ...settings.copy, decimals: value } });
  });

  copyIncludeCode.addEventListener('change', () => {
    void setSettings({ copy: { ...settings.copy, includeCode: copyIncludeCode.checked } });
  });

  copyIncludeSymbol.addEventListener('change', () => {
    if (!hasFeature(settings, 'copy-advanced')) {
      openProSection();
      copyIncludeSymbol.checked = settings.copy.includeSymbol;
      return;
    }
    void setSettings({ copy: { ...settings.copy, includeSymbol: copyIncludeSymbol.checked } });
  });

  proDonateBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://example.com/donate' });
  });

  proEnterBtn.addEventListener('click', () => {
    proCodeRow.classList.toggle('hidden');
    if (!proCodeRow.classList.contains('hidden')) {
      proCodeInput.focus();
    }
  });

  proRestoreBtn.addEventListener('click', () => {
    unlockPro('manual');
  });

  proApplyBtn.addEventListener('click', () => {
    const code = proCodeInput.value.trim();
    if (code.length < 8) {
      proStatus.textContent = 'Invalid code. Try again.';
      return;
    }
    unlockPro('manual');
  });

  if (import.meta.env.MODE !== 'production') {
    proDevBtn.classList.remove('hidden');
    proDevBtn.addEventListener('click', () => {
      unlockPro('manual');
    });
  }

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
  favoritesGroups = settings.favoritesGroups ?? null;
  if (favoritesGroups && !hasFeature(settings, 'favorites-groups') && favoritesGroups.groups.length > 1) {
    favoritesGroups = {
      activeId: favoritesGroups.groups[0].id,
      groups: [favoritesGroups.groups[0]]
    };
    void setSettings({ favoritesGroups });
  }
  const activeGroup = favoritesGroups?.groups?.find((group) => group.id === favoritesGroups?.activeId);
  favorites = activeGroup?.favorites?.length ? [...activeGroup.favorites] : [...settings.favorites];
  if (!favorites.length) {
    favorites = [...DEFAULT_FAVORITES];
  }

  if (!hasFeature(settings, 'crypto')) {
    const filtered = favorites.filter((code) => !CRYPTO_CODES.has(code));
    if (filtered.length !== favorites.length) {
      favorites = filtered.length ? filtered : [...DEFAULT_FAVORITES];
      const nextGroups = updateGroupsFromFavorites(favoritesGroups, favorites);
      favoritesGroups = nextGroups;
      void setSettings({ favorites, targets: favorites, favoritesGroups: nextGroups });
    }
  }

  if (!settings.favorites.length) {
    void setSettings({ favorites, targets: favorites });
  }
  if (!favorites.includes(settings.baseCurrency)) {
    activeBase = favorites[0] ?? settings.baseCurrency;
  } else {
    activeBase = settings.baseCurrency;
  }
}

function switchView(view: 'converter' | 'settings' | 'history'): void {
  converterView.classList.toggle('hidden', view !== 'converter');
  settingsView.classList.toggle('hidden', view !== 'settings');
  historyView.classList.toggle('hidden', view !== 'history');
  if (view === 'history') {
    void renderHistory();
  }
}

function renderConverter(): void {
  converterList.innerHTML = '';
  converterError.textContent = '';
  rowMap.clear();

  detectToggle.checked = settings.detectCurrency;
  showDateQuickToggle.checked = settings.tooltip.showRateDate;
  updateGroupSwitcher();

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
    input.value = values[code] !== undefined ? formatNumber(values[code], settings.format) : '';

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.type = 'button';
    remove.textContent = '×';
    remove.addEventListener('click', () => removeFavorite(code));

    input.addEventListener('focus', () => {
      setActiveBase(code);
      if (values[code] !== undefined) {
        editingCode = code;
        input.value = formatEditValue(values[code]);
      }
    });
    input.addEventListener('input', () => {
      handleInput(code, input.value);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const parsed = parseNumber(input.value);
      if (parsed !== null) {
        values[code] = parsed;
        pendingHistory = true;
        void convertFromBase(code, parsed);
      }
      input.blur();
    });
    input.addEventListener('blur', () => {
      const parsed = parseNumber(input.value);
      if (parsed !== null) {
        values[code] = parsed;
        pendingHistory = true;
        void convertFromBase(code, parsed);
      }
      if (values[code] !== undefined) {
        input.value = formatNumber(values[code], settings.format);
      } else {
        input.value = '';
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

function updateGroupSwitcher(): void {
  if (!favoritesGroups || !hasFeature(settings, 'favorites-groups') || favoritesGroups.groups.length <= 1) {
    groupSwitcher.classList.add('hidden');
    return;
  }
  groupSwitcher.classList.remove('hidden');
  groupSelect.innerHTML = '';
  favoritesGroups.groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = group.name;
    groupSelect.appendChild(option);
  });
  groupSelect.value = favoritesGroups.activeId;
}

function renderSettings(): void {
  themeSelect.value = settings.theme;
  showDateToggle.checked = settings.tooltip.showRateDate;
  autoHideSelect.value = String(settings.tooltip.autoHideSeconds);
  ttlInput.value = String(settings.cacheTtlMinutes);
  formatMode.value = settings.format.mode;
  formatMin.value = String(settings.format.minDecimals);
  formatMax.value = String(settings.format.maxDecimals);
  formatFixedDecimals.value = String(settings.format.fixedDecimals);
  formatFixedSlider.value = String(settings.format.fixedDecimals);
  formatFixedValue.textContent = String(settings.format.fixedDecimals);
  formatGrouping.checked = settings.format.grouping;
  formatCompact.checked = settings.format.compact;
  copyModeSelect.value = settings.copy.mode;
  copyDecimals.value = String(settings.copy.decimals);
  copyDecimalsValue.textContent = String(settings.copy.decimals);
  copyIncludeCode.checked = settings.copy.includeCode;
  copyIncludeSymbol.checked = settings.copy.includeSymbol;
  historyEnabledToggle.checked = historySettings.enabled;
  historyMaxInput.value = String(historySettings.maxItems);
  formatPreview.textContent = formatMoney(1234.56, 'USD', settings.format);
  copyPreview.textContent = formatCopyValue(1234.56, 'USD', settings.copy, settings.format);
  updateProCard();
  applyProGating();
  updateFormatVisibility(settings.format.mode);

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

  renderGroups();
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
  pendingHistory = false;
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

  if (pendingHistory && hasFeature(settings, 'history') && historySettings.enabled) {
    pendingHistory = false;
    await addHistoryEntry(
      {
        ts: Date.now(),
        base,
        amount,
        favoritesSnapshot: [...favorites],
        conversions: response.conversions
      },
      historySettings.maxItems
    );
    if (!historyView.classList.contains('hidden')) {
      await renderHistory();
    }
  }
}

function applyValuesToInputs(active: string): void {
  isProgrammatic = true;
  rowMap.forEach(({ input }, code) => {
    if (code === active && editingCode === active) return;
    const value = values[code];
    input.value = value !== undefined ? formatNumber(value, settings.format) : '';
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

function updateProCard(): void {
  if (isProUser) {
    proStatus.textContent = 'Pro unlocked. Спасибо за поддержку!';
    proCodeRow.classList.add('hidden');
  } else {
    proStatus.textContent = 'Unlock Pro to enable advanced features.';
  }
}

function applyProGating(): void {
  const formattingPro = hasFeature(settings, 'formatting-advanced');
  const copyPro = hasFeature(settings, 'copy-advanced');
  const groupsPro = hasFeature(settings, 'favorites-groups');
  const historyPro = hasFeature(settings, 'history');

  const maxAuto = formattingPro ? 8 : 4;
  formatMax.max = String(maxAuto);
  formatMin.max = String(formattingPro ? 6 : 4);
  formatFixedSlider.max = String(formattingPro ? 8 : 4);
  formatFixedDecimals.max = String(formattingPro ? 8 : 4);
  formatFixedSlider.disabled = !formattingPro;
  formatFixedDecimals.disabled = !formattingPro;
  formatFixedDecimals.readOnly = !formattingPro;
  formatProBadge.classList.toggle('hidden', formattingPro);

  copyDecimals.max = String(copyPro ? 8 : 2);
  copyDecimals.disabled = !copyPro;
  copyDecimals.readOnly = !copyPro;
  copyIncludeSymbol.disabled = !copyPro;
  copyProBadge.classList.toggle('hidden', copyPro);

  if (!formattingPro && settings.format.fixedDecimals > 4) {
    void setSettings({ format: { ...settings.format, fixedDecimals: 4 } });
  }
  if (!copyPro && settings.copy.decimals !== 2) {
    void setSettings({ copy: { ...settings.copy, decimals: 2 } });
  }
  if (!copyPro && settings.copy.includeSymbol) {
    void setSettings({ copy: { ...settings.copy, includeSymbol: false } });
  }

  groupsSection.classList.toggle('hidden', !groupsPro);
  groupSwitcher.classList.toggle('hidden', !groupsPro);

  historyLocked.classList.toggle('hidden', historyPro);
  clearHistoryBtn.disabled = !historyPro;
  historyEnabledToggle.disabled = !historyPro;
  historyMaxInput.disabled = !historyPro;
  historyProBadge.classList.toggle('hidden', historyPro);
}

function renderGroups(): void {
  if (!favoritesGroups || !hasFeature(settings, 'favorites-groups')) {
    groupsList.innerHTML = '';
    return;
  }
  groupsList.innerHTML = '';
  favoritesGroups.groups.forEach((group) => {
    const row = document.createElement('div');
    row.className = 'fav-item';

    const label = document.createElement('div');
    label.textContent = group.name;

    const actions = document.createElement('div');
    actions.className = 'fav-actions';

    const useBtn = document.createElement('button');
    useBtn.type = 'button';
    useBtn.textContent = group.id === favoritesGroups?.activeId ? 'Active' : 'Use';
    useBtn.disabled = group.id === favoritesGroups?.activeId;
    useBtn.addEventListener('click', () => {
      const next: FavoritesGroups = { ...favoritesGroups!, activeId: group.id };
      favoritesGroups = next;
      void setSettings({ favoritesGroups: next, favorites: group.favorites, targets: group.favorites });
    });

    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', () => {
      const name = prompt('Group name', group.name);
      if (!name) return;
      const nextGroups = favoritesGroups!.groups.map((item) =>
        item.id === group.id ? { ...item, name } : item
      );
      const next: FavoritesGroups = { ...favoritesGroups!, groups: nextGroups };
      favoritesGroups = next;
      void setSettings({ favoritesGroups: next });
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Delete';
    removeBtn.disabled = favoritesGroups!.groups.length <= 1;
    removeBtn.addEventListener('click', () => {
      if (favoritesGroups!.groups.length <= 1) return;
      const nextGroups = favoritesGroups!.groups.filter((item) => item.id !== group.id);
      const activeId =
        favoritesGroups!.activeId === group.id ? nextGroups[0]?.id ?? '' : favoritesGroups!.activeId;
      const next: FavoritesGroups = { activeId, groups: nextGroups };
      favoritesGroups = next;
      void setSettings({ favoritesGroups: next });
    });

    actions.append(useBtn, renameBtn, removeBtn);
    row.append(label, actions);
    groupsList.appendChild(row);
  });
}

function openProSection(): void {
  switchView('settings');
  proCard.scrollIntoView({ block: 'nearest' });
}

function updateGroupsFromFavorites(groups: FavoritesGroups | null, nextFavorites: string[]): FavoritesGroups {
  if (!groups || !groups.groups.length) {
    return {
      activeId: 'default',
      groups: [
        {
          id: 'default',
          name: 'Default',
          favorites: nextFavorites
        }
      ]
    };
  }
  const index = groups.groups.findIndex((group) => group.id === groups.activeId);
  const activeIndex = index >= 0 ? index : 0;
  const nextGroups = [...groups.groups];
  nextGroups[activeIndex] = { ...nextGroups[activeIndex], favorites: nextFavorites };
  return { activeId: nextGroups[activeIndex].id, groups: nextGroups };
}

async function unlockPro(source: 'manual'): Promise<void> {
  const next = {
    ...settings.entitlements,
    pro: true,
    source,
    updatedAt: Date.now()
  };
  settings = await setSettings({ entitlements: next });
  isProUser = true;
  historySettings = await setHistorySettings({ enabled: true });
  renderSettings();
}

async function renderHistory(): Promise<void> {
  if (!hasFeature(settings, 'history')) {
    historyList.innerHTML = '';
    historyLocked.classList.remove('hidden');
    return;
  }
  historyLocked.classList.add('hidden');
  const entries = await getHistoryEntries();
  historyList.innerHTML = '';
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'helper-text';
    empty.textContent = 'No history yet.';
    historyList.appendChild(empty);
    return;
  }

  const groups = groupHistory(entries);
  for (const group of groups) {
    const header = document.createElement('div');
    header.className = 'history-group';
    header.textContent = group.label;
    historyList.appendChild(header);

    group.items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'history-item';

      const headerRow = document.createElement('div');
      headerRow.className = 'history-header';
      headerRow.textContent = `${formatMoney(item.amount, item.base, settings.format)}`;

      const time = document.createElement('span');
      time.textContent = new Date(item.ts).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
      headerRow.appendChild(time);

      const conversions = document.createElement('div');
      const top = Object.entries(item.conversions).slice(0, 3);
      top.forEach(([code, value]) => {
        const line = document.createElement('div');
        line.textContent = `${code} ${formatNumber(value, settings.format)}`;
        const copyConv = document.createElement('button');
        copyConv.type = 'button';
        copyConv.textContent = 'Copy';
        copyConv.addEventListener('click', async () => {
          await copyText(formatCopyValue(value, code, settings.copy, settings.format));
        });
        const rowWrap = document.createElement('div');
        rowWrap.className = 'history-actions';
        rowWrap.append(line, copyConv);
        conversions.appendChild(rowWrap);
      });

      const actions = document.createElement('div');
      actions.className = 'history-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await copyText(formatCopyValue(item.amount, item.base, settings.copy, settings.format));
      });

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.textContent = 'Re-apply';
      applyBtn.addEventListener('click', () => {
        setActiveBase(item.base);
        values[item.base] = item.amount;
        pendingHistory = false;
        scheduleConvert(item.base, item.amount);
        switchView('converter');
      });

      actions.append(copyBtn, applyBtn);
      row.append(headerRow, conversions, actions);
      historyList.appendChild(row);
    });
  }
}

function groupHistory(entries: Awaited<ReturnType<typeof getHistoryEntries>>): Array<{
  label: string;
  items: Awaited<ReturnType<typeof getHistoryEntries>>;
}> {
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  const buckets: Record<string, Awaited<ReturnType<typeof getHistoryEntries>>> = {};
  entries.forEach((entry) => {
    const dateStr = new Date(entry.ts).toDateString();
    let label = new Date(entry.ts).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    if (dateStr === todayStr) label = 'Today';
    if (dateStr === yesterdayStr) label = 'Yesterday';
    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(entry);
  });

  return Object.entries(buckets).map(([label, items]) => ({ label, items }));
}

async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fallback below
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
function addFavorite(code: string): void {
  if (!supportedSet.has(code)) return;
  if (CRYPTO_CODES.has(code) && !hasFeature(settings, 'crypto')) {
    openProSection();
    return;
  }
  if (favorites.includes(code)) return;
  favorites = normalizeCurrencyList([...favorites, code]);
  const nextGroups = updateGroupsFromFavorites(favoritesGroups, favorites);
  favoritesGroups = nextGroups;
  void setSettings({ favorites, targets: favorites, favoritesGroups: nextGroups });
  hidePicker(picker);
  hidePicker(favoritesPicker);
  renderConverter();
  renderSettings();
}

function removeFavorite(code: string): void {
  if (favorites.length <= 1) return;
  favorites = favorites.filter((item) => item !== code);
  const nextGroups = updateGroupsFromFavorites(favoritesGroups, favorites);
  favoritesGroups = nextGroups;
  void setSettings({ favorites, targets: favorites, favoritesGroups: nextGroups });
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
  const nextGroups = updateGroupsFromFavorites(favoritesGroups, favorites);
  favoritesGroups = nextGroups;
  void setSettings({ favorites, targets: favorites, favoritesGroups: nextGroups });
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
      if (CRYPTO_CODES.has(code) && !hasFeature(settings, 'crypto')) return;
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

function formatEditValue(value: number): string {
  const decimals =
    settings.format.mode === 'fixed' ? settings.format.fixedDecimals : settings.copy.decimals;
  return normalizedFixed(value, clampValue(decimals, 0, 8));
}

function updateFormatVisibility(mode: 'auto' | 'fixed'): void {
  formatAuto.classList.toggle('hidden', mode !== 'auto');
  formatFixed.classList.toggle('hidden', mode !== 'fixed');
}

function clampNumber(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function clampValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

init().catch((error) => {
  console.error('Currency Hover popup init failed:', error);
});
