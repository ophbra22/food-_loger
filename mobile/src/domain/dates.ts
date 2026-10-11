/** Journal days are calendar dates in the phone's own time zone, as `YYYY-MM-DD`. */

const pad = (value: number) => String(value).padStart(2, '0');

export const toIsoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayIso = (now: Date = new Date()) => toIsoDay(now);

export function parseIsoDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  // Noon avoids daylight-saving edges when stepping between days.
  return new Date(year, month - 1, date, 12, 0, 0, 0);
}

export const isIsoDay = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  toIsoDay(parseIsoDay(value)) === value;

export function addDays(day: string, amount: number): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() + amount);
  return toIsoDay(date);
}

/** Whole days from `today` to `day`: 0 today, -1 yesterday, 1 tomorrow. */
export function dayOffset(day: string, today: string = todayIso()): number {
  const ms = parseIsoDay(day).getTime() - parseIsoDay(today).getTime();
  return Math.round(ms / 86_400_000);
}
