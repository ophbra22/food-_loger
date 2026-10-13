/**
 * Geometry for the 24-hour day dial. Midnight is at the top and time runs
 * clockwise, like a clock, in both Hebrew and English.
 */
import { toIsoDay } from './dates';
import type { MealType } from './nutrition';

/** Where a meal sits when its real time is unknown (it was logged on a different day). */
export const TYPICAL_MINUTES: Record<MealType, number> = {
  breakfast: 8 * 60,
  lunch: 13 * 60,
  snack: 16 * 60,
  dinner: 19 * 60 + 30,
};

const DAY_MINUTES = 24 * 60;

type DialMeal = { id: string; day: string; meal_type: MealType; created_at: string; calories: number | null };

/** True when the entry was logged on the journal day itself, so its clock time is meaningful. */
export function loggedOnItsDay(meal: Pick<DialMeal, 'day' | 'created_at'>): boolean {
  const logged = new Date(meal.created_at);
  return !Number.isNaN(logged.getTime()) && toIsoDay(logged) === meal.day;
}

/** Minutes after local midnight: the time it was logged, or the usual time for that meal. */
export function dialMinutes(meal: DialMeal): number {
  if (loggedOnItsDay(meal)) {
    const logged = new Date(meal.created_at);
    return logged.getHours() * 60 + logged.getMinutes();
  }
  return TYPICAL_MINUTES[meal.meal_type];
}

export type DialDot = { id: string; mealType: MealType; minutes: number; radius: number };

/** Bigger meals get bigger dots, within a readable range. */
export const dotRadius = (calories: number | null) =>
  calories === null ? 7 : Math.max(7, Math.min(15, 5 + Math.sqrt(Math.max(0, calories)) / 1.6));

/**
 * One dot per meal, in time order. Meals logged minutes apart are nudged along
 * the ring so every dot stays visible and tappable.
 */
export function dialDots(meals: DialMeal[], minGap = 42): DialDot[] {
  const dots = meals
    .map((meal) => ({
      id: meal.id,
      mealType: meal.meal_type,
      minutes: dialMinutes(meal),
      radius: dotRadius(meal.calories),
    }))
    .sort((a, b) => a.minutes - b.minutes || a.id.localeCompare(b.id));
  for (let index = 1; index < dots.length; index += 1) {
    const earliest = dots[index - 1].minutes + minGap;
    if (dots[index].minutes < earliest) dots[index].minutes = earliest;
  }
  // If nudging ran past midnight, pull the tail back so the ring does not wrap.
  for (let index = dots.length - 1; index >= 0; index -= 1) {
    const latest = index === dots.length - 1 ? DAY_MINUTES - 10 : dots[index + 1].minutes - minGap;
    if (dots[index].minutes > latest) dots[index].minutes = latest;
  }
  return dots;
}

/** Point on a circle for a time of day. `minutes` 0 is the top; angles grow clockwise. */
export function dialPoint(minutes: number, radius: number, centre: number) {
  const angle = (minutes / DAY_MINUTES) * 2 * Math.PI - Math.PI / 2;
  return { x: centre + radius * Math.cos(angle), y: centre + radius * Math.sin(angle) };
}
