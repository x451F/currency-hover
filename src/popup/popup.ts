import { HISTORY_SETTINGS_KEY, SUPPORTED_CURRENCIES } from '../shared/constants';
import { renderCurrencyIcon } from '../shared/currencyIcon';
import { formatCopyValue, formatMoney, formatNumber, normalizedFixed } from '../shared/format';
import { sendMessage } from '../shared/runtime';
import {
  clearHistoryEntries,
  addHistoryEntry,
  getLastPopupAmount,
  getHistoryEntries,
  getHistorySettings,
  setHistorySettings,
  getSettings,
  onSettingsChanged,
  setLastPopupAmount,
  setSettings
} from '../shared/storage';
import { isSupportedCurrency, normalizeCurrencyList, type FavoritesGroups, type Settings } from '../shared/settings';
import { applyTheme, type ThemeSetting } from '../shared/theme';
import type { ConvertResponse, RefreshResponse } from '../background/messaging';

const TRASH_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>';
const COPY_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="10" height="10" rx="2"></rect><rect x="5" y="5" width="10" height="10" rx="2"></rect></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 13l4 4L19 7"></path></svg>';

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
const formatPreview = document.querySelector<HTMLSpanElement>('#format-preview')!;
const copyDecimals = document.querySelector<HTMLInputElement>('#copy-decimals')!;
const copyDecimalsValue = document.querySelector<HTMLSpanElement>('#copy-decimals-value')!;
const copyIncludeCode = document.querySelector<HTMLInputElement>('#copy-include-code')!;
const copyIncludeSymbol = document.querySelector<HTMLInputElement>('#copy-include-symbol')!;
const copyPreview = document.querySelector<HTMLSpanElement>('#copy-preview')!;
const historyEnabledToggle = document.querySelector<HTMLInputElement>('#history-enabled')!;
const historyMaxInput = document.querySelector<HTMLInputElement>('#history-max')!;

const historyList = document.querySelector<HTMLDivElement>('#history-list')!;
const clearHistoryBtn = document.querySelector<HTMLButtonElement>('#clear-history')!;

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
const values: Record<string, number> = {};
let editingCode: string | null = null;
let isProgrammatic = false;
let debounceTimer: number | null = null;
let requestSeq = 0;
let historySettings = { enabled: false, maxItems: 200 };
let pendingHistory = false;
let replacingCode: string | null = null;
let dragState: {
  code: string;
  row: HTMLDivElement;
  pointerId: number;
  offsetY: number;
  startX: number;
  width: number;
  placeholder: HTMLDivElement;
} | null = null;

const rowMap = new Map<
  string,
  { row: HTMLDivElement; input: HTMLInputElement }
>();

