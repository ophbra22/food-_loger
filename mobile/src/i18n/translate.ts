import { Dictionary, Plural, en } from './locales/en';
import { he } from './locales/he';

export type Language = 'en' | 'he';
export const LANGUAGES: readonly Language[] = ['en', 'he'];
export const dictionaries: Record<Language, Dictionary> = { en, he };

type Leaf = string | Plural;
type Paths<T> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];

/** Every valid translation key, for example `review.save`. */
export type TKey = Paths<Dictionary>;
export type TParams = Record<string, string | number>;

function lookup(dictionary: Dictionary, key: string): Leaf | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || isPlural(node) ? (node as Leaf) : undefined;
}

const isPlural = (value: unknown): value is Plural =>
  typeof value === 'object' && value !== null && 'other' in value && 'one' in value;

function pluralForm(forms: Plural, count: number): string {
  if (count === 1) return forms.one;
  if (count === 2 && forms.two) return forms.two;
  return forms.other;
}

/**
 * Translate a key. `{{name}}` placeholders are filled from `params`; a plural
 * entry is chosen by `params.count`. Falls back to English, then to the key.
 */
export function translate(language: Language, key: TKey, params?: TParams): string {
  const entry = lookup(dictionaries[language], key) ?? lookup(en, key);
  if (entry === undefined) return key;
  const template =
    typeof entry === 'string' ? entry : pluralForm(entry, Number(params?.count ?? 0));
  if (!params) return template;
  const rtl = isRtlLanguage(language);
  const filled = template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (!(name in params)) return match;
    const value = String(params[name]);
    // A product name or a barcode inside a Hebrew sentence keeps its own direction
    // (first-strong isolate) without dragging the punctuation around it.
    return rtl ? `\u2068${value}\u2069` : value;
  });
  // The mark keeps the sentence right-to-left even when it starts with a Latin name.
  return rtl ? `\u200f${filled}` : filled;
}

/** Remove invisible direction marks, for comparing or logging text. */
export const stripDirectionMarks = (text: string) =>
  text.replace(/[\u200e\u200f\u2066-\u2069]/g, '');

/** Hebrew is offered when it is the phone's first language; everyone else starts in English. */
export function languageForDevice(languageCode: string | null | undefined): Language {
  const code = (languageCode ?? '').toLowerCase();
  // "iw" is the legacy code some Android versions still report for Hebrew.
  return code === 'he' || code === 'iw' ? 'he' : 'en';
}

export const isRtlLanguage = (language: Language) => language === 'he';

/** Name of a catalog food in the chosen language, or the server's name for unknown ids. */
export function foodName(language: Language, foodId: string, fallback: string): string {
  const names = dictionaries[language].foods as Record<string, string>;
  return names[foodId] ?? fallback;
}
