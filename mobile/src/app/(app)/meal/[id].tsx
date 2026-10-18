import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { errorMessageKey } from '@/api/messages';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { useMealName } from '@/components/MealRow';
import { Notice } from '@/components/Notice';
import { NutritionGrid } from '@/components/NutritionGrid';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { useDay } from '@/data/useDay';
import { isIsoDay, todayIso } from '@/domain/dates';
import { loggedOnItsDay } from '@/domain/dial';
import { useI18n } from '@/i18n/I18nProvider';
import { formatFullDay, formatQuantity, formatTime, ltr } from '@/i18n/format';
import type { TKey } from '@/i18n/translate';
import { colors, mealColors, radius, spacing } from '@/theme/tokens';

export default function MealDetails() {
  const { t, language } = useI18n();
  const toast = useToast();
  const { journal } = useAuth();
  const mealName = useMealName();
  const params = useLocalSearchParams<{ id: string; day?: string }>();
  const day = isIsoDay(params.day) ? params.day : todayIso();
  const { data, loading } = useDay(day);
  const [deleting, setDeleting] = useState(false);
  const [failure, setFailure] = useState<TKey | null>(null);

  const meal = data?.meals.find((item) => item.id === params.id) ?? null;

  if (!meal) {
    return (
      <Screen header={<Header title={t('meal.title')} />}>
        {loading && !data ? (
          <ActivityIndicator color={colors.sand} accessibilityLabel={t('common.loading')} />
        ) : (
          <Notice message={t('errors.notFound')} />
        )}
      </Screen>
    );
  }

  const name = mealName(meal);
  const unit = meal.details.basis_unit ?? 'g';
  const source = meal.details.source ?? 'catalog';
  const isCustom = meal.food_id === 'custom';
  // Catalog entries store energy and macros only; products also keep the label's other values.
  const totals = isCustom
    ? { ...meal.details.nutrition_total, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }
    : { calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat };

  const remove = async () => {
    setFailure(null);
    setDeleting(true);
    try {
      await journal?.delete({ id: meal.id, day: meal.day });
      toast(t('meal.deleted'));
      router.back();
    } catch (error) {
      setFailure(errorMessageKey(error, 'delete'));
      setDeleting(false);
    }
  };
  const confirmDelete = () =>
    Alert.alert(t('meal.deleteTitle'), t('meal.deleteBody', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: remove },
    ]);

  const rows: [string, string][] = [
    [t('meal.amount'), formatQuantity(language, meal.grams, unit)],
    [t('meal.meal'), t(`mealTypes.${meal.meal_type}`)],
    [t('review.day'), formatFullDay(language, meal.day)],
    ...(loggedOnItsDay(meal)
      ? ([[t('meal.loggedAt'), formatTime(language, meal.created_at)]] as [string, string][])
      : []),
    [t('meal.source'), t(`meal.sources.${source}`)],
    ...(meal.details.brand ? ([[t('review.brand'), meal.details.brand]] as [string, string][]) : []),
    ...(meal.details.barcode ? ([[t('review.barcode'), ltr(meal.details.barcode)]] as [string, string][]) : []),
  ];

  return (
    <Screen
      header={<Header title={t('meal.title')} />}
      footer={
        <>
          {failure ? <Notice tone="error" message={t(failure)} /> : null}
          <Button
            testID="delete-meal"
            kind="danger"
            icon="trash-2"
            label={t('meal.delete')}
            busy={deleting}
            onPress={confirmDelete}
          />
        </>
      }>
      <Button label={t('mealEdit.edit')} disabled={deleting} onPress={()=>router.push({pathname:'/meal/edit/[id]',params:{id:meal.id,day:meal.day}})}/>
      <Button label={t('copy.duplicateMeal')} onPress={()=>router.push({pathname:'/copy',params:{source:meal.day,destination:todayIso(),mealId:meal.id}})}/>
      <View style={styles.head}>
        <AppText style={styles.emoji} maxFontSizeMultiplier={1.3}>
          {meal.emoji}
        </AppText>
        <View style={styles.headText}>
          <AppText variant="title" accessibilityRole="header">
            {name}
          </AppText>
          <View style={styles.type}>
            <View style={[styles.dot, { backgroundColor: mealColors[meal.meal_type] }]} />
            <AppText variant="caption" color={colors.muted}>
              {t(`mealTypes.${meal.meal_type}`)}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" color={colors.muted}>
          {t('review.forPortion')}
        </AppText>
        <NutritionGrid values={totals} showOptional={isCustom} basisUnit={unit} />
      </View>

      {isCustom && meal.details.nutrition_per100 ? (
        <View style={styles.section}>
          <AppText variant="label" color={colors.muted}>
            {t('review.labelValues')} {unit === 'ml' ? t('units.per100ml') : t('units.per100g')}
          </AppText>
          <NutritionGrid values={meal.details.nutrition_per100} showOptional basisUnit={unit} />
        </View>
      ) : null}

      <View style={styles.card}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
            <AppText variant="caption" color={colors.muted} style={styles.rowLabel}>
              {label}
            </AppText>
            <AppText variant="label" style={styles.rowValue}>
              {value}
            </AppText>
          </View>
        ))}
      </View>

      {source === 'catalog' ? <Notice message={t('review.sourceCatalog')} /> : null}
      {source === 'barcode' ? <Notice message={t('review.sourceProduct')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingTop: spacing.sm },
  emoji: { fontSize: 44, lineHeight: 54 },
  headText: { flex: 1, gap: spacing.xs },
  type: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  section: { gap: spacing.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  rowLabel: { flexShrink: 0 },
  rowValue: { flex: 1, textAlign: 'right' },
});