async function init(): Promise<void> {
  settings = await getSettings();
  historySettings = await getHistorySettings();
  applyTheme(document.documentElement, settings.theme);
  initializeFavorites();
  await restoreLastPopupAmount();
  renderConverter();
  renderSettings();
  await renderHistory();
  if (values[activeBase] !== undefined) {
    scheduleConvert(activeBase, values[activeBase]);
  }

  onSettingsChanged((next) => {
    settings = next;
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

  addCurrencyBtn.addEventListener('click', () => {
    replacingCode = null;
    renderConverter();
    togglePicker(picker);
  });
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
      const code = editingCode ?? activeBase;
      if (values[code] !== undefined) {
        scheduleConvert(code, values[code]);
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
    const confirmed = confirm('Clear history?');
    if (!confirmed) return;
    await clearHistoryEntries();
    await renderHistory();
  });

  historyEnabledToggle.addEventListener('change', async () => {
    historySettings = await setHistorySettings({ enabled: historyEnabledToggle.checked });
  });

  historyMaxInput.addEventListener('change', async () => {
    const value = Math.max(50, Math.min(2000, Math.round(Number(historyMaxInput.value)) || 200));
    historyMaxInput.value = String(value);
    historySettings = await setHistorySettings({ maxItems: value });
  });

  formatMode.addEventListener('change', () => {
    const mode: Settings['format']['mode'] = formatMode.value === 'fixed' ? 'fixed' : 'auto';
    const next = { ...settings.format, mode };
    void setSettings({ format: next });
    updateFormatVisibility(next.mode);
  });

  formatMin.addEventListener('change', () => {
    const min = clampNumber(formatMin.value, 0, 6, settings.format.minDecimals);
    const max = clampNumber(formatMax.value, min, 6, settings.format.maxDecimals);
    formatMin.value = String(min);
    formatMax.value = String(max);
    void setSettings({ format: { ...settings.format, minDecimals: min, maxDecimals: max } });
  });

  formatMax.addEventListener('change', () => {
    const min = clampNumber(formatMin.value, 0, 6, settings.format.minDecimals);
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
    void setSettings({
      copy: { ...settings.copy, mode: copyMode },
      format: { ...settings.format, copyMode: legacyMode }
    });
  });

  formatFixedSlider.addEventListener('input', () => {
    const value = clampNumber(formatFixedSlider.value, 0, 8, settings.format.fixedDecimals);
    formatFixedSlider.value = String(value);
    formatFixedValue.textContent = String(value);
    formatFixedDecimals.value = String(value);
    void setSettings({ format: { ...settings.format, fixedDecimals: value } });
  });

  formatFixedDecimals.addEventListener('change', () => {
    const max = 8;
    const fixed = clampNumber(formatFixedDecimals.value, 0, max, settings.format.fixedDecimals);
    formatFixedDecimals.value = String(fixed);
    formatFixedSlider.value = String(fixed);
    formatFixedValue.textContent = String(fixed);
    void setSettings({ format: { ...settings.format, fixedDecimals: fixed } });
  });

  copyDecimals.addEventListener('input', () => {
    const value = clampNumber(copyDecimals.value, 0, 8, settings.copy.decimals);
    copyDecimals.value = String(value);
    copyDecimalsValue.textContent = String(value);
    void setSettings({ copy: { ...settings.copy, decimals: value } });
  });

  copyIncludeCode.addEventListener('change', () => {
    void setSettings({ copy: { ...settings.copy, includeCode: copyIncludeCode.checked } });
  });

  copyIncludeSymbol.addEventListener('change', () => {
    void setSettings({ copy: { ...settings.copy, includeSymbol: copyIncludeSymbol.checked } });
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!picker.contains(event.target as Node) && event.target !== addCurrencyBtn) {
      hidePicker(picker);
    }
    if (!favoritesPicker.contains(event.target as Node) && event.target !== favoritesAddBtn) {
      hidePicker(favoritesPicker);
    }
    if (
      replacingCode &&
      !target?.closest('.replace-picker') &&
      !target?.closest('.currency-pill')
    ) {
      replacingCode = null;
      renderConverter();
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
  const activeGroup = favoritesGroups?.groups?.find(
    (group) => group.id === favoritesGroups?.activeId
  );
  favorites = activeGroup?.favorites?.length ? [...activeGroup.favorites] : [...settings.favorites];
  if (!favorites.length) {
    favorites = [...DEFAULT_FAVORITES];
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

async function restoreLastPopupAmount(): Promise<void> {
  const last = await getLastPopupAmount();
  if (!last || !favorites.includes(last.base)) return;
  activeBase = last.base;
  values[last.base] = last.amount;
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
    row.dataset['code'] = code;

    const dragHandle = document.createElement('button');
    dragHandle.type = 'button';
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '⋮⋮';
    dragHandle.setAttribute('aria-label', 'Reorder currency');
    dragHandle.draggable = false;

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'currency-pill';
    pill.setAttribute('aria-label', `Change ${code}`);
    pill.title = `Change ${code}`;
    const flag = document.createElement('span');
    flag.className = 'currency-mark';
    renderCurrencyIcon(flag, code);
    const label = document.createElement('span');
    label.className = 'code';
    label.textContent = code;
    pill.append(flag, label);
    pill.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    pill.addEventListener('click', (event) => {
      event.stopPropagation();
      replacingCode = replacingCode === code ? null : code;
      hidePicker(picker);
      renderConverter();
    });

    const input = document.createElement('input');
    input.className = 'amount-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.placeholder = '0.00';
    setInputDisplayValue(input, values[code]);

    const clearAmount = document.createElement('button');
    clearAmount.className = 'clear-amount-btn';
    clearAmount.type = 'button';
    clearAmount.textContent = '×';
    clearAmount.setAttribute('aria-label', `Clear ${code} amount`);
    clearAmount.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    clearAmount.addEventListener('click', () => {
      clearAmountValue(code, input);
    });

    const copyAmount = document.createElement('button');
    copyAmount.className = 'copy-amount-btn';
    copyAmount.type = 'button';
    copyAmount.innerHTML = COPY_SVG;
    copyAmount.setAttribute('aria-label', `Copy ${code} amount`);
    copyAmount.addEventListener('mousedown', (event) => {
      event.preventDefault();
    });
    copyAmount.addEventListener('click', async () => {
      await copyAmountValue(code, copyAmount);
    });

    const amountField = document.createElement('div');
    amountField.className = 'amount-field';
    amountField.append(copyAmount, input, clearAmount);
    amountField.classList.toggle('amount-field-has-value', values[code] !== undefined);

    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.type = 'button';
    remove.innerHTML = TRASH_SVG;
    remove.setAttribute('aria-label', `Remove ${code}`);
    remove.title = `Remove ${code}`;
    remove.addEventListener('click', () => removeFavorite(code));

    input.addEventListener('focus', () => {
      setActiveBase(code);
      if (values[code] !== undefined) {
        editingCode = code;
        input.classList.remove('amount-input-long', 'amount-input-xlong');
        input.value = formatEditValue(values[code]);
      }
    });
    input.addEventListener('input', () => {
      handleInput(code, input);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      input.blur();
    });
    input.addEventListener('blur', () => {
      const parsed = parseNumber(input.value);
      if (parsed !== null) {
        values[code] = parsed;
      }
      if (values[code] !== undefined) {
        setInputDisplayValue(input, values[code]);
      } else {
        setInputDisplayValue(input, undefined);
      }
      editingCode = null;
    });

    const left = document.createElement('div');
    left.className = 'row-left row-grab';
    left.append(dragHandle, pill);

    row.append(left, amountField, remove);
    converterList.appendChild(row);
    rowMap.set(code, { row, input });

    if (replacingCode === code) {
      converterList.appendChild(buildReplacePicker(code));
    }

    left.addEventListener('pointerdown', (event) => {
      startPointerDrag(event, code, row);
    });
  });

  updateActiveRow();
}

function updateGroupSwitcher(): void {
  if (
    !favoritesGroups ||
    favoritesGroups.groups.length <= 1
  ) {
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
  applyFeatureAvailability();
  updateFormatVisibility(settings.format.mode);

  favoritesList.innerHTML = '';
  favorites.forEach((code, index) => {
    const item = document.createElement('div');
    item.className = 'fav-item';

    const label = document.createElement('div');
    const icon = document.createElement('span');
    icon.className = 'currency-mark';
    renderCurrencyIcon(icon, code);
    label.append(icon, document.createTextNode(` ${code}`));

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
  rowMap.forEach(({ row }, code) => {
    const active = code === activeBase;
    row.classList.toggle('active', active);
    row.setAttribute('aria-current', active ? 'true' : 'false');
  });
}

document.addEventListener('pointermove', updatePointerDrag);
document.addEventListener('pointerup', endPointerDrag);
document.addEventListener('pointercancel', endPointerDrag);

function startPointerDrag(event: PointerEvent, code: string, row: HTMLDivElement): void {
  if (event.button !== 0) return;
  const rect = row.getBoundingClientRect();
  const placeholder = document.createElement('div');
  placeholder.className = 'drag-placeholder';
  placeholder.style.height = `${rect.height}px`;
  converterList.insertBefore(placeholder, row.nextSibling);
  dragState = {
    code,
    row,
    pointerId: event.pointerId,
    offsetY: event.clientY - rect.top,
    startX: rect.left,
    width: rect.width,
    placeholder
  };
  row.setPointerCapture(event.pointerId);
  row.classList.add('dragging');
  row.style.width = `${rect.width}px`;
  row.style.left = `${rect.left}px`;
  row.style.top = `${rect.top}px`;
  event.preventDefault();
}

function updatePointerDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { row, offsetY, startX, width, placeholder } = dragState;
  row.style.left = `${startX}px`;
  row.style.top = `${event.clientY - offsetY}px`;
  row.style.width = `${width}px`;

  const targetRow = getDropTarget(row, event.clientY) ?? getEdgeDropTarget(event.clientY);
  if (!targetRow) return;
  const targetRect = targetRow.getBoundingClientRect();
  const shouldInsertAfter = event.clientY > targetRect.top + targetRect.height / 2;
  const nextSibling = shouldInsertAfter ? targetRow.nextSibling : targetRow;
  if (nextSibling === placeholder || targetRow === placeholder) return;

  animateRows(() => {
    converterList.insertBefore(placeholder, nextSibling);
  });
}

function endPointerDrag(event: PointerEvent): void {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const { row, pointerId, placeholder } = dragState;
  try {
    row.releasePointerCapture(pointerId);
  } catch {
    // Already released by the browser.
  }
  converterList.insertBefore(row, placeholder);
  placeholder.remove();
  row.classList.remove('dragging');
  row.style.left = '';
  row.style.top = '';
  row.style.width = '';
  row.style.transform = '';
  dragState = null;
  persistDraggedOrder();
}

function getDropTarget(draggedRow: HTMLDivElement, clientY: number): HTMLDivElement | null {
  return (
    getConverterRows().find((row) => {
      if (row === draggedRow) return false;
      const rect = row.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    }) ?? null
  );
}

function getEdgeDropTarget(clientY: number): HTMLDivElement | null {
  const rows = getConverterRows().filter((row) => row !== dragState?.row);
  if (!rows.length) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (clientY < first.getBoundingClientRect().top) return first;
  if (clientY > last.getBoundingClientRect().bottom) return last;
  return null;
}

function animateRows(mutator: () => void): void {
  const rows = getConverterRows().filter((row) => row !== dragState?.row);
  const firstTops = new Map(rows.map((row) => [row, row.getBoundingClientRect().top]));
  mutator();

  getConverterRows()
    .filter((row) => row !== dragState?.row)
    .forEach((row) => {
      const firstTop = firstTops.get(row);
      if (firstTop === undefined) return;
      const delta = firstTop - row.getBoundingClientRect().top;
      if (delta === 0) return;

      row.style.transition = 'none';
      row.style.transform = `translateY(${delta}px)`;
      row.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        row.style.transition = '';
        row.style.transform = '';
      });
    });
}

function persistDraggedOrder(): void {
  const next = getConverterRows()
    .map((row) => row.dataset['code'])
    .filter((code): code is string => Boolean(code));
  if (!next.length || arraysEqual(next, favorites)) return;
  favorites = next;
  const nextGroups = updateGroupsFromFavorites(favoritesGroups, favorites);
  favoritesGroups = nextGroups;
  void setSettings({ favorites, targets: favorites, favoritesGroups: nextGroups });
  renderSettings();
  updateActiveRow();
}

function getConverterRows(): HTMLDivElement[] {
  return Array.from(converterList.querySelectorAll<HTMLDivElement>('.converter-row'));
}

function handleInput(code: string, input: HTMLInputElement): void {
  if (isProgrammatic) return;
  setActiveBase(code);
  const raw = sanitizeAmountInput(input);
  const currentInput = rowMap.get(code)?.input;
  if (!raw.trim()) {
    converterError.textContent = '';
    delete values[code];
    if (currentInput) {
      currentInput.title = '';
      currentInput.classList.remove('amount-input-long', 'amount-input-xlong');
      setAmountFieldHasValue(currentInput, false);
    }
    return;
  }
  const parsed = parseNumber(raw);
  if (parsed === null) {
    converterError.textContent = '';
    return;
  }
  pendingHistory = false;
  values[code] = parsed;
  if (currentInput) {
    setAmountFieldHasValue(currentInput, true);
  }
  scheduleConvert(code, parsed);
}

function sanitizeAmountInput(input: HTMLInputElement): string {
  const original = input.value;
  const cursor = input.selectionStart ?? original.length;
  const beforeCursor = original.slice(0, cursor);
  const sanitized = sanitizeAmountText(original);
  if (sanitized === original) return original;

  const sanitizedBeforeCursor = sanitizeAmountText(beforeCursor);
  input.value = sanitized;
  const nextCursor = Math.min(sanitizedBeforeCursor.length, sanitized.length);
  input.setSelectionRange(nextCursor, nextCursor);
  return sanitized;
}

function sanitizeAmountText(value: string): string {
  let result = '';
  let hasSeparator = false;
  let hasSign = false;
  for (const char of value.replace(/\s+/g, '')) {
    if (/\d/.test(char)) {
      result += char;
      continue;
    }
    if ((char === '.' || char === ',') && !hasSeparator) {
      result += char;
      hasSeparator = true;
      continue;
    }
    if (char === '-' && !hasSign && result.length === 0) {
      result += char;
      hasSign = true;
    }
  }
  return result;
}

function clearAmountValue(code: string, input: HTMLInputElement): void {
  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  converterError.textContent = '';
  delete values[code];
  input.value = '';
  input.title = '';
  input.classList.remove('amount-input-long', 'amount-input-xlong');
  setAmountFieldHasValue(input, false);
  if (editingCode === code) {
    input.focus();
  }
}

async function copyAmountValue(code: string, button: HTMLButtonElement): Promise<void> {
  const value = values[code];
  if (value === undefined) return;
  await copyText(formatCopyValue(value, code, settings.copy, settings.format));
  button.innerHTML = CHECK_SVG;
  button.classList.add('copy-success');
  window.setTimeout(() => {
    button.innerHTML = COPY_SVG;
    button.classList.remove('copy-success');
  }, 900);
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
  void setLastPopupAmount({ base, amount, updatedAt: Date.now() });

  if (pendingHistory && historySettings.enabled) {
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
    setInputDisplayValue(input, value);
  });
  isProgrammatic = false;
}

function setInputDisplayValue(input: HTMLInputElement, value: number | undefined): void {
  const text = value !== undefined ? formatNumber(value, settings.format) : '';
  input.value = text;
  input.title = text;
  input.classList.toggle('amount-input-long', text.length > 11);
  input.classList.toggle('amount-input-xlong', text.length > 15);
  setAmountFieldHasValue(input, text.length > 0);
}

function setAmountFieldHasValue(input: HTMLInputElement, hasValue: boolean): void {
  input.closest('.amount-field')?.classList.toggle('amount-field-has-value', hasValue);
}

function updateRatesLabel(response: ConvertResponse): void {
  const label = formatRateLabel(response.fetchedAt, response.date);
  ratesUpdated.textContent = '';
  ratesUpdated.setAttribute('aria-label', `Rates updated: ${label}`);

  const dot = document.createElement('span');
  dot.className = 'rate-dot';
  dot.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'rate-text';
  text.textContent = `Rates updated: ${label}`;

  ratesUpdated.append(dot, text);
}

function formatRateLabel(fetchedAt?: number, fallbackDate?: string): string {
  if (typeof fetchedAt === 'number') {
    const date = new Date(fetchedAt);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
  if (fallbackDate) {
    const parsed = new Date(fallbackDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
    return fallbackDate;
  }
  return '--';
}

function applyFeatureAvailability(): void {
  formatMax.max = '6';
  formatMin.max = '6';
  formatFixedSlider.max = '8';
  formatFixedDecimals.max = '8';
  formatFixedSlider.disabled = false;
  formatFixedDecimals.disabled = false;
  formatFixedDecimals.readOnly = false;

  copyDecimals.max = '8';
  copyDecimals.disabled = false;
  copyDecimals.readOnly = false;
  copyIncludeSymbol.disabled = false;

  groupsSection.classList.remove('hidden');
  clearHistoryBtn.disabled = false;
  historyEnabledToggle.disabled = false;
  historyMaxInput.disabled = false;
}

function renderGroups(): void {
  if (!favoritesGroups) {
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
      void setSettings({
        favoritesGroups: next,
        favorites: group.favorites,
        targets: group.favorites
      });
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
        favoritesGroups!.activeId === group.id
          ? (nextGroups[0]?.id ?? '')
          : favoritesGroups!.activeId;
      const next: FavoritesGroups = { activeId, groups: nextGroups };
      favoritesGroups = next;
      void setSettings({ favoritesGroups: next });
    });

    actions.append(useBtn, renameBtn, removeBtn);
    row.append(label, actions);
    groupsList.appendChild(row);
  });
}

function updateGroupsFromFavorites(
  groups: FavoritesGroups | null,
  nextFavorites: string[]
): FavoritesGroups {
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

async function renderHistory(): Promise<void> {
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
  if (!isSupportedCurrency(code)) return;
  if (favorites.includes(code)) return;
  replacingCode = null;
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
  if (replacingCode === code) {
    replacingCode = null;
  }
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
    renderCurrencyOptions(optionsContainer, query, onSelect);
  };

  searchInput.addEventListener('input', () => render(searchInput.value));
  render('');
}

function buildReplacePicker(codeToReplace: string): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'picker replace-picker';

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Replace with...';
  search.autocomplete = 'off';

  const options = document.createElement('div');
  options.className = 'picker-options';

  const render = (): void => {
    renderCurrencyOptions(
      options,
      search.value,
      (nextCode) => replaceFavorite(codeToReplace, nextCode),
      codeToReplace
    );
  };

  search.addEventListener('input', render);
  container.append(search, options);
  render();

  window.setTimeout(() => {
    search.focus();
    search.select();
  }, 0);

  return container;
}

