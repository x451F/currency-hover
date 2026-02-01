import { SUPPORTED_CURRENCIES } from '../shared/constants';
import { getCurrencyLabel } from '../shared/currencyMeta';
import { sendMessage } from '../shared/runtime';
import { getSettings, onSettingsChanged, setSettings } from '../shared/storage';
import { normalizeCurrencyCode, normalizeCurrencyList } from '../shared/settings';
import { applyTheme, type ThemeSetting } from '../shared/theme';
import type { RefreshResponse } from '../background/messaging';

const enabledEl = document.querySelector<HTMLInputElement>('#enabled')!;
const baseEl = document.querySelector<HTMLSelectElement>('#base')!;
const favoritesEl = document.querySelector<HTMLDivElement>('#favorites')!;
const addTargetInput = document.querySelector<HTMLInputElement>('#add-target')!;
const addTargetBtn = document.querySelector<HTMLButtonElement>('#add-target-btn')!;
const targetsEl = document.querySelector<HTMLSelectElement>('#targets')!;
const themeEl = document.querySelector<HTMLSelectElement>('#theme')!;
const refreshBtn = document.querySelector<HTMLButtonElement>('#refresh')!;
const optionsBtn = document.querySelector<HTMLButtonElement>('#open-options')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;

let currentBase = 'USD';
let currentTargets: string[] = [];
let currentFavorites: string[] = [];
const supportedSet = new Set(SUPPORTED_CURRENCIES);

function populateCurrencyOptions(): void {
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
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function syncTargetsSelection(targets: string[]): void {
  Array.from(targetsEl.options).forEach((option) => {
    option.selected = targets.includes(option.value);
  });
}

function renderFavorites(): void {
  favoritesEl.innerHTML = '';
  const list = currentFavorites.length ? currentFavorites : [];
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'status';
    empty.textContent = 'No favorites set yet.';
    favoritesEl.appendChild(empty);
    return;
  }

  list.forEach((code) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = getCurrencyLabel(code);
    if (currentTargets.includes(code)) {
      button.classList.add('chip-active');
    }
    button.addEventListener('click', () => void toggleTarget(code));
    favoritesEl.appendChild(button);
  });
}

async function toggleTarget(code: string): Promise<void> {
  const nextTargets = currentTargets.includes(code)
    ? currentTargets.filter((item) => item !== code)
    : normalizeCurrencyList([...currentTargets, code]);
  await setSettings({ targets: nextTargets });
  setStatus('Targets updated.');
}

async function init(): Promise<void> {
  populateCurrencyOptions();

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
    syncTargetsSelection(targets);
    setStatus('Base currency updated.');
  });

  targetsEl.addEventListener('change', async () => {
    const targets = normalizeCurrencyList(getSelectedValues(targetsEl));
    await setSettings({ targets });
    syncTargetsSelection(targets);
    setStatus('Targets updated.');
  });

  addTargetBtn.addEventListener('click', async () => {
    await handleAddTarget();
  });

  addTargetInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await handleAddTarget();
    }
  });

  themeEl.addEventListener('change', async () => {
    const theme = themeEl.value as ThemeSetting;
    await setSettings({ theme });
    applyTheme(document.documentElement, theme);
    setStatus('Theme updated.');
  });

  refreshBtn.addEventListener('click', async () => {
    setStatus('Refreshing rates...');
    try {
      const response = await sendMessage<RefreshResponse>({
        type: 'REFRESH_RATES',
        payload: { base: currentBase }
      });
      if (response.ok) {
        setStatus('Rates updated.');
      } else {
        setStatus(response.error ?? 'Unable to refresh rates.');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to refresh rates.');
    }
  });

  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
}

init().catch((error) => {
  console.error('Currency Hover popup init failed:', error);
});

function applySettings(settings: Awaited<ReturnType<typeof getSettings>>): void {
  enabledEl.checked = settings.enabled;
  currentBase = settings.baseCurrency;
  currentTargets = settings.targets;
  currentFavorites = settings.favorites;
  baseEl.value = settings.baseCurrency;
  syncTargetsSelection(settings.targets);
  renderFavorites();
  themeEl.value = settings.theme;
  applyTheme(document.documentElement, settings.theme);
}

function getSelectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

async function handleAddTarget(): Promise<void> {
  const raw = addTargetInput.value;
  const code = normalizeCurrencyCode(raw);
  if (!code) return;
  if (!supportedSet.has(code)) {
    setStatus('Unknown currency code. Use a supported ISO code.');
    return;
  }
  const nextTargets = normalizeCurrencyList([...currentTargets, code]);
  await setSettings({ targets: nextTargets });
  addTargetInput.value = '';
  setStatus('Target added.');
}
