import {copyPayload} from '@/domain/copying';
import type { Api } from '@/api/endpoints';
import type { Meal } from '@/api/types';
import { Draft, draftPayload, isDraftValid, markAttempted } from '@/domain/drafts';
import { reviewPayload } from '@/domain/unified-review';
import { ApiError } from '@/api/errors';
import { analysisPayload } from '@/domain/meal-analysis';

/**
 * Send a reviewed draft to the server.
 *
 * The draft is marked as attempted and written to disk before the request, and
 * its key travels as `Idempotency-Key`. If the answer is lost, sending the same
 * draft again returns the entry that was already created instead of a second one.
 */
export async function saveDraft(
  api: Pick<Api, 'addMeal' | 'addCustomMeal'> & Partial<Pick<Api, 'copyMeals' | 'addAnalyzedMeal' | 'captureSession' | 'addCanonicalMeal' | 'capabilities'>>,
  draft: Draft,
  persist: (draft: Draft) => Promise<void>,
): Promise<Meal | Meal[]> {
  if (!isDraftValid(draft)) throw new Error('Draft is not valid.');
  const assertSession = api.captureSession?.();
  if(draft.copy){
    const body=copyPayload(draft),caps=await api.capabilities?.();assertSession?.();
    if(!api.copyMeals||!caps?.copy)throw new ApiError('unavailable');
    await persist(markAttempted(draft));assertSession?.();return api.copyMeals(body,draft.key);
  }
  if (draft.analysis?.version === 2) {
    const body = reviewPayload(draft);
    const caps = await api.capabilities?.();
    assertSession?.();
    if (!api.addCanonicalMeal || caps?.canonical_writes !== true || caps.partial_core_writes !== true || caps.tiny_portion_writes !== true) {
      throw new ApiError('unavailable', {detail:'Updated journal storage is required.'});
    }
    await persist(markAttempted(draft));
    assertSession?.();
    return api.addCanonicalMeal(body,draft.key);
  }
  const attempted = markAttempted(draft);
  await persist(attempted);
  assertSession?.();
  if (attempted.analysis) {
    if (!api.addAnalyzedMeal) throw new Error('Meal analysis is unavailable.');
    return (await api.addAnalyzedMeal(
      analysisPayload(attempted.analysis, attempted.day, attempted.mealType), attempted.key)).meals;
  }
  const payload = draftPayload(attempted);
  return payload.kind === 'catalog'
    ? api.addMeal(payload.body, attempted.key)
    : api.addCustomMeal(payload.body, attempted.key);
}
