import { DraftPersistenceNotice } from '@/components/DraftPersistenceNotice';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { isApiError } from '@/api/errors';
import { errorMessageKey } from '@/api/messages';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DayNav } from '@/components/DayNav';
import { Header } from '@/components/Header';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { MealAnalysisReview } from '@/components/MealAnalysisReview';
import { NutritionGrid } from '@/components/NutritionGrid';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDraft } from '@/data/DraftProvider';
import { catalogFood, useCatalog } from '@/data/catalog';
import { draftProblems, isDraftValid } from '@/domain/drafts';
import {
  CORE_NUTRIENTS,
  MEAL_TYPES,
  Nutrient,
  NutritionPer100,
  OPTIONAL_NUTRIENTS,
  emptyNutrition,
  scalePortion,
} from '@/domain/nutrition';
import { inputsToNutrition, parseDecimal, trimNumber } from '@/domain/validation';
import { useI18n } from '@/i18n/I18nProvider';
import { formatList, formatQuantity, ltr } from '@/i18n/format';
import { foodName } from '@/i18n/translate';
import type { TKey } from '@/i18n/translate';
import { colors, mealColors, radius, spacing } from '@/theme/tokens';

/**
 * The last step before saving: confirm the food, enter the amount, check the
 * values. Nothing reaches the journal until "Save to journal" succeeds.
 */
