import type { AnalyzedMealPayload, Confidence, CoreValues, MealAnalysis,
  NutritionReference } from '@/api/meal-analysis-types';
import { CORE_NUTRIENTS, type CoreNutrient, type MealType } from './nutrition';
import { parseDecimal, validateAmount, validateFoodName, validateNutrient } from './validation';

export type ReviewFood = {
  id: string; name: string; region: string; amount: string; reference: NutritionReference | null;
  references: NutritionReference[]; alternatives: string[]; question: string | null;
  confidence: Confidence; range: [number, number] | null; confirmed: boolean;
  manual: Record<CoreNutrient, string> | null;
};
export type AnalysisDraft = {
  analysisId: string; mealName: string; foods: ReviewFood[]; warnings: string[];
  provider: string; model: string;
};

export function analysisFromResult(result: MealAnalysis): AnalysisDraft {
  return { analysisId: result.analysis_id, mealName: result.meal_name,
    provider: result.provider, model: result.model, warnings: result.warnings,
    foods: result.foods.map(f => ({ id: f.id, name: f.name.slice(0, 120), region: f.region,
      amount: String(f.estimated_weight_g), reference: f.reference,
      references: [...(f.reference ? [f.reference] : []), ...f.reference_alternatives],
      alternatives: f.alternatives, question: f.question, confidence: f.confidence,
      range: [f.weight_min_g, f.weight_max_g], confirmed: false, manual: null })) };
}

export function newReviewFood(id: string): ReviewFood {
  return { id, name: '', region: '', amount: '', reference: null, references: [], alternatives: [],
    question: null, confidence: 'low', range: null, confirmed: false, manual: null };
}

export function replaceReference(food: ReviewFood, reference: NutritionReference): ReviewFood {
  return { ...food, name: reference.name.slice(0, 120), reference, manual: null, confirmed: false };
}

export function per100(food: ReviewFood): CoreValues {
  return Object.fromEntries(CORE_NUTRIENTS.map(k => [k, food.manual
    ? (validateNutrient(k, food.manual[k]) ? null : parseDecimal(food.manual[k]))
    : food.reference?.nutrition[k] ?? null])) as CoreValues;
}

// Decimal portions rounded half-up to one place, like the server. Epsilon handles
// binary representation at decimal ties (e.g. 1.005); quantities are bounded.
const round1 = (n: number) => Math.round((n + 1e-9) * 10) / 10;
export function foodTotals(food: ReviewFood): CoreValues {
  const values = per100(food);
  const amount = validateAmount(food.amount) ? null : parseDecimal(food.amount);
  return Object.fromEntries(CORE_NUTRIENTS.map(k => [k,
    amount === null || values[k] === null ? null : round1(values[k] * amount / 100)])) as CoreValues;
}

export function mealTotals(foods: ReviewFood[]): CoreValues {
  const rows = foods.map(foodTotals);
  return Object.fromEntries(CORE_NUTRIENTS.map(k => [k,
    rows.some(row => row[k] === null) ? null : round1(rows.reduce((sum, row) => sum + row[k]!, 0))])) as CoreValues;
}

export function foodValid(food: ReviewFood) {
  return !validateAmount(food.amount) && !validateFoodName(food.name)
    && (food.reference !== null || food.manual !== null)
    && CORE_NUTRIENTS.every(k => per100(food)[k] !== null);
}

export function analysisValid(draft: AnalysisDraft) {
  return draft.foods.length > 0 && draft.foods.length <= 15
    && new Set(draft.foods.map(f => f.id)).size === draft.foods.length
    && draft.foods.every(f => f.confirmed && foodValid(f));
}

export function analysisPayload(draft: AnalysisDraft, day: string, mealType: MealType): AnalyzedMealPayload {
  if (!analysisValid(draft)) throw new Error('Review every food and supply complete nutrition.');
  return { day, meal_type: mealType, analysis_id: draft.analysisId,
    foods: draft.foods.map(f => ({ id: f.id, name: f.name.trim(), grams: parseDecimal(f.amount)!,
      reference_id: f.manual ? null : f.reference!.id,
      manual_nutrition: f.manual ? per100(f) : null, confirmed: true })) };
}
