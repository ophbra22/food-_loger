/** Nutrition values and portion maths. `null` means "not provided" and is never treated as zero. */

export const CORE_NUTRIENTS = ['calories', 'protein', 'carbs', 'fat'] as const;
export const OPTIONAL_NUTRIENTS = ['sugars', 'saturated_fat', 'fiber', 'salt', 'sodium'] as const;
export const NUTRIENTS = [...CORE_NUTRIENTS, ...OPTIONAL_NUTRIENTS] as const;

export type CoreNutrient = (typeof CORE_NUTRIENTS)[number];
export type Nutrient = (typeof NUTRIENTS)[number];
export type NutritionPer100 = Record<Nutrient, number | null>;
export type BasisUnit = 'g' | 'ml';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Limits enforced by the backend (schemas.py). */
export const AMOUNT_MIN = 1;
export const AMOUNT_MAX = 2000;
export const CALORIES_MAX = 1000;
export const NUTRIENT_MAX = 100;

export const emptyNutrition = (): NutritionPer100 => ({
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  sugars: null,
  saturated_fat: null,
  fiber: null,
  salt: null,
  sodium: null,
});

export const nutrientMax = (key: Nutrient) => (key === 'calories' ? CALORIES_MAX : NUTRIENT_MAX);

/** Scale per-100 values to a portion. Missing values stay missing. */
export function scalePortion(per100: NutritionPer100, amount: number): NutritionPer100 {
  const scaled = emptyNutrition();
  for (const key of NUTRIENTS) {
    const value = per100[key];
    scaled[key] = value == null ? null : (value * amount) / 100;
  }
  return scaled;
}

export const missingCore = (per100: NutritionPer100): CoreNutrient[] =>
  CORE_NUTRIENTS.filter((key) => per100[key] == null);

/** Share of energy from each macro (4/4/9 kcal per gram), for the split bar. */
export function macroEnergyShare(totals: { protein: number | null; carbs: number | null; fat: number | null }) {
  if (totals.protein === null || totals.carbs === null || totals.fat === null) return null;
  const protein = totals.protein * 4;
  const carbs = totals.carbs * 4;
  const fat = totals.fat * 9;
  const sum = protein + carbs + fat;
  if (sum <= 0) return null;
  return { protein: protein / sum, carbs: carbs / sum, fat: fat / sum };
}

/** Meal type suggested from the local time; the user can always change it. */
export function defaultMealType(now: Date = new Date()): MealType {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'snack';
}
