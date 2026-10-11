/**
 * Layout direction follows the app language, not the phone language:
 * Hebrew is right-to-left, English is left-to-right.
 *
 * React Native reads the direction once at start-up, so a change needs one reload.
 * Drafts are on disk before that, so nothing typed is lost.
 */
import { reloadAppAsync } from 'expo';
import { I18nManager, Platform } from 'react-native';

import { globalKey, readJson, remove, writeJson } from '@/storage/kv';

import { Language, isRtlLanguage } from './translate';

const ATTEMPTS_KEY = globalKey('direction-attempts');
type Attempts = { rtl: boolean; count: number };

export const directionMatches = (language: Language) =>
  Platform.OS === 'web' || I18nManager.isRTL === isRtlLanguage(language);

export type DirectionResult = 'ok' | 'reloading' | 'restart-needed';

/**
 * Make the native layout direction match `language`. Reloads the app when it has
 * to change; if reloading did not take effect (some Android versions only apply
 * it on a cold start) it reports `restart-needed` instead of looping.
 */
export async function ensureDirection(language: Language): Promise<DirectionResult> {
  if (directionMatches(language)) {
    await remove(ATTEMPTS_KEY);
    return 'ok';
  }
  const rtl = isRtlLanguage(language);
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  const previous = await readJson<Attempts>(ATTEMPTS_KEY);
  const count = previous && previous.rtl === rtl ? previous.count : 0;
  if (count >= 1) return 'restart-needed';
  await writeJson(ATTEMPTS_KEY, { rtl, count: count + 1 } satisfies Attempts);
  try {
    await reloadAppAsync('Language direction changed');
    return 'reloading';
  } catch {
    return 'restart-needed';
  }
}
