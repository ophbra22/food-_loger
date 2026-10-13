import { Pressable, StyleSheet, View } from 'react-native';

import type { Meal } from '@/api/types';
import { consumedAt } from '@/domain/dial';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber, formatQuantity, formatTime } from '@/i18n/format';
import { foodName } from '@/i18n/translate';
import { colors, mealColors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = { meal: Meal; onPress: () => void };

/** Name of a saved meal: catalog foods are translated, products and manual entries are shown as saved. */
export function useMealName() {
  const { language } = useI18n();
  return (meal: Pick<Meal, 'food_id' | 'name'>) => foodName(language, meal.food_id, meal.name);
}

export function MealRow({ meal, onPress }: Props) {
  const { t, language } = useI18n();
  const name = useMealName()(meal);
  const amount = formatQuantity(language, meal.grams, meal.details.basis_unit ?? 'g');
  const details = [
    t(`mealTypes.${meal.meal_type}`),
    // The clock time is shown only when the meal was logged on the day it belongs to.
    consumedAt(meal) ? formatTime(language, consumedAt(meal)!, meal.details.timezone_id ?? undefined) : null,
    amount,
  ].filter(Boolean);
  const kcal = formatNumber(language, meal.calories);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('a11y.mealRow', { name, amount, kcal })}. ${t(`mealTypes.${meal.meal_type}`)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.dot, { backgroundColor: mealColors[meal.meal_type] }]} />
      <AppText style={styles.emoji} maxFontSizeMultiplier={1.3}>
        {meal.emoji}
      </AppText>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{name}</AppText>
        <AppText variant="caption" color={colors.muted}>
          {details.join(' · ')}
        </AppText>
      </View>
      <AppText variant="number">{kcal}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  pressed: { backgroundColor: colors.field },
  dot: { width: 12, height: 12, borderRadius: 6 },
  emoji: { fontSize: 24, lineHeight: 30 },
  text: { flex: 1, gap: 1 },
});
