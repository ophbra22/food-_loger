import type { AnalyzedMealPayload, Confidence, CoreValues, MealAnalysis,
  NutritionReference } from '@/api/meal-analysis-types';
import { CORE_NUTRIENTS, NUTRIENTS, type CoreNutrient, type Nutrient, type NutritionPer100, type MealType } from './nutrition';
import { multiply, sum } from './exact';
import { parseNutrientDecimal, parseDecimal, validateAmount, validateFoodName, validateNutrient } from './validation';

export type ReviewFood = {
  id: string; name: string; region: string; amount: string; reference: NutritionReference | null;
  references: NutritionReference[]; alternatives: string[]; question: string | null;
  confidence: Confidence; range: [number, number] | null; confirmed: boolean;
  basis?: 'g' | 'ml';
  source?: string;
  manualOverride?: boolean;
  originalPortion?: import('./canonical').CanonicalItem['portion'];
  originSource?: import('./canonical').CanonicalItem['source'];
  originalWarnings?: string[];
  product?: import('./drafts').ProductInfo | null;
  manual: (Record<CoreNutrient, string> & Partial<Record<Nutrient,string>>) | null;
};
export type AnalysisDraft = {
  version?: 2;
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
  return { ...food, name: reference.name.slice(0, 120), reference, basis: 'g', source: reference.source, originSource: undefined, originalPortion: undefined, originalWarnings: undefined, manual: null, manualOverride: false, product: null, confirmed: false };
}

export function per100(food: ReviewFood): NutritionPer100 {
  return Object.fromEntries(NUTRIENTS.map(k => [k, food.manual
    ? (validateNutrient(k, food.manual[k] ?? '') ? null : parseNutrientDecimal(food.manual[k] ?? ''))
    : food.reference?.nutrition[k as CoreNutrient] ?? null])) as NutritionPer100;
}

/** Only an unchanged, validated canonical quantity bypasses keyboard precision limits. */
export function foodAmount(food:ReviewFood):number|null {
  const original=food.originalPortion?.[food.basis==='ml'?'normalized_ml':'normalized_g'];
  return typeof original==='number' && Number.isFinite(original) && food.amount===String(original)?original:parseDecimal(food.amount);
}
export function foodTotals(food: ReviewFood): CoreValues {
  const values = per100(food), amount = foodAmount(food);
  return Object.fromEntries(CORE_NUTRIENTS.map(k => [k,
    amount === null || !Number.isFinite(amount) || amount < 0.0001 || amount > 2000 || values[k] === null
      ? null : multiply(values[k]!, amount, 100)])) as CoreValues;
}

export function mealTotals(foods: ReviewFood[]): CoreValues {
  const rows = foods.map(foodTotals);
  return Object.fromEntries(CORE_NUTRIENTS.map(k => [k,
    !rows.length || rows.some(row => row[k] === null) ? null : sum(rows.map(row => row[k]!))])) as CoreValues;
}

export function foodValid(food: ReviewFood, partial = false) {
  const amount = foodAmount(food);
  const validAmount = partial ? amount !== null && Number.isFinite(amount) && amount >= 0.0001 && amount <= 2000 : !validateAmount(food.amount);
  return validAmount && !validateFoodName(food.name)
    && (food.reference !== null || food.manual !== null)
    && (food.manual === null || NUTRIENTS.every(k =>
      (partial && !(food.manual![k] ?? '').trim()) || !validateNutrient(k, food.manual![k] ?? '')))
    && (partial || CORE_NUTRIENTS.every(k => per100(food)[k] !== null));
}

export function analysisValid(draft: AnalysisDraft) {
  return draft.foods.length > 0 && draft.foods.length <= 15
    && new Set(draft.foods.map(f => f.id)).size === draft.foods.length
    && draft.foods.every(f => f.confirmed && foodValid(f, draft.version === 2));
}

export function analysisPayload(draft: AnalysisDraft, day: string, mealType: MealType): AnalyzedMealPayload {
  if (!analysisValid(draft)) throw new Error('Review every food and supply complete nutrition.');
  return { day, meal_type: mealType, analysis_id: draft.analysisId,
    foods: draft.foods.map(f => ({ id: f.id, name: f.name.trim(), grams: parseDecimal(f.amount)!,
      reference_id: f.manual ? null : f.reference!.id,
      manual_nutrition: f.manual ? per100(f) : null, confirmed: true })) };
}
