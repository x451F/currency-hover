import { getCurrencyFlag } from '../shared/currencyMeta';
import { applyTheme, type ThemeSetting } from '../shared/theme';

interface TooltipControls {
  baseAmount: string;
  baseSymbol: string;
  baseCurrency: string;
  availableCurrencies: string[];
  onBaseChange: (code: string) => void;
  onTargetChange: (index: number, code: string) => void;
}

type TooltipState =
  | { type: 'loading'; controls: TooltipControls }
  | { type: 'error'; controls: TooltipControls; message: string }
  | {
      type: 'ready';
      controls: TooltipControls;
      conversions: Array<{ code: string; symbol: string; amount: string; missing?: boolean }>;
      rateLabel?: string;
      errorMessage?: string;
    };

export class TooltipController {
  private root: HTMLDivElement;
  private card: HTMLDivElement;
  private hideTimer: number | null = null;
  private autoHideMs = 0;
  private isHovered = false;
  private onHideCallback: (() => void) | null = null;
  private openIndex: number | null = null;
  private openBase = false;
  private lastState: TooltipState | null = null;
  private lastRect: DOMRect | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'ccx-tooltip-root';
    this.card = document.createElement('div');
    this.card.className = 'ccx-card';
    this.root.appendChild(this.card);
    document.documentElement.appendChild(this.root);

    this.root.addEventListener('mouseenter', () => {
      this.isHovered = true;
      this.clearHideTimer();
    });

