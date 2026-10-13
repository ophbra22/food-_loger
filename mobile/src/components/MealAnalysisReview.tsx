import { DraftPersistenceNotice } from '@/components/DraftPersistenceNotice';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { errorMessageKey } from '@/api/messages';
import { useDraft } from '@/data/DraftProvider';
import { analysisValid, mealTotals, newReviewFood, type AnalysisDraft } from '@/domain/meal-analysis';
import { MEAL_TYPES } from '@/domain/nutrition';
import { useI18n } from '@/i18n/I18nProvider';
import type { TKey } from '@/i18n/translate';
import { colors } from '@/theme/tokens';
import { AppText } from './AppText';
import { Button } from './Button';
import { DayNav } from './DayNav';
import { Header } from './Header';
import { MealFoodEditor } from './MealFoodEditor';
import { Notice } from './Notice';
import { NutritionGrid } from './NutritionGrid';
import { Screen } from './Screen';
import { Segmented } from './Segmented';
import { useToast } from './Toast';

const WARNINGS: Record<string, TKey> = {
  estimated_portions: 'analysis.warnings.estimated_portions',
  hidden_ingredients: 'analysis.warnings.hidden_ingredients',
  missing_nutrition: 'analysis.warnings.missing_nutrition',
  poor_lighting: 'analysis.warnings.poor_lighting', low_detail: 'analysis.warnings.low_detail',
};

export function MealAnalysisReview() {
  const { t } = useI18n();
  const { api } = useAuth();
  const { draft, update, save, saving, discard, newKey } = useDraft();
  const [failure, setFailure] = useState<TKey | null>(null);
  const toast = useToast();
  if (!draft?.analysis) return null;
  const analysis = draft.analysis;
  const updateAnalysis = (value: AnalysisDraft) => update({ analysis: value });
  const totals = mealTotals(analysis.foods);
  const onSave = async () => {
    if (!analysisValid(analysis)) { setFailure('analysis.needsReview'); return; }
    setFailure(null);
    try { await save(); toast(t('review.saved')); router.dismissTo('/'); }
    catch (error) { setFailure(errorMessageKey(error, 'saveCustom')); }
  };
  return <Screen header={<Header title={t('analysis.review')} leading="close" onLeading={() => router.dismissTo('/')} />}
    footer={<>
      {failure ? <Notice tone="error" message={t(failure)} /> : null}
      <Button testID="save-analyzed-meal" label={t('review.save')} busyLabel={t('review.saving')}
        busy={saving} onPress={onSave} icon="check" />
    </>}>
    <DraftPersistenceNotice />
    <AppText variant="heading">{analysis.mealName}</AppText>
    <AppText color={colors.muted}>{t('analysis.estimated')}</AppText>
    <AppText variant="label">{t('analysis.total')}</AppText>
    <NutritionGrid values={totals} />
    {Object.values(totals).some(v => v === null) ? <Notice tone="warning" message={t('analysis.incomplete')} /> : null}
    {analysis.warnings.map((warning, i) => <AppText key={i} variant="caption" color={colors.muted}>
      {WARNINGS[warning] ? t(WARNINGS[warning]) : warning}
    </AppText>)}
    {analysis.foods.map(food => <MealFoodEditor key={food.id} food={food} disabled={saving}
      search={api.nutritionReferences}
      onChange={next => updateAnalysis({ ...analysis, foods: analysis.foods.map(f => f.id === next.id ? next : f) })}
      onRemove={() => updateAnalysis({ ...analysis, foods: analysis.foods.filter(f => f.id !== food.id) })} />)}
    <Button label={t('analysis.addFood')} kind="secondary" disabled={saving || analysis.foods.length >= 15}
      onPress={() => updateAnalysis({ ...analysis, foods: [...analysis.foods, newReviewFood(newKey())] })} icon="plus" />
    <Segmented label={t('review.meal')} value={draft.mealType} disabled={saving}
      onChange={mealType => update({ mealType })}
      options={MEAL_TYPES.map(value => ({ value, label: t(`mealTypes.${value}`) }))} />
    <DayNav day={draft.day} onChange={day => !saving && update({ day })} compact />
    <Button label={t('review.discard')} kind="ghost" disabled={saving} onPress={() =>
      Alert.alert(t('review.discardTitle'), t('review.discardBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('review.discard'), style: 'destructive', onPress: () => { void discard(); } },
      ])} />
  </Screen>;
}
