/** Upgrade editable inputs only. Attempted legacy saves retain their original wire identity. */
import type { CatalogFood } from '@/api/types';
import type { Draft } from './drafts';
import { adaptLegacyDraft, sodiumMg, validateTimeContext, type MealDraft } from './canonical';
import { analysisValid, newReviewFood, per100 } from './meal-analysis';
import { emptyNutrition } from './nutrition';
import { nutritionToInputs } from './validation';

export function toUnifiedReview(draft: Draft, catalog?: CatalogFood): Draft {
  if (draft.analysis?.version === 2 || draft.attempted) return draft;
  if (draft.analysis) return { ...draft, analysis: { ...draft.analysis, version: 2 } };
  if (draft.foodId && !catalog) throw new Error('Catalog must load before review.');
  const food = { ...newReviewFood(draft.key), name: catalog?.name ?? draft.name,
    amount: draft.amount, basis: draft.basisUnit, source: catalog ? 'catalog' : draft.origin,
    manual: catalog ? nutritionToInputs({ ...emptyNutrition(), ...catalog }) : { ...draft.nutrition },
    manualOverride: draft.origin === 'manual', product: draft.product };
  return { ...draft, analysis: { version: 2, analysisId: draft.key,
    mealName: catalog?.name ?? draft.name, foods: [food], warnings: draft.product?.notes ?? [],
    provider: catalog ? 'catalog' : draft.origin, model: '' } };
}

export function reviewPayload(draft: Draft): MealDraft {
  if (!draft.analysis || !analysisValid(draft.analysis)) throw new Error('Review every food.');
  const occurredAt = draft.occurredAt?.trim() || null, zone = draft.timezoneId?.trim() || null;
  if (!validateTimeContext(draft.day, occurredAt, zone)) throw new Error('Invalid meal time.');
  const base = adaptLegacyDraft(draft);
  return { ...base, occurred_at: occurredAt, timezone_id: zone,
    warnings: draft.analysis.warnings.slice(0,30), items: base.items.map((item,index) => {
      const food = draft.analysis!.foods[index], basis = food.basis ?? 'g';
      const values = per100(food), quantity = item.portion.quantity;
      return { ...item, display_name: food.name.trim(),
        portion: { quantity, unit:basis, [basis === 'g'?'normalized_g':'normalized_ml']:quantity,
          estimated: draft.origin === 'photo' && food.range !== null },
        nutrition_per_100: { ...item.nutrition_per_100, basis, sodium_mg:sodiumMg(values.sodium,values.salt) },
        source: { provider: food.source ?? food.reference?.source ?? 'manual',
          ...(food.reference ? {reference_id:food.reference.id} : {}),
          verified_status: 'user_confirmed', brand:food.product?.brand, barcode:food.product?.barcode },
        confidence:food.confidence, manual_override:food.manualOverride ?? (food.manual !== null),
        warnings:[...(food.question?[food.question]:[]),...(food.range?[`estimated_range_g:${food.range.join('-')}`]:[])],
        ...(food.product ? {label_metadata:food.product} : {}) };
    }) };
}