    this.root.addEventListener('mouseleave', () => {
      this.isHovered = false;
      if (this.autoHideMs > 0) {
        this.scheduleHide();
      }
    });
  }

  setTheme(theme: ThemeSetting): void {
    applyTheme(this.root, theme);
  }

  setOnHide(callback: (() => void) | null): void {
    this.onHideCallback = callback;
  }

  show(rect: DOMRect, state: TooltipState, autoHideSeconds: number, compact: boolean): void {
    this.root.classList.toggle('ccx-compact', compact);
    this.lastState = state;
    this.lastRect = rect;
    this.autoHideMs = Math.max(0, autoHideSeconds * 1000);
    this.render(state);
    this.position(rect);
    this.root.classList.add('ccx-visible');

    this.clearHideTimer();
    if (!this.isHovered && this.autoHideMs > 0) {
      this.scheduleHide();
    }
  }

  hide(): void {
    this.root.classList.remove('ccx-visible');
    this.clearHideTimer();
    this.openIndex = null;
    this.openBase = false;
    if (this.onHideCallback) {
      this.onHideCallback();
    }
  }

  contains(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Node)) return false;
    return this.root.contains(target);
  }

  private render(state: TooltipState): void {
    this.card.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'ccx-header';

    const controls = state.controls;

    const amountRow = document.createElement('div');
    amountRow.className = 'ccx-amount-row';

    const amountWrap = document.createElement('div');
    amountWrap.className = 'ccx-amount-cell ccx-base-value';

    const symbol = document.createElement('span');
    symbol.className = 'ccx-symbol';
    symbol.textContent = controls.baseSymbol;

    const amount = document.createElement('span');
    amount.className = 'ccx-amount-text';
    amount.textContent = controls.baseAmount;

    amountWrap.append(symbol, amount);

    const baseButton = document.createElement('button');
    baseButton.type = 'button';
    baseButton.className = 'ccx-code-btn ccx-base-btn';
    baseButton.setAttribute('aria-expanded', this.openBase ? 'true' : 'false');

    const code = document.createElement('span');
    code.className = 'ccx-code';
    code.textContent = controls.baseCurrency;

    const caret = document.createElement('span');
    caret.className = 'ccx-caret';
    caret.textContent = '▾';

    baseButton.append(code, caret);
    baseButton.addEventListener('click', () => {
      this.toggleBaseDropdown();
    });

    const baseWrap = document.createElement('div');
    baseWrap.className = 'ccx-code-wrap';
    baseWrap.appendChild(baseButton);

    amountRow.append(amountWrap, baseWrap);
    header.appendChild(amountRow);

    if (this.openBase) {
      baseWrap.appendChild(
        this.buildDropdown(controls.baseCurrency, controls.availableCurrencies, (codeValue) => {
          this.openBase = false;
          controls.onBaseChange(codeValue);
        })
      );
    }

    if (state.type === 'ready' && state.rateLabel) {
      const subtitle = document.createElement('div');
      subtitle.className = 'ccx-subtitle';
      const dot = document.createElement('span');
      dot.className = 'ccx-live-dot';
      dot.textContent = '●';

      const text = document.createElement('span');
      text.textContent = state.rateLabel;

      subtitle.append(dot, text);
      header.appendChild(subtitle);
    }

    this.card.appendChild(header);

    if (state.type === 'loading') {
      const loading = document.createElement('div');
      loading.className = 'ccx-loading';
      loading.textContent = 'Converting...';
      this.card.appendChild(loading);
      return;
    }

    if (state.type === 'error') {
      const error = document.createElement('div');
      error.className = 'ccx-error';
      error.textContent = state.message;
      this.card.appendChild(error);
      return;
    }

    const list = document.createElement('div');
    list.className = 'ccx-list';
    state.conversions.forEach((row, index) => {
      const item = document.createElement('div');
      item.className = 'ccx-row';

      const amountWrap = document.createElement('div');
      amountWrap.className = row.missing ? 'ccx-amount-cell ccx-missing' : 'ccx-amount-cell';

      const symbol = document.createElement('span');
      symbol.className = 'ccx-symbol';
      symbol.textContent = row.symbol;

      const amount = document.createElement('span');
      amount.className = 'ccx-amount-text';
      amount.textContent = row.amount;

      amountWrap.append(symbol, amount);

      const codeButton = document.createElement('button');
      codeButton.type = 'button';
      codeButton.className = 'ccx-code-btn';
      codeButton.setAttribute('aria-expanded', this.openIndex === index ? 'true' : 'false');

      const code = document.createElement('span');
      code.className = 'ccx-code';
      code.textContent = row.code;

      const caret = document.createElement('span');
      caret.className = 'ccx-caret';
      caret.textContent = '▾';

      codeButton.append(code, caret);
      codeButton.addEventListener('click', () => {
        this.toggleDropdown(index);
      });

      const codeWrap = document.createElement('div');
      codeWrap.className = 'ccx-code-wrap';
      codeWrap.appendChild(codeButton);

      item.appendChild(amountWrap);
      item.appendChild(codeWrap);

      if (this.openIndex === index) {
        codeWrap.appendChild(
          this.buildDropdown(row.code, controls.availableCurrencies, (codeValue) => {
            this.openIndex = null;
            controls.onTargetChange(index, codeValue);
          })
        );
      }

      list.appendChild(item);
    });

    this.card.appendChild(list);

    if (state.errorMessage) {
      const error = document.createElement('div');
      error.className = 'ccx-error';
      error.textContent = state.errorMessage;
      this.card.appendChild(error);
    }
  }

  private position(rect: DOMRect): void {
    this.root.style.visibility = 'hidden';
    this.root.style.top = '0px';
    this.root.style.left = '0px';
    this.root.classList.add('ccx-visible');

    const { width, height } = this.card.getBoundingClientRect();
    const margin = 12;

    let top = rect.bottom + margin;
    let left = rect.left;

    if (top + height > window.innerHeight - margin) {
      top = rect.top - height - margin;
    }
    if (top < margin) {
      top = margin;
    }

    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }
    if (left < margin) {
      left = margin;
    }

    this.root.style.left = `${left}px`;
    this.root.style.top = `${top}px`;
    this.root.style.visibility = 'visible';
  }

  private toggleDropdown(index: number): void {
    this.openIndex = this.openIndex === index ? null : index;
    this.openBase = false;
    this.rerender();
  }

  private toggleBaseDropdown(): void {
    this.openBase = !this.openBase;
    this.openIndex = null;
    this.rerender();
  }

  private rerender(): void {
    if (!this.lastState || !this.lastRect) return;
    this.render(this.lastState);
    this.position(this.lastRect);
    this.root.classList.add('ccx-visible');
  }

  private scheduleHide(): void {
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => this.hide(), this.autoHideMs);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private buildDropdown(
    selected: string,
    options: string[],
    onSelect: (value: string) => void
  ): HTMLDivElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'ccx-dropdown';

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'ccx-search';
    search.placeholder = 'Пошук валюти...';

    const list = document.createElement('div');
    list.className = 'ccx-options';

    const renderOptions = (query: string): void => {
      list.innerHTML = '';
      const lower = query.trim().toLowerCase();
      options.forEach((code) => {
        if (lower && !code.toLowerCase().includes(lower)) {
          return;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ccx-option';
        if (code === selected) {
          button.classList.add('ccx-option-current');
        }

        const flag = document.createElement('span');
        flag.className = 'ccx-flag';
        flag.textContent = getCurrencyFlag(code);

        const label = document.createElement('span');
        label.className = 'ccx-code';
        label.textContent = code;

        button.append(flag, label);
        button.addEventListener('click', () => {
          onSelect(code);
        });
        list.appendChild(button);
      });
    };

    search.addEventListener('input', () => {
      renderOptions(search.value);
    });

    renderOptions('');
    dropdown.append(search, list);
    window.setTimeout(() => {
      search.focus();
      search.select();
    }, 0);
    return dropdown;
  }
}
