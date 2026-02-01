export type ThemeSetting = 'system' | 'light' | 'dark';

export function isThemeSetting(value: unknown): value is ThemeSetting {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function normalizeTheme(value: unknown): ThemeSetting {
  return isThemeSetting(value) ? value : 'system';
}

export function applyTheme(root: HTMLElement, theme: ThemeSetting): void {
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    return;
  }
  root.setAttribute('data-theme', theme);
}
