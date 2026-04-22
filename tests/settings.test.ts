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

  it('filters unsupported currencies and falls back from invalid base', () => {
    const merged = mergeSettings({
      baseCurrency: 'XXX',
      targets: ['EUR', 'BAD', 'usd'],
      favorites: ['NOPE', 'PLN']
    });
    const sanitized = sanitizeSettings(merged);
    expect(sanitized.baseCurrency).toBe(DEFAULT_SETTINGS.baseCurrency);
    expect(sanitized.targets).toEqual(['EUR', 'USD']);
    expect(sanitized.favorites).toEqual(['PLN']);
  });

  it('drops legacy entitlement data', () => {
    const merged = mergeSettings({
      entitlements: { pro: true, source: 'manual', updatedAt: Date.now() }
    } as Parameters<typeof mergeSettings>[0]);
    const sanitized = sanitizeSettings(merged);
    expect('entitlements' in sanitized).toBe(false);
  });
});
