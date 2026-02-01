import { SUPPORTED_CURRENCIES } from '../shared/constants';
import { getSettings, onSettingsChanged } from '../shared/storage';
import { detectCurrencyFromText, extractFirstNumber } from '../shared/parser';
import { formatCurrencyParts } from '../shared/format';
import { sendMessage } from '../shared/runtime';
import { TooltipController } from './tooltip';
import { getSelectionInfo } from './selection';
import type { ConvertResponse } from '../background/messaging';

async function init(): Promise<void> {
  const tooltip = new TooltipController();
  let currentSettings = await getSettings();
  let requestSeq = 0;
  let lastSelection: { amount: number; rect: DOMRect } | null = null;
  let lastDetectedBase: string | null = null;
  let overrideBase: string | null = null;
  let overrideTargets: string[] | null = null;
  let activeBase = currentSettings.baseCurrency;
  let activeTargets = [...currentSettings.targets];

  tooltip.setTheme(currentSettings.theme);

  const handleSelection = async (): Promise<void> => {
    if (!currentSettings.enabled) return;

    const selectionInfo = getSelectionInfo();
    if (!selectionInfo) return;

    const parsed = extractFirstNumber(selectionInfo.text);
    if (!parsed) return;

    lastSelection = { amount: parsed.value, rect: selectionInfo.rect };
    lastDetectedBase = currentSettings.detectCurrency
      ? detectCurrencyFromText(selectionInfo.text)
      : null;
    overrideBase = null;
    overrideTargets = null;
    activeBase = lastDetectedBase ?? currentSettings.baseCurrency;
    activeTargets = [...currentSettings.targets];

    await convertAndRender();
  };

  const convertAndRender = async (): Promise<void> => {
    if (!lastSelection) return;
    const base = overrideBase ?? activeBase;
    const targets =
      (overrideTargets ?? activeTargets).length > 0
        ? [...(overrideTargets ?? activeTargets)]
        : [base];
    const compact = currentSettings.tooltip.compact;
    const baseParts = formatCurrencyParts(lastSelection.amount, base, compact);
    const controls = {
      baseAmount: baseParts.amount,
      baseSymbol: baseParts.symbol,
      baseCurrency: base,
      availableCurrencies: [...SUPPORTED_CURRENCIES],
      onBaseChange: (code: string) => {
        overrideBase = code;
        activeBase = code;
        void convertAndRender();
      },
      onTargetChange: (index: number, code: string) => {
        const next = [...targets];
        if (index >= next.length) {
          next.push(code);
        } else {
          next[index] = code;
        }
        overrideTargets = next;
        activeTargets = next;
        void convertAndRender();
      }
    };

    tooltip.show(
      lastSelection.rect,
      { type: 'loading', controls },
      currentSettings.tooltip.autoHideSeconds,
      compact
    );

    const requestId = ++requestSeq;

    let response: ConvertResponse;
    try {
      response = await sendMessage<ConvertResponse>({
        type: 'CONVERT',
        payload: {
          amount: lastSelection.amount,
          base,
          targets
        }
      });
    } catch (error) {
      if (requestId !== requestSeq) return;
      const message = error instanceof Error ? error.message : 'Unable to reach background.';
      tooltip.show(
        lastSelection.rect,
        { type: 'error', controls, message },
        currentSettings.tooltip.autoHideSeconds,
        compact
      );
      return;
    }

    if (requestId !== requestSeq) return;

    if (response.error && Object.keys(response.conversions).length === 0) {
      tooltip.show(
        lastSelection.rect,
        { type: 'error', controls, message: response.error },
        currentSettings.tooltip.autoHideSeconds,
        compact
      );
      return;
    }

    const conversions = targets.map((code) => {
      const value = response.conversions[code];
      if (typeof value !== 'number') {
        return { code, symbol: '', amount: '—', missing: true };
      }
      const parts = formatCurrencyParts(value, code, compact);
      return { code, symbol: parts.symbol, amount: parts.amount };
    });

    tooltip.show(
      lastSelection.rect,
      {
        type: 'ready',
        controls,
        conversions,
        rateDate: currentSettings.tooltip.showRateDate ? response.date : undefined,
        errorMessage: response.error
      },
      currentSettings.tooltip.autoHideSeconds,
      compact
    );
  };

  onSettingsChanged((next) => {
    currentSettings = next;
    tooltip.setTheme(currentSettings.theme);
    if (!overrideBase) {
      activeBase = currentSettings.baseCurrency;
    }
    if (!overrideTargets) {
      activeTargets = [...currentSettings.targets];
    }
    if (!currentSettings.enabled) {
      tooltip.hide();
    }
  });

  document.addEventListener('mouseup', (event) => {
    if (tooltip.contains(event.target)) return;
    void handleSelection();
  });
  document.addEventListener('keyup', (event) => {
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
      if (!tooltip.contains(event.target)) {
        tooltip.hide();
      }
    },
    true
  );

  document.addEventListener(
    'scroll',
    (event) => {
      if (tooltip.contains(event.target)) return;
      tooltip.hide();
    },
    true
  );
}

init().catch((error) => {
  console.error('Currency Hover init failed:', error);
});
