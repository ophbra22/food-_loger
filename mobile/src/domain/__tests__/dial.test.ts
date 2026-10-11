import { TYPICAL_MINUTES, dialDots, dialMinutes, dialPoint, dotRadius, loggedOnItsDay } from '../dial';
import type { MealType } from '../nutrition';

const at = (hour: number, minute: number, day = [2026, 9, 11]) =>
  new Date(day[0], day[1], day[2], hour, minute).toISOString();
const meal = (id: string, created_at: string, calories = 200, meal_type: MealType = 'lunch') => ({
  id,
  day: '2026-10-11',
  meal_type,
  created_at,
  calories,
});

describe('where a meal sits on the dial', () => {
  it('uses the local time it was logged when that was on the same day', () => {
    const entry = meal('a', at(13, 30));
    expect(loggedOnItsDay(entry)).toBe(true);
    expect(dialMinutes(entry)).toBe(13 * 60 + 30);
  });
  it('uses the usual time for the meal when it was logged on another day', () => {
    const late = meal('a', at(9, 0, [2026, 9, 12]), 200, 'dinner');
    expect(loggedOnItsDay(late)).toBe(false);
    expect(dialMinutes(late)).toBe(TYPICAL_MINUTES.dinner);
    expect(loggedOnItsDay(meal('b', 'not a date'))).toBe(false);
  });
});

describe('dots', () => {
  it('are in time order and sized by energy within limits', () => {
    const dots = dialDots([meal('late', at(19, 0), 900), meal('early', at(7, 0), 10)]);
    expect(dots.map((dot) => dot.id)).toEqual(['early', 'late']);
    expect(dotRadius(0)).toBe(7);
    expect(dotRadius(100000)).toBe(15);
    expect(dotRadius(400)).toBeCloseTo(17.5 > 15 ? 15 : 17.5);
  });
  it('spreads meals logged minutes apart so every dot stays visible', () => {
    const dots = dialDots([meal('a', at(13, 0)), meal('b', at(13, 2)), meal('c', at(13, 4))], 42);
    expect(dots.map((dot) => dot.minutes)).toEqual([780, 822, 864]);
  });
  it('never pushes a dot past midnight', () => {
    const dots = dialDots([meal('a', at(23, 40)), meal('b', at(23, 50)), meal('c', at(23, 55))], 42);
    expect(Math.max(...dots.map((dot) => dot.minutes))).toBeLessThan(24 * 60);
    expect(dots[1].minutes - dots[0].minutes).toBe(42);
    expect(dots[2].minutes - dots[1].minutes).toBe(42);
  });
});

describe('clock geometry', () => {
  it('puts midnight at the top and runs clockwise', () => {
    const top = dialPoint(0, 100, 150);
    const sixAm = dialPoint(6 * 60, 100, 150);
    const noon = dialPoint(12 * 60, 100, 150);
    const sixPm = dialPoint(18 * 60, 100, 150);
    expect([Math.round(top.x), Math.round(top.y)]).toEqual([150, 50]);
    expect([Math.round(sixAm.x), Math.round(sixAm.y)]).toEqual([250, 150]);
    expect([Math.round(noon.x), Math.round(noon.y)]).toEqual([150, 250]);
    expect([Math.round(sixPm.x), Math.round(sixPm.y)]).toEqual([50, 150]);
  });
});
