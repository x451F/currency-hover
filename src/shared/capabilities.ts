import type { Settings } from './settings';

export type ProFeature =
  | 'formatting-advanced'
  | 'history'
  | 'favorites-groups'
  | 'crypto'
  | 'copy-advanced';

export function isPro(settings: Settings): boolean {
  return Boolean(settings.entitlements?.pro);
}

export function hasFeature(settings: Settings, feature: ProFeature): boolean {
  if (feature === 'formatting-advanced') {
    return isPro(settings);
  }
  if (feature === 'history') {
    return isPro(settings);
  }
  if (feature === 'favorites-groups') {
    return isPro(settings);
  }
  if (feature === 'crypto') {
    return isPro(settings);
  }
  if (feature === 'copy-advanced') {
    return isPro(settings);
  }
  return false;
}
