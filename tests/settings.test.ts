import { describe, expect, it } from 'vitest';
import { mergeSettings, sanitizeSettings, DEFAULT_SETTINGS } from '../src/shared/settings';

describe('settings migration', () => {
  it('wraps favorites into a default group when favoritesGroups missing', () => {
    const merged = mergeSettings({
      favorites: ['USD', 'UAH', 'EUR']
    });
    const sanitized = sanitizeSettings(merged);
    expect(sanitized.favoritesGroups.groups[0].favorites).toEqual(['USD', 'UAH', 'EUR']);
    expect(sanitized.favorites).toEqual(['USD', 'UAH', 'EUR']);
    expect(sanitized.favoritesGroups.activeId).toBe(sanitized.favoritesGroups.groups[0].id);
  });

  it('falls back to targets if favorites missing', () => {
    const merged = mergeSettings({
      targets: ['PLN', 'USD']
    });
    const sanitized = sanitizeSettings(merged);
    expect(sanitized.favoritesGroups.groups[0].favorites).toEqual(['PLN', 'USD']);
    expect(sanitized.favorites).toEqual(['PLN', 'USD']);
  });

  it('maps legacy format.copyMode into copy.mode', () => {
    const merged = mergeSettings({
      format: { ...DEFAULT_SETTINGS.format, copyMode: 'raw' }
    });
    const sanitized = sanitizeSettings(merged);
    expect(sanitized.copy.mode).toBe('raw');
  });
});
