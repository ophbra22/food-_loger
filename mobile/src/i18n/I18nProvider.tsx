import { getLocales } from 'expo-localization';
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

import { globalKey, readJson, writeJson } from '@/storage/kv';

import { DirectionResult, ensureDirection } from './direction';
import { Language, LANGUAGES, TKey, TParams, isRtlLanguage, languageForDevice, translate } from './translate';

const LANGUAGE_KEY = globalKey('language');

/** The saved choice, or the phone's language on first launch. */
export async function loadInitialLanguage(): Promise<Language> {
  const saved = await readJson<Language>(LANGUAGE_KEY);
  if (saved && LANGUAGES.includes(saved)) return saved;
  return languageForDevice(getLocales()[0]?.languageCode);
}

type I18nValue = {
  language: Language;
  isRTL: boolean;
  t: (key: TKey, params?: TParams) => string;
  /** Saves the choice and switches. Resolves to what happened to the layout direction. */
  setLanguage: (language: Language) => Promise<DirectionResult>;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initial, children }: { initial: Language; children: ReactNode }) {
  const [language, setCurrent] = useState<Language>(initial);

  const setLanguage = useCallback(async (next: Language) => {
    await writeJson(LANGUAGE_KEY, next);
    const result = await ensureDirection(next);
    // When the app reloads, the new language is read from storage on the way back up.
    if (result !== 'reloading') setCurrent(next);
    return result;
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      isRTL: isRtlLanguage(language),
      t: (key, params) => translate(language, key, params),
      setLanguage,
    }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
