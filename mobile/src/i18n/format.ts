/**
 * Numbers, dates and units for the chosen app language (not the phone's region),
 * so a Hebrew screen never shows an English month name and the other way round.
 */
import { dayOffset, parseIsoDay } from '@/domain/dates';
import type { BasisUnit } from '@/domain/nutrition';

import { Language, translate } from './translate';

const LOCALE: Record<Language, string> = { en: 'en-US', he: 'he-IL' };
export const localeTag = (language: Language) => LOCALE[language];

/** Left-to-right isolate: keeps codes, barcodes and addresses intact inside Hebrew text. */
export const ltr = (text: string) => `⁦${text}⁩`;

export function formatNumber(language: Language, value: number | null, maxFractionDigits = 0): string {
  if (value === null) return translate(language, 'review.notProvided');
  return new Intl.NumberFormat(LOCALE[language], {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

/** A stored value, or the "not provided" text. Zero is a real value and is shown as 0. */
export function formatOptional(
  language: Language,
  value: number | null | undefined,
  maxFractionDigits = 1,
): string {
  return value == null
    ? translate(language, 'review.notProvided')
    : formatNumber(language, value, maxFractionDigits);
}

export const unitLabel = (language: Language, unit: BasisUnit | 'kcal') =>
  translate(language, `units.${unit}`);

/** "150 g", "12.5 ml", "320 kcal". The number always comes first, in both languages. */
export function formatQuantity(
  language: Language,
  value: number | null,
  unit: BasisUnit | 'kcal',
  maxFractionDigits = 1,
): string {
  if (value === null) return translate(language, 'review.notProvided');
  return `${formatNumber(language, value, maxFractionDigits)} ${unitLabel(language, unit)}`;
}

/** "Today", "Yesterday", "Tomorrow" or the weekday name. */
export function relativeDayLabel(language: Language, day: string, today?: string): string {
  const offset = dayOffset(day, today);
  if (offset === 0) return translate(language, 'dates.today');
  if (offset === -1) return translate(language, 'dates.yesterday');
  if (offset === 1) return translate(language, 'dates.tomorrow');
  return new Intl.DateTimeFormat(LOCALE[language], { weekday: 'long' }).format(parseIsoDay(day));
}

/** "October 11" / "11 באוקטובר"; the year is added when it is not the current one. */
export function formatDay(language: Language, day: string, today?: string): string {
  const date = parseIsoDay(day);
  const sameYear = date.getFullYear() === (today ? parseIsoDay(today) : new Date()).getFullYear();
  return new Intl.DateTimeFormat(LOCALE[language], {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function formatFullDay(language: Language, day: string): string {
  return new Intl.DateTimeFormat(LOCALE[language], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseIsoDay(day));
}

/** Clock time of a server timestamp, in the phone's time zone. */
export function formatTime(language: Language, timestamp: string | number, timeZone?: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE[language], { hour: '2-digit', minute: '2-digit', ...(timeZone ? {timeZone} : {}) }).format(
    date,
  );
}

export const formatList = (language: Language, items: string[]) =>
  items.join(language === 'he' ? ', ' : ', ');
