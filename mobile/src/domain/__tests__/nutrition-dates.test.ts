import { addDays, dayOffset, isIsoDay, parseIsoDay, toIsoDay, todayIso } from '../dates';
import { uploadSize } from '../images';
import {
  defaultMealType,
  emptyNutrition,
  macroEnergyShare,
  missingCore,
  scalePortion,
} from '../nutrition';

describe('portion scaling', () => {
  it('scales per-100 values and keeps missing values missing', () => {
    const per100 = { ...emptyNutrition(), calories: 89, protein: 1.09, carbs: 22.84, fat: 0, salt: 0 };
    const portion = scalePortion(per100, 150);
    expect(portion.calories).toBeCloseTo(133.5);
    expect(portion.carbs).toBeCloseTo(34.26);
    expect(portion.fat).toBe(0);
    expect(portion.salt).toBe(0);
    expect(portion.sugars).toBeNull();
    expect(portion.fiber).toBeNull();
  });
  it('reports which required values are missing; zero is not missing', () => {
    expect(missingCore({ ...emptyNutrition(), calories: 0, protein: 0 })).toEqual(['carbs', 'fat']);
  });
  it('gives the share of energy per macro, or nothing for an empty day', () => {
    const share = macroEnergyShare({ protein: 10, carbs: 10, fat: 10 });
    expect(share).not.toBeNull();
    expect(share!.protein + share!.carbs + share!.fat).toBeCloseTo(1);
    expect(share!.fat).toBeCloseTo(90 / 170);
    expect(macroEnergyShare({ protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });
  it('suggests a meal type from the clock', () => {
    const at = (hour: number) => defaultMealType(new Date(2026, 9, 11, hour, 0));
    expect([at(7), at(13), at(19), at(23), at(16)]).toEqual([
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'snack',
    ]);
  });
});

describe('journal days', () => {
  it('uses the local calendar date', () => {
    expect(toIsoDay(new Date(2026, 9, 11, 23, 59))).toBe('2026-10-11');
    expect(toIsoDay(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 9, 11, 0, 0, 1))).toBe('2026-10-11');
  });
  it('steps across months, years and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-27', 1)).toBe('2026-03-28');
  });
  it('counts whole days from today', () => {
    expect(dayOffset('2026-10-11', '2026-10-11')).toBe(0);
    expect(dayOffset('2026-10-10', '2026-10-11')).toBe(-1);
    expect(dayOffset('2026-11-01', '2026-10-25')).toBe(7);
  });
  it('recognises real ISO days only', () => {
    expect(isIsoDay('2026-10-11')).toBe(true);
    expect(isIsoDay('2026-02-30')).toBe(false);
    expect(isIsoDay('11/10/2026')).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
    expect(parseIsoDay('2026-10-11').getHours()).toBe(12);
  });
});

describe('upload size', () => {
  it('shrinks large photos under the server limits and keeps the shape', () => {
    expect(uploadSize(8064, 6048)).toEqual({ width: 1600, height: 1200 });
    expect(uploadSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });
  it('never enlarges a small picture', () => {
    expect(uploadSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(uploadSize(0, 0)).toBeNull();
  });
});
