import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessageKey } from '@/api/messages';
import type { CatalogFood } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useDraft } from '@/data/DraftProvider';
import { getAddIntent } from '@/data/add-intent';
import { useCatalog } from '@/data/catalog';
import { catalogDraft } from '@/domain/drafts';
import { useI18n } from '@/i18n/I18nProvider';
import { formatNumber } from '@/i18n/format';
import { foodName } from '@/i18n/translate';
import type { TKey } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

const CATEGORY_ORDER = ['Fruit', 'Vegetables', 'Meals', 'Bakery', 'Dessert'];

/** Pick a food from the catalog. `replace=1` means the review screen asked for a different food. */
export default function CatalogPicker() {
  const { t, language } = useI18n();
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const { foods, loading, error, reload } = useCatalog();
  const { draft, start, newKey } = useDraft();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matches = (foods ?? []).filter((food) => {
      if (!text) return true;
      // Search works in both languages whatever the app language is.
      return (
        food.name.toLowerCase().includes(text) ||
        foodName('he', food.id, food.name).includes(text) ||
        foodName('en', food.id, food.name).toLowerCase().includes(text)
      );
    });
    const byCategory = new Map<string, CatalogFood[]>();
    for (const food of matches) {
      byCategory.set(food.category, [...(byCategory.get(food.category) ?? []), food]);
    }
    return [...byCategory.entries()].sort(
      ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
    );
  }, [foods, query]);

  const choose = async (food: CatalogFood) => {
    // "Change" on the review screen swaps the food and keeps the day, meal and amount.
    const previous = replace === '1' && draft?.foodId ? draft : null;
    // A food chosen here was picked by hand, even if a photo came first.
    const next = catalogDraft(newKey(), food.id, 'catalog', {
      day: previous?.day ?? getAddIntent().day,
      mealType: previous?.mealType ?? getAddIntent().mealType,
    });
    await start({ ...next, amount: previous?.amount ?? '' });
    router.replace('/add/review');
  };

  const categoryLabel = (category: string) => {
    const key = `catalog.categories.${category}` as TKey;
    const label = t(key);
    return label === key ? category : label;
  };

  return (
    <Screen header={<Header title={t('catalog.title')} />}>
      <TextField
        testID="catalog-search"
        label={t('catalog.searchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <AppText variant="caption" color={colors.muted}>
        {t('catalog.estimateNote')}
      </AppText>

      {loading && !foods ? <ActivityIndicator color={colors.sand} accessibilityLabel={t('common.loading')} /> : null}
      {error ? (
        <Notice tone="error" title={t('catalog.loadFailed')} message={t(errorMessageKey(error))}>
          <Button kind="secondary" label={t('common.retry')} onPress={reload} />
        </Notice>
      ) : null}
      {foods && groups.length === 0 ? (
        <AppText color={colors.muted} center>
          {t('catalog.noMatch', { query: query.trim() })}
        </AppText>
      ) : null}

      {groups.map(([category, items]) => (
        <View key={category} style={styles.group}>
          <AppText variant="label" color={colors.muted} accessibilityRole="header">
            {categoryLabel(category)}
          </AppText>
          {items.map((food) => {
            const name = foodName(language, food.id, food.name);
            const kcal = t('catalog.kcalPer100', { kcal: formatNumber(language, food.calories) });
            return (
              <Pressable
                key={food.id}
                testID={`food-${food.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${kcal}`}
                onPress={() => choose(food)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <AppText style={styles.emoji} maxFontSizeMultiplier={1.3}>
                  {food.emoji}
                </AppText>
                <View style={styles.text}>
                  <AppText variant="bodyStrong">{name}</AppText>
                  <AppText variant="caption" color={colors.muted}>
                    {kcal}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  pressed: { backgroundColor: colors.field },
  emoji: { fontSize: 24, lineHeight: 30 },
  text: { flex: 1 },
});
