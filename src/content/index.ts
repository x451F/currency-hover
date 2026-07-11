import { SUPPORTED_CURRENCIES } from '../shared/constants';
import { addHistoryEntry, getHistorySettings, getSettings, onSettingsChanged, setSettings } from '../shared/storage';
import { detectCurrencyFromText, extractFirstNumber, shouldTriggerSelection } from '../shared/parser';
import { formatCopyValue, formatCurrencyParts, normalizedFixed } from '../shared/format';
import { sendMessage } from '../shared/runtime';
import { TooltipController } from './tooltip';
import { getSelectionInfo } from './selection';
import type { ConvertResponse } from '../background/messaging';
import { normalizeCurrencyList, type FavoritesGroups } from '../shared/settings';
import { HISTORY_SETTINGS_KEY } from '../shared/constants';
import { addStorageChangedListener } from '../shared/extensionApi';
import { debugLog, debugWarn } from '../shared/debug';

async function init(): Promise<void> {
  debugLog('content', 'init start', { url: window.location.href });
  const tooltip = new TooltipController();
  let currentSettings = await getSettings();
  debugLog('content', 'settings loaded', currentSettings);
  let requestSeq = 0;
  let lastSelection: { amount: number; rect: DOMRect } | null = null;
  let overrideBase: string | null = null;
  let activeBase = currentSettings.baseCurrency;
  let activeFavorites = getEffectiveFavorites(currentSettings);
  let activeTargets = getTargets(activeBase, activeFavorites);
  let refreshTimer: number | null = null;
  let editConvertTimer: number | null = null;
  let tooltipVisible = false;
  let currentAmount = 0;
  let editStartAmount: number | null = null;
  let historySettings = await getHistorySettings();
  debugLog('content', 'history settings loaded', historySettings);
  let shouldLogHistory = false;
  let suppressSelection = false;

  tooltip.setTheme(currentSettings.theme);
  tooltip.setOnHide(() => {
    tooltipVisible = false;
    clearRefresh();
    clearEditConvert();
    lastSelection = null;
    overrideBase = null;
    editStartAmount = null;
    shouldLogHistory = false;
  });

  const handleSelection = async (): Promise<void> => {
    debugLog('selection', 'selection event');
    if (!currentSettings.enabled) {
      debugLog('selection', 'ignored: extension disabled');
      return;
    }

    const selectionInfo = getSelectionInfo();
    if (!selectionInfo) {
      debugLog('selection', 'ignored: no selection info');
      return;
    }
    debugLog('selection', 'text', selectionInfo.text);

    if (!shouldTriggerSelection(selectionInfo.text)) {
      debugLog('selection', 'ignored: trigger rules did not match');
      return;
    }

    const parsed = extractFirstNumber(selectionInfo.text);
    if (!parsed) {
      debugLog('selection', 'ignored: no parsed number');
      return;
    }
    debugLog('selection', 'parsed', parsed);

    tooltip.resetEditing();
    lastSelection = { amount: parsed.value, rect: selectionInfo.rect };
    currentAmount = parsed.value;
    editStartAmount = null;
    const detectedBase = currentSettings.detectCurrency
      ? detectCurrencyFromText(selectionInfo.text)
      : null;
    overrideBase = null;
    activeFavorites = getEffectiveFavorites(currentSettings);
    activeBase = detectedBase ?? currentSettings.baseCurrency;
    activeTargets = getTargets(activeBase, activeFavorites);
    shouldLogHistory = true;
    debugLog('selection', 'convert requested', { amount: currentAmount, activeBase, activeTargets });

    await convertAndRender();
    scheduleRefresh();
  };

  const convertAndRender = async (
    forceRefresh = false,
    options: { allowEditing?: boolean; showLoading?: boolean } = {}
  ): Promise<void> => {
    if (!lastSelection) return;
    if (tooltip.isEditing() && !options.allowEditing) {
      debugLog('convert', 'skipped: tooltip is editing');
      return;
    }
    const base = overrideBase ?? activeBase;
    const targets = activeTargets.length > 0 ? [...activeTargets] : [];
    const formatSettings = currentSettings.format;
    const baseParts = formatCurrencyParts(currentAmount, base, formatSettings);
    const baseCopyValue = formatCopyValue(currentAmount, base, currentSettings.copy, formatSettings);
    const availableCurrencies = [...SUPPORTED_CURRENCIES];
    const commitBaseAmount = (raw: string, shouldRender: boolean): void => {
      clearEditConvert();
      const parsed = parseInput(raw);
      if (parsed !== null) {
        currentAmount = parsed;
        shouldLogHistory = true;
        if (shouldRender) {
          void convertAndRender();
        }
      } else if (editStartAmount !== null) {
        currentAmount = editStartAmount;
        if (shouldRender) {
          void convertAndRender();
        }
      }
      editStartAmount = null;
    };
    const controls = {
      baseAmount: baseParts.amount,
      baseSymbol: baseParts.symbol,
      baseCurrency: base,
      baseInputValue: normalizedFixed(currentAmount, getEditDecimals(currentSettings)),
      baseCopyValue,
      availableBaseCurrencies: availableCurrencies,
      availableTargetCurrencies: availableCurrencies.filter((code) => code !== base),
      onBaseChange: (code: string) => {
        overrideBase = code;
        activeBase = code;
        activeTargets = getTargets(activeBase, activeFavorites);
        void setSettings({ baseCurrency: code, targets: activeFavorites });
        shouldLogHistory = true;
        void convertAndRender();
      },
      onTargetChange: (index: number, code: string) => {
        const nextTargets = [...targets];
        if (index >= nextTargets.length) {
          nextTargets.push(code);
        } else {
          nextTargets[index] = code;
        }
        const nextFavorites = updateFavoritesFromTargets(activeBase, activeFavorites, nextTargets);
        const nextGroups = updateGroupsFromFavorites(currentSettings.favoritesGroups, nextFavorites);
        activeFavorites = nextFavorites;
        activeTargets = getTargets(activeBase, activeFavorites);
        void setSettings({ favorites: nextFavorites, targets: nextFavorites, favoritesGroups: nextGroups });
        void convertAndRender();
      },
      onBaseEditStart: () => {
        editStartAmount = currentAmount;
        shouldLogHistory = false;
      },
      onBaseAmountInput: (raw: string) => {
        shouldLogHistory = false;
        const parsed = parseInput(raw);
        if (parsed === null) return;
        currentAmount = parsed;
        scheduleEditConvert();
      },
      onBaseAmountCommit: (raw: string) => {
        commitBaseAmount(raw, true);
      },
      onBaseAmountCancel: () => {
        clearEditConvert();
        if (editStartAmount !== null) {
          currentAmount = editStartAmount;
          void convertAndRender();
        }
        editStartAmount = null;
      }
    };

    if (options.showLoading !== false) {
      tooltip.show(
        lastSelection.rect,
        { type: 'loading', controls },
        currentSettings.tooltip.autoHideSeconds,
        currentSettings.format.compact
      );
      tooltipVisible = true;
    }

    const requestId = ++requestSeq;
    const requestTargets = targets.length > 0 ? targets : [base];

    let response: ConvertResponse;
    try {
      debugLog('convert', 'send message', {
        amount: currentAmount,
        base,
        targets: requestTargets,
        forceRefresh
      });
      const maybeResponse = await sendMessage<unknown>({
        type: 'CONVERT',
        payload: {
          amount: currentAmount,
          base,
          targets: requestTargets,
          forceRefresh
        }
      });
      if (!isConvertResponse(maybeResponse)) {
        debugWarn('convert', 'invalid response', maybeResponse);
        throw new Error('Invalid background response.');
      }
      response = maybeResponse;
      debugLog('convert', 'response', response);
    } catch (error) {
      if (requestId !== requestSeq) return;
      debugWarn('convert', 'failed', error);
      const message = error instanceof Error ? error.message : 'Unable to reach background.';
      tooltip.show(
        lastSelection.rect,
        { type: 'error', controls, message },
        currentSettings.tooltip.autoHideSeconds,
        currentSettings.format.compact
      );
      return;
    }

    if (requestId !== requestSeq) return;

    if (response.error && Object.keys(response.conversions).length === 0) {
      tooltip.show(
        lastSelection.rect,
        { type: 'error', controls, message: response.error },
        currentSettings.tooltip.autoHideSeconds,
        currentSettings.format.compact
      );
      return;
    }

    if (shouldLogHistory && historySettings.enabled) {
      shouldLogHistory = false;
      await addHistoryEntry(
        {
          ts: Date.now(),
          base,
          amount: currentAmount,
          favoritesSnapshot: [...activeFavorites],
          conversions: response.conversions
        },
        historySettings.maxItems
      );
    }

    const conversions = targets.map((code) => {
      const value = response.conversions[code];
      if (typeof value !== 'number') {
        return { code, symbol: '', amount: '—', copyValue: '', missing: true };
      }
      const parts = formatCurrencyParts(value, code, formatSettings);
      return {
        code,
        symbol: parts.symbol,
        amount: parts.amount,
        copyValue: formatCopyValue(value, code, currentSettings.copy, formatSettings)
      };
    });

    const rateLabel = currentSettings.tooltip.showRateDate
      ? formatRateLabel(response.fetchedAt, response.date)
      : undefined;

    tooltip.show(
      lastSelection.rect,
      {
        type: 'ready',
        controls,
        conversions,
        rateLabel,
        errorMessage: response.error
      },
      currentSettings.tooltip.autoHideSeconds,
      currentSettings.format.compact
    );
    tooltipVisible = true;
  };

  onSettingsChanged((next) => {
    currentSettings = next;
    tooltip.setTheme(currentSettings.theme);
    if (!overrideBase) {
      activeBase = currentSettings.baseCurrency;
    }
    activeFavorites = getEffectiveFavorites(currentSettings);
    activeTargets = getTargets(activeBase, activeFavorites);
    scheduleRefresh();
    if (tooltipVisible) {
      if (!tooltip.isEditing()) {
        void convertAndRender();
      }
    }
    if (!currentSettings.enabled) {
      tooltip.hide();
    }
  });

  addStorageChangedListener((changes, area) => {
    if (area !== 'local' || !changes[HISTORY_SETTINGS_KEY]) return;
    const next = changes[HISTORY_SETTINGS_KEY].newValue as typeof historySettings | undefined;
    if (next) {
      historySettings = next;
    }
  });

  document.addEventListener('mouseup', (event) => {
    if (tooltip.isEditing()) return;
    if (suppressSelection) {
      suppressSelection = false;
      return;
    }
    if (tooltip.contains(event.target)) return;
    void handleSelection();
  });
  document.addEventListener('keyup', (event) => {
    if (tooltip.isEditing()) return;
    if (suppressSelection) {
      suppressSelection = false;
      return;
    }
    if (event.key === 'Escape') {
      tooltip.hide();
      return;
    }
    if (tooltip.contains(event.target)) return;
    void handleSelection();
  });

  document.addEventListener(
    'mousedown',
    (event) => {
      if (tooltip.isEditing()) {
        const target = event.target instanceof Element ? event.target : null;
        const isBaseInput = Boolean(target?.closest('.ccx-base-input'));
        if (isBaseInput) return;

        const raw = tooltip.getBaseEditValue();
        tooltip.finishBaseEdit();
        clearEditConvert();
        const clickedCurrencyControl = Boolean(target?.closest('.ccx-code-btn, .ccx-option'));

        if (tooltip.contains(event.target)) {
          const parsed = parseInput(raw);
          if (parsed !== null) {
            currentAmount = parsed;
            shouldLogHistory = true;
          } else if (editStartAmount !== null) {
            currentAmount = editStartAmount;
          }
          editStartAmount = null;
          if (!clickedCurrencyControl) {
            void convertAndRender();
          }
        } else {
          const parsed = parseInput(raw);
          if (parsed !== null) {
            currentAmount = parsed;
            shouldLogHistory = true;
            void convertAndRender();
          } else if (editStartAmount !== null) {
            currentAmount = editStartAmount;
            void convertAndRender();
          }
          editStartAmount = null;
          suppressSelection = true;
          window.setTimeout(() => {
            suppressSelection = false;
          }, 0);
        }
        return;
      }
      if (!tooltip.contains(event.target)) {
        tooltip.hide();
      }
    },
    true
  );

  document.addEventListener(
    'scroll',
    (event) => {
      if (tooltip.isEditing()) return;
      if (tooltip.contains(event.target)) return;
      tooltip.hide();
    },
    true
  );

  function scheduleRefresh(): void {
    clearRefresh();
    if (!currentSettings.enabled || !lastSelection || !tooltipVisible) return;
    const refreshMs = Math.max(30, currentSettings.tooltip.refreshSeconds) * 1000;
    refreshTimer = window.setTimeout(() => {
      if (tooltip.isEditing()) {
        scheduleRefresh();
        return;
      }
      void convertAndRender(true).finally(() => scheduleRefresh());
    }, refreshMs);
  }

  function clearRefresh(): void {
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function scheduleEditConvert(): void {
    clearEditConvert();
    editConvertTimer = window.setTimeout(() => {
      void convertAndRender(false, { allowEditing: true, showLoading: false });
    }, 250);
  }

  function clearEditConvert(): void {
    if (editConvertTimer) {
      window.clearTimeout(editConvertTimer);
      editConvertTimer = null;
    }
  }

  function formatRateLabel(fetchedAt?: number, fallbackDate?: string): string | undefined {
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
    }
    return fallbackDate;
  }

  function parseInput(raw: string): number | null {
    const parsed = extractFirstNumber(raw);
    return parsed ? parsed.value : null;
  }

  function getEditDecimals(settings: typeof currentSettings): number {
    const value =
      settings.format.mode === 'fixed' ? settings.format.fixedDecimals : settings.copy.decimals;
    if (!Number.isFinite(value)) return 2;
    return Math.min(8, Math.max(0, Math.round(value)));
  }

  function getEffectiveFavorites(settings: typeof currentSettings): string[] {
    if (settings.favoritesGroups?.groups?.length) {
      const activeGroup = settings.favoritesGroups.groups.find(
        (group) => group.id === settings.favoritesGroups.activeId
      );
      if (activeGroup?.favorites?.length) {
        const normalized = normalizeCurrencyList(activeGroup.favorites);
        return normalized;
      }
    }
    const fallback =
      settings.favorites === undefined && Array.isArray(settings.targets) && settings.targets.length > 0
        ? normalizeCurrencyList(settings.targets)
        : ['EUR', 'USD', 'UAH', 'PLN'];
    const filteredFallback = fallback;
    void setSettings({ favorites: filteredFallback, targets: filteredFallback });
    if (settings.favorites === undefined && Array.isArray(settings.targets)) {
      return filteredFallback;
    }
    return filteredFallback;
  }

  function getTargets(base: string, favorites: string[]): string[] {
    const filtered = favorites.filter((code) => code !== base);
    return filtered.length ? filtered : favorites.filter((code) => code !== base);
  }

  function updateFavoritesFromTargets(base: string, favorites: string[], targets: string[]): string[] {
    const baseIncluded = favorites.includes(base);
    const next = baseIncluded ? [base, ...targets] : targets;
    return normalizeCurrencyList(next);
  }

function updateGroupsFromFavorites(groups: FavoritesGroups, favorites: string[]): FavoritesGroups {
    const nextGroups = groups?.groups?.length ? [...groups.groups] : [];
    if (!nextGroups.length) {
      return {
        activeId: 'default',
        groups: [
          {
            id: 'default',
            name: 'Default',
            favorites
          }
        ]
      };
    }
    const activeIndex = nextGroups.findIndex((group) => group.id === groups.activeId);
    const index = activeIndex >= 0 ? activeIndex : 0;
    const active = nextGroups[index];
    nextGroups[index] = {
      ...active,
      favorites
    };
    return {
      activeId: nextGroups[index].id,
      groups: nextGroups
    };
  }

}

function isConvertResponse(value: unknown): value is ConvertResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<ConvertResponse>;
  return typeof response.base === 'string' && Boolean(response.conversions) && typeof response.conversions === 'object';
}

init().catch((error) => {
  console.error('Currency Hover init failed:', error);
});