export function LegacyMealReview() {
  const { fontScale } = useWindowDimensions();
  const { t, language } = useI18n();
  const toast = useToast();
  const { draft, update, save, saving, discard } = useDraft();
  const { foods, error: catalogError } = useCatalog();
  const [showProblems, setShowProblems] = useState(false);
  const [failure, setFailure] = useState<TKey | null>(null);
  const [showMore, setShowMore] = useState(false);

  // A draft can vanish while this screen is open (saved, discarded, signed out).
  useEffect(() => {
    if (draft === null && !saving) router.dismissTo('/');
  }, [draft, saving]);

  if (!draft) {
    return (
      <Screen header={<Header title={t('review.title')} />}>
        <DraftPersistenceNotice />
        <ActivityIndicator color={colors.sand} accessibilityLabel={t('common.loading')} />
      </Screen>
    );
  }

  if (draft.analysis) return <MealAnalysisReview />;

  const isCatalog = draft.foodId !== null;
  const food = catalogFood(foods, draft.foodId);
  const unit = draft.basisUnit;
  const problems = draftProblems(draft);
  const amount = parseDecimal(draft.amount);
  const amountOk = !problems.amount && amount !== null;

  const per100: NutritionPer100 | null = isCatalog
    ? food
      ? { ...emptyNutrition(), calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat }
      : null
    : inputsToNutrition(draft.nutrition);
  const portion = per100 && amountOk ? scalePortion(per100, amount) : null;
  const hasOptional = !isCatalog && OPTIONAL_NUTRIENTS.some((key) => draft.nutrition[key].trim() !== '');
  const problem = (key: TKey | undefined) => (showProblems && key ? t(key) : null);

  const onSave = async () => {
    setFailure(null);
    if (!isDraftValid(draft)) {
      setShowProblems(true);
      return;
    }
    try {
      await save();
      // The draft is gone now, which closes this screen (see the effect above).
      toast(t('review.saved'));
    } catch (error) {
      // The draft stays exactly as it is, so the user can try again.
      setFailure(isApiError(error) ? errorMessageKey(error, isCatalog ? 'saveCatalog' : 'saveCustom') : 'review.saveFailed');
    }
  };

  const onDiscard = () =>
    Alert.alert(t('review.discardTitle'), t('review.discardBody'), [
      { text: t('review.keepEditing'), style: 'cancel' },
      {
        text: t('review.discard'),
        style: 'destructive',
        onPress: async () => {
          await discard();
        },
      },
    ]);

  const source: TKey =
    draft.origin === 'photo'
      ? 'review.sourcePhoto'
      : draft.origin === 'catalog'
        ? 'review.sourceCatalog'
        : draft.product
          ? 'review.sourceProduct'
          : 'review.sourceManual';
  const missingAtSource = draft.product?.missingAtLookup ?? [];
  const perLabel = unit === 'ml' ? t('units.per100ml') : t('units.per100g');

  const nutrientField = (key: Nutrient) => (
    <View key={key} style={[styles.half, { minWidth: 140 * Math.min(fontScale, 1.8) }]}>
      <TextField
        testID={`nutrient-${key}`}
        label={t(`nutrients.${key}`)}
        value={draft.nutrition[key]}
        onChangeText={(text) => update({ nutrition: { ...draft.nutrition, [key]: text } })}
        error={problem(problems.nutrition[key])}
        suffix={key === 'calories' ? t('units.kcal') : t('units.g')}
        required={(CORE_NUTRIENTS as readonly string[]).includes(key)}
        ltr
        keyboardType="decimal-pad"
        inputMode="decimal"
        editable={!saving}
      />
    </View>
  );

  return (
    <Screen
      header={<Header title={t('review.title')} leading="close" onLeading={() => router.dismissTo('/')} />}
      footer={
        <>
          <DraftPersistenceNotice />
          {failure ? <Notice tone="error" title={failure==='review.cleanupFailed'?undefined:t('review.notSaved')} message={t(failure)} /> : null}
          <Button
            testID="save-meal"
            label={failure ? t('common.retry') : t('review.save')}
            busyLabel={t('review.saving')}
            icon="check"
            busy={saving}
            onPress={onSave}
          />
        </>
      }>
      {isCatalog ? (
        <View style={styles.foodCard}>
          <AppText style={styles.emoji} maxFontSizeMultiplier={1.3}>
            {food?.emoji ?? '🍽️'}
          </AppText>
          <View style={styles.foodText}>
            <AppText variant="caption" color={colors.muted}>
              {t('review.food')}
            </AppText>
            <AppText variant="heading">{foodName(language, draft.foodId as string, food?.name ?? draft.foodId as string)}</AppText>
          </View>
          <Button
            kind="ghost"
            label={t('review.change')}
            disabled={saving}
            onPress={() => router.push({ pathname: '/add/catalog', params: { replace: '1' } })}
          />
        </View>
      ) : (
        <View style={styles.section}>
          <TextField
            testID="food-name"
            label={draft.product ? t('review.productName') : t('review.food')}
            value={draft.name}
            onChangeText={(name) => update({ name })}
            error={problem(problems.name)}
            required
            maxLength={120}
            editable={!saving}
          />
          {draft.product ? (
            <View style={styles.meta}>
              {draft.brand ? (
                <AppText variant="caption" color={colors.muted}>
                  {t('review.brand')}: {draft.brand}
                </AppText>
              ) : null}
              <AppText variant="caption" color={colors.muted}>
                {t('review.barcode')}: {ltr(draft.product.barcode)}
              </AppText>
            </View>
          ) : null}
        </View>
      )}

      {isCatalog && !food && catalogError ? <Notice tone="warning" message={t('catalog.loadFailed')} /> : null}

      {!isCatalog ? (
        <View style={styles.section}>
          <Segmented
            label={t('review.unit')}
            value={unit}
            onChange={(basisUnit) => update({ basisUnit })}
            disabled={saving}
            options={[
              { value: 'g', label: t('units.per100g') },
              { value: 'ml', label: t('units.per100ml') },
            ]}
          />
          <View style={styles.grid}>{CORE_NUTRIENTS.map(nutrientField)}</View>
          {showMore || hasOptional ? (
            <View style={styles.grid}>{OPTIONAL_NUTRIENTS.map(nutrientField)}</View>
          ) : (
            <Button kind="ghost" icon="plus" label={t('review.moreNutrients')} onPress={() => setShowMore(true)} />
          )}
          {showProblems && CORE_NUTRIENTS.some((key) => problems.nutrition[key]) ? (
            <AppText variant="caption" color={colors.danger}>
              {t('review.missingCore')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <TextField
          testID="amount"
          label={t('review.amount')}
          hint={isCatalog ? t('review.amountHintCatalog') : t('review.amountHintProduct')}
          value={draft.amount}
          onChangeText={(text) => update({ amount: text })}
          error={problem(problems.amount)}
          suffix={unit === 'ml' ? t('units.millilitres') : t('units.grams')}
          required
          ltr
          keyboardType="decimal-pad"
          inputMode="decimal"
          editable={!saving}
        />
        {draft.product?.servingQuantity && draft.product.servingQuantity <= 2000 ? (
          <Button
            kind="secondary"
            label={t('review.useServing', {
              amount: formatQuantity(language, draft.product.servingQuantity, unit),
            })}
            disabled={saving}
            onPress={() => update({ amount: trimNumber(draft.product?.servingQuantity ?? 0) })}
          />
        ) : null}
      </View>

      <Segmented
        label={t('review.meal')}
        value={draft.mealType}
        onChange={(mealType) => update({ mealType })}
        disabled={saving}
        options={MEAL_TYPES.map((value) => ({
          value,
          label: t(`mealTypes.${value}`),
          dot: mealColors[value],
        }))}
      />

      <View style={styles.section}>
        <AppText variant="label" color={colors.muted}>
          {t('review.day')}
        </AppText>
        <View style={styles.dayRow}>
          <DayNav day={draft.day} onChange={(day) => !saving && update({ day })} compact />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="label" color={colors.muted}>
          {t('review.forPortion')}
        </AppText>
        <NutritionGrid
          values={portion ?? {}}
          placeholder={!portion}
          showOptional={!isCatalog && !!portion}
          basisUnit={unit}
        />
        {!portion ? (
          <AppText variant="caption" color={colors.muted}>
            {t('review.enterAmountFirst')}
          </AppText>
        ) : null}
      </View>

      <Notice message={`${t(source)}${isCatalog ? '' : ` ${t('review.labelValues')} ${perLabel}.`}`}>
        {missingAtSource.length ? (
          <AppText variant="caption" color={colors.muted}>
            {t('review.missingFromSource', {
              list: formatList(language, missingAtSource.map((key) => t(`nutrients.${key}`))),
            })}
          </AppText>
        ) : null}
        {draft.origin === 'photo' ? (
          <AppText variant="caption" color={colors.muted}>
            {t('photo.weightNote')}
          </AppText>
        ) : null}
        {draft.product?.sourceUrl ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => Linking.openURL(draft.product?.sourceUrl ?? '')}
            style={styles.link}>
            <Icon name="external-link" size={16} color={colors.sage} />
            <AppText variant="label" color={colors.sage}>
              {t('review.viewSource')}
            </AppText>
          </Pressable>
        ) : null}
      </Notice>

      <Button kind="ghost" label={t('review.discard')} disabled={saving} onPress={onDiscard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  foodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  emoji: { fontSize: 34, lineHeight: 42 },
  foodText: { flex: 1 },
  meta: { gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  half: { flexGrow: 1, flexBasis: '45%', minWidth: 140 },
  dayRow: { backgroundColor: colors.surface, borderRadius: radius.lg, alignItems: 'flex-start', paddingVertical: spacing.xs },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
