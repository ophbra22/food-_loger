import type { Api } from '@/api/endpoints';
import type { Meal } from '@/api/types';
import { Draft, draftPayload, isDraftValid, markAttempted } from '@/domain/drafts';
import { analysisPayload } from '@/domain/meal-analysis';

/**
 * Send a reviewed draft to the server.
 *
 * The draft is marked as attempted and written to disk before the request, and
 * its key travels as `Idempotency-Key`. If the answer is lost, sending the same
 * draft again returns the entry that was already created instead of a second one.
 */
export async function saveDraft(
  api: Pick<Api, 'addMeal' | 'addCustomMeal'> & Partial<Pick<Api, 'addAnalyzedMeal' | 'captureSession'>>,
  draft: Draft,
  persist: (draft: Draft) => Promise<void>,
): Promise<Meal | Meal[]> {
  if (!isDraftValid(draft)) throw new Error('Draft is not valid.');
  const assertSession = api.captureSession?.();
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
