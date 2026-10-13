import { analysisFromResult, analysisPayload, analysisValid, foodTotals, mealTotals,
  replaceReference } from '../meal-analysis';
import type { MealAnalysis, NutritionReference } from '@/api/meal-analysis-types';

const chicken: NutritionReference = { id: 'fdc:171477', name: 'Chicken, cooked',
  source: 'USDA FoodData Central', source_url: 'https://fdc.nal.usda.gov/food-details/171477/nutrients',
  data_type: 'SR Legacy', basis_unit: 'g', nutrition: { calories: 165, protein: 31, fat: 3.6, carbs: 0 } };
const rice: NutritionReference = { ...chicken, id: 'fdc:rice-test', name: 'Rice',
  nutrition: { calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2 } };
const result = { analysis_id: 'analysis-test', meal_name: 'Lunch', warnings: [],
  provider: 'openai', model: 'test', foods: [
    { id: 'chicken', name: 'Chicken', estimated_weight_g: 160, weight_min_g: 100,
      weight_max_g: 220, confidence: 'medium', reference: chicken,
      reference_alternatives: [rice], alternatives: [], question: null },
    { id: 'rice', name: 'Rice', estimated_weight_g: 180, weight_min_g: 130,
      weight_max_g: 230, confidence: 'high', reference: rice,
      reference_alternatives: [], alternatives: [], question: null },
  ] } as unknown as MealAnalysis; // Only fields consumed by the draft mapper are fixture inputs.

test('portion edits update item and total nutrition immediately with matching server rounding', () => {
  const draft = analysisFromResult(result);
  expect(mealTotals(draft.foods)).toEqual({ calories: 498, protein: 54.5, fat: 6.3, carbs: 50.8 });
  draft.foods[0].amount = '100';
  expect(mealTotals(draft.foods).calories).toBe(399);
  expect(foodTotals({ ...draft.foods[0], amount: '1,5' }).calories).toBe(2.5);
  draft.foods.splice(1, 1);
  expect(mealTotals(draft.foods).calories).toBe(165);
});

test('same-named servings retain distinct locations from the photo', () => {
  const duplicated = { ...result, foods: [
    { ...result.foods[0], region: 'left plate' },
    { ...result.foods[0], id: 'chicken-right', region: 'right bowl' },
  ] };
  expect(analysisFromResult(duplicated).foods.map(f => f.region)).toEqual(['left plate', 'right bowl']);
});

test('unconfirmed, missing nutrition and invalid portions cannot be saved', () => {
  const draft = analysisFromResult(result);
  expect(analysisValid(draft)).toBe(false);
  draft.foods.forEach(f => { f.confirmed = true; });
  expect(analysisValid(draft)).toBe(true);
  draft.foods[0].reference = null;
  expect(mealTotals(draft.foods).calories).toBeNull();
  expect(analysisValid(draft)).toBe(false);
  draft.foods[0].reference = chicken;
  draft.foods[0].amount = 'NaN';
  expect(analysisValid(draft)).toBe(false);
  expect(mealTotals(draft.foods).calories).toBeNull();
});

test('replacement resets confirmation and replaces nutrients; save sends ids, not fake sources', () => {
  const draft = analysisFromResult(result);
  draft.foods[0] = replaceReference({ ...draft.foods[0], confirmed: true }, rice);
  expect(draft.foods[0].confirmed).toBe(false);
  expect(foodTotals(draft.foods[0]).calories).toBe(208);
  draft.foods.forEach(f => { f.confirmed = true; });
  const payload = analysisPayload(draft, '2026-10-13', 'lunch');
  expect(payload.foods[0]).toEqual({ id: 'chicken', name: 'Rice', grams: 160,
    reference_id: 'fdc:rice-test', manual_nutrition: null, confirmed: true });
  expect(payload.foods).toHaveLength(2);
});

test('numeric missing nutrients never become zeros and all components must be unique', () => {
  const draft = analysisFromResult(result);
  draft.foods.forEach(f => { f.confirmed = true; });
  draft.foods[0].reference = { ...chicken, nutrition: { ...chicken.nutrition, protein: null } };
  expect(mealTotals(draft.foods).protein).toBeNull();
  expect(mealTotals(draft.foods).calories).toBe(498);
  expect(analysisValid(draft)).toBe(false);
  draft.foods[0].reference = chicken;
  draft.foods[1].id = draft.foods[0].id;
  expect(analysisValid(draft)).toBe(false);
});
