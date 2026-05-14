import { renderCurrencyIcon } from '../shared/currencyIcon';
import { applyTheme, type ThemeSetting } from '../shared/theme';

const COPY_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="10" height="10" rx="2"></rect><rect x="5" y="5" width="10" height="10" rx="2"></rect></svg>';
const CHECK_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 13l4 4L19 7"></path></svg>';

interface TooltipControls {
  baseAmount: string;
  baseSymbol: string;
  baseCurrency: string;
  baseInputValue: string;
  baseCopyValue: string;
  availableBaseCurrencies: string[];
  availableTargetCurrencies: string[];
  onBaseChange: (code: string) => void;
  onTargetChange: (index: number, code: string) => void;
  onBaseEditStart: () => void;
  onBaseAmountInput: (raw: string) => void;
  onBaseAmountCommit: (raw: string) => void;
  onBaseAmountCancel: () => void;
}

type TooltipState =
  | { type: 'loading'; controls: TooltipControls }
  | { type: 'error'; controls: TooltipControls; message: string }
  | {
      type: 'ready';
      controls: TooltipControls;
      conversions: Array<{
        code: string;
        symbol: string;
        amount: string;
        copyValue: string;
        missing?: boolean;
      }>;
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
  private isEditingBase = false;
  private shouldSelectBaseInput = false;
  private baseEditValue = '';
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

  resetEditing(): void {
    this.isEditingBase = false;
    this.shouldSelectBaseInput = false;
    this.baseEditValue = '';
    this.openIndex = null;
    this.openBase = false;
  }

  show(rect: DOMRect, state: TooltipState, autoHideSeconds: number, compact: boolean): void {
    this.root.classList.toggle('ccx-compact', compact);
    this.lastState = state;
    this.lastRect = rect;
    this.autoHideMs = Math.max(0, autoHideSeconds * 1000);
    if (this.isEditingBase && state.type === 'ready' && this.card.firstElementChild) {
      this.updateReadyBodyDuringEdit(state);
    } else {
      this.render(state);
    }
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
    this.isEditingBase = false;
    this.shouldSelectBaseInput = false;
    this.baseEditValue = '';
    if (this.onHideCallback) {
      this.onHideCallback();
    }
  }

  contains(target: EventTarget | null): boolean {
    if (!target || !(target instanceof Node)) return false;
    return this.root.contains(target);
  }

  isEditing(): boolean {
    return this.isEditingBase;
  }

  commitBaseEdit(): void {
    if (!this.isEditingBase || !this.lastState) return;
    const value = this.baseEditValue;
    this.exitBaseEdit(false);
    this.lastState.controls.onBaseAmountCommit(value);
  }

  finishBaseEdit(): void {
    if (!this.isEditingBase) return;
    this.exitBaseEdit(false);
  }

  getBaseEditValue(): string {
    return this.baseEditValue;
  }

  cancelBaseEdit(): void {
    if (!this.isEditingBase || !this.lastState) return;
    this.exitBaseEdit(false);
    this.lastState.controls.onBaseAmountCancel();
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

    const amountContainer = document.createElement('div');
    amountContainer.className = 'ccx-amount-main';

    if (this.isEditingBase) {
      const input = document.createElement('input');
      input.type = 'text';
      input.inputMode = 'decimal';
      input.className = 'ccx-base-input';
      input.value = this.baseEditValue;

      input.addEventListener('input', () => {
        this.baseEditValue = input.value;
        controls.onBaseAmountInput(input.value);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          this.baseEditValue = input.value;
          this.commitBaseEdit();
        }
        if (event.key === 'Escape') {
          this.cancelBaseEdit();
        }
      });
      input.addEventListener('blur', () => {
        // Commit handled explicitly on Enter or outside click.
      });

      amountContainer.appendChild(input);
      window.setTimeout(() => {
        input.focus();
        if (this.shouldSelectBaseInput) {
          input.select();
          this.shouldSelectBaseInput = false;
        } else {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    } else {
      const amount = document.createElement('button');
      amount.type = 'button';
      amount.className = 'ccx-amount-text ccx-amount-editable';
      amount.textContent = controls.baseAmount;
      amount.addEventListener('click', () => {
        controls.onBaseEditStart();
        this.startBaseEdit(controls.baseInputValue);
      });
      amountContainer.appendChild(amount);
    }

    const baseCopy = this.buildCopyButton(controls.baseCopyValue, amountWrap);

    amountWrap.append(symbol, amountContainer, baseCopy);

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
    baseButton.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
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
        this.buildDropdown(controls.baseCurrency, controls.availableBaseCurrencies, (codeValue) => {
          this.openBase = false;
          controls.onBaseChange(codeValue);
        })
      );
    }

    if (state.type === 'ready' && state.rateLabel) {
      header.appendChild(this.buildRateSubtitle(state.rateLabel));
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

    this.appendReadyBody(state);
  }

  private updateReadyBodyDuringEdit(state: Extract<TooltipState, { type: 'ready' }>): void {
    const header = this.card.firstElementChild;
    if (!(header instanceof HTMLElement)) {
      this.render(state);
      return;
    }

    header.querySelector('.ccx-subtitle')?.remove();
    if (state.rateLabel) {
      header.appendChild(this.buildRateSubtitle(state.rateLabel));
    }

    while (this.card.children.length > 1) {
      this.card.lastElementChild?.remove();
    }
    this.appendReadyBody(state);
  }

  private appendReadyBody(state: Extract<TooltipState, { type: 'ready' }>): void {
    const controls = state.controls;
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

      const amountContainer = document.createElement('div');
      amountContainer.className = 'ccx-amount-main';
      amountContainer.append(amount);

      const copyBtn = this.buildCopyButton(row.copyValue, item);

      amountWrap.append(symbol, amountContainer, copyBtn);

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
      codeButton.addEventListener('mousedown', (event) => {
        event.stopPropagation();
      });
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
          this.buildDropdown(row.code, controls.availableTargetCurrencies, (codeValue) => {
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

  private buildRateSubtitle(rateLabel: string): HTMLDivElement {
    const subtitle = document.createElement('div');
    subtitle.className = 'ccx-subtitle';
    const dot = document.createElement('span');
    dot.className = 'ccx-live-dot';
    dot.textContent = '●';

    const text = document.createElement('span');
    text.textContent = rateLabel;

    subtitle.append(dot, text);
    return subtitle;
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
    if (this.isEditingBase) return;
    this.openIndex = this.openIndex === index ? null : index;
    this.openBase = false;
    this.rerender();
  }

  private toggleBaseDropdown(): void {
    if (this.isEditingBase) return;
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

  private startBaseEdit(value: string): void {
    this.isEditingBase = true;
    this.shouldSelectBaseInput = true;
    this.baseEditValue = value;
    this.rerender();
  }

  private exitBaseEdit(shouldRerender: boolean): void {
    this.isEditingBase = false;
    this.shouldSelectBaseInput = false;
    this.baseEditValue = '';
    if (shouldRerender) {
      this.rerender();
    }
  }

  private buildCopyButton(text: string, highlightEl: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ccx-copy-btn';
    button.setAttribute('aria-label', 'Copy amount');
    button.innerHTML = COPY_SVG;
    if (!text) {
      button.disabled = true;
    }

    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (!text) return;
      await this.copyText(text);
      this.showCopied(button, highlightEl);
    });
    button.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });

    return button;
  }

  private showCopied(button: HTMLButtonElement, highlightEl: HTMLElement): void {
    button.innerHTML = CHECK_SVG;
    button.classList.add('ccx-copy-success');
    highlightEl.classList.add('ccx-copied');
    window.setTimeout(() => {
      button.innerHTML = COPY_SVG;
      button.classList.remove('ccx-copy-success');
      highlightEl.classList.remove('ccx-copied');
    }, 900);
  }

  private async copyText(text: string): Promise<void> {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // ignore and fallback
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
        renderCurrencyIcon(flag, code);

        const label = document.createElement('span');
        label.className = 'ccx-code';
        label.textContent = code;

        button.append(flag, label);
        button.addEventListener('mousedown', (event) => {
          event.stopPropagation();
        });
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