function renderCurrencyOptions(
  optionsContainer: HTMLDivElement,
  query: string,
  onSelect: (code: string) => void,
  includeFavorite?: string
): void {
  const term = query.trim().toLowerCase();
  optionsContainer.innerHTML = '';
  SUPPORTED_CURRENCIES.forEach((code) => {
    if (favorites.includes(code) && code !== includeFavorite) return;
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
    if (code === includeFavorite) {
      option.classList.add('picker-option-current');
    }
    const optionLabel = document.createElement('span');
    const icon = document.createElement('span');
    icon.className = 'currency-mark';
    renderCurrencyIcon(icon, code);
    optionLabel.append(icon, document.createTextNode(` ${code}`));
    const optionName = document.createElement('span');
    optionName.textContent = name;
    option.append(optionLabel, optionName);
    option.addEventListener('click', () => onSelect(code));
    optionsContainer.appendChild(option);
  });
}

function replaceFavorite(codeToReplace: string, nextCode: string): void {
  if (!isSupportedCurrency(codeToReplace) || !isSupportedCurrency(nextCode)) return;
  if (codeToReplace === nextCode) {
    replacingCode = null;
    renderConverter();
    return;
  }
  if (!favorites.includes(codeToReplace) || favorites.includes(nextCode)) return;

  const nextFavorites = favorites.map((code) => (code === codeToReplace ? nextCode : code));
  const previousAmount = values[codeToReplace];
  delete values[codeToReplace];
  if (activeBase === codeToReplace) {
    activeBase = nextCode;
    editingCode = editingCode === codeToReplace ? nextCode : editingCode;
    if (previousAmount !== undefined) {
      values[nextCode] = previousAmount;
    }
  }

  favorites = normalizeCurrencyList(nextFavorites);
  const nextGroups = updateGroupsFromFavorites(favoritesGroups, favorites);
  favoritesGroups = nextGroups;
  replacingCode = null;
  void setSettings({
    baseCurrency: activeBase,
    favorites,
    targets: favorites,
    favoritesGroups: nextGroups
  });
  renderConverter();
  renderSettings();

  const amount = values[activeBase];
  if (amount !== undefined) {
    scheduleConvert(activeBase, amount);
  }
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

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

init().catch((error) => {
  console.error('Currency Hover popup init failed:', error);
});
