import {
  formatDay,
  formatNumber,
  formatOptional,
  formatQuantity,
  ltr,
  relativeDayLabel,
} from '../format';
import { en } from '../locales/en';
import { he } from '../locales/he';
import { foodName, languageForDevice, translate } from '../translate';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') result[path] = value;
    else Object.assign(result, leaves(value, path));
  }
  return result;
}
const placeholders = (text: string) => (text.match(/\{\{\w+\}\}/g) ?? []).sort();
// Hebrew has an extra "two" plural form; everything else must line up.
const comparable = (paths: string[]) => paths.filter((path) => !path.endsWith('.two')).sort();

describe('translation files', () => {
  const english = leaves(en as unknown as Tree);
  const hebrew = leaves(he as unknown as Tree);

  it('have the same keys', () => {
    expect(comparable(Object.keys(hebrew))).toEqual(comparable(Object.keys(english)));
  });
  it('have no empty strings', () => {
    for (const [path, text] of [...Object.entries(english), ...Object.entries(hebrew)]) {
      expect([path, text.trim().length > 0]).toEqual([path, true]);
    }
  });
  it('use the same placeholders in both languages', () => {
    for (const path of Object.keys(english)) {
      expect([path, placeholders(hebrew[path])]).toEqual([path, placeholders(english[path])]);
    }
  });
  it('translate every user-facing Hebrew string into Hebrew', () => {
    // Brand names, the English language name and file-format words stay as they are.
    const allowed = new Set(['common.appName', 'settings.english', 'journal.shareTitle']);
    for (const [path, text] of Object.entries(hebrew)) {
      if (allowed.has(path)) continue;
      expect([path, /[֐-׿]/.test(text)]).toEqual([path, true]);
    }
  });
  it('name the same catalog foods in both languages', () => {
    expect(Object.keys(he.foods).sort()).toEqual(Object.keys(en.foods).sort());
    expect(Object.keys(en.foods)).toHaveLength(27);
  });
});

describe('translate', () => {
  it('fills placeholders', () => {
    expect(translate('en', 'barcode.lookingUp', { barcode: '7290000066318' })).toBe(
      'Looking up 7290000066318…',
    );
    expect(translate('he', 'home.addTo', { meal: 'ארוחת ערב' })).toBe('הוספה אל ארוחת ערב');
  });
  it('picks plural forms, including the Hebrew dual', () => {
    expect(translate('en', 'home.items', { count: 1 })).toBe('1 item');
    expect(translate('en', 'home.items', { count: 2 })).toBe('2 items');
    expect(translate('he', 'home.items', { count: 1 })).toBe('פריט אחד');
    expect(translate('he', 'home.items', { count: 2 })).toBe('שני פריטים');
    expect(translate('he', 'home.items', { count: 5 })).toBe('5 פריטים');
  });
  it('translates catalog foods by id and leaves unknown names alone', () => {
    expect(foodName('he', 'banana', 'Banana')).toBe('בננה');
    expect(foodName('en', 'banana', 'Banana')).toBe('Banana');
    expect(foodName('he', 'custom', 'Bamba peanut snack')).toBe('Bamba peanut snack');
  });
});

describe('device language', () => {
  it('starts in Hebrew only on a Hebrew phone', () => {
    expect(languageForDevice('he')).toBe('he');
    expect(languageForDevice('iw')).toBe('he');
    expect(languageForDevice('HE')).toBe('he');
    for (const code of ['en', 'ar', 'ru', 'fr', '', null, undefined]) {
      expect(languageForDevice(code)).toBe('en');
    }
  });
});

describe('formatting', () => {
  it('formats numbers with western digits in both languages', () => {
    expect(formatNumber('en', 1234.56, 1)).toBe('1,234.6');
    expect(formatNumber('he', 1234.56, 1)).toBe('1,234.6');
    expect(formatNumber('he', 956)).toBe('956');
  });
  it('shows missing values as text and zero as 0', () => {
    expect(formatOptional('en', null)).toBe('Not provided');
    expect(formatOptional('he', undefined)).toBe('לא צוין');
    expect(formatOptional('en', 0)).toBe('0');
  });
  it('puts the unit after the number', () => {
    expect(formatQuantity('en', 150, 'g')).toBe('150 g');
    expect(formatQuantity('he', 150, 'g')).toBe('150 ג׳');
    expect(formatQuantity('he', 250, 'ml')).toBe('250 מ״ל');
    expect(formatQuantity('he', 133.5, 'kcal')).toBe('133.5 קק״ל');
  });
  it('names days in the app language', () => {
    expect(relativeDayLabel('en', '2026-10-11', '2026-10-11')).toBe('Today');
    expect(relativeDayLabel('he', '2026-10-10', '2026-10-11')).toBe('אתמול');
    expect(relativeDayLabel('he', '2026-10-12', '2026-10-11')).toBe('מחר');
    expect(relativeDayLabel('en', '2026-10-07', '2026-10-11')).toBe('Wednesday');
    expect(relativeDayLabel('he', '2026-10-07', '2026-10-11')).toBe('יום רביעי');
    expect(formatDay('en', '2026-10-11', '2026-10-11')).toBe('October 11');
    expect(formatDay('he', '2026-10-11', '2026-10-11')).toBe('11 באוקטובר');
    expect(formatDay('en', '2025-12-31', '2026-10-11')).toBe('December 31, 2025');
  });
  it('isolates left-to-right codes inside Hebrew text', () => {
    expect(ltr('7290000066318')).toBe('⁦7290000066318⁩');
  });
});
