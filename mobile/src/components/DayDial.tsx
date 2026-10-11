import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

import type { Meal } from '@/api/types';
import { dialDots, dialPoint } from '@/domain/dial';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, fonts, mealColors } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

const SIZE = 300;
const CENTRE = SIZE / 2;
const RING = 124;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LABELS = [0, 6, 12, 18];

type Props = {
  meals: Meal[];
  onAdd: () => void;
  onOpenMeal: (meal: Meal) => void;
  addDisabled?: boolean;
};

/**
 * The day as a 24-hour ring with a dot per meal and the add button at its centre.
 * A clock is never mirrored, so the ring looks the same in Hebrew and English.
 */
export function DayDial({ meals, onAdd, onOpenMeal, addDisabled }: Props) {
  const { t } = useI18n();
  const dots = dialDots(meals);
  const byId = new Map(meals.map((meal) => [meal.id, meal]));
  return (
    <View style={styles.wrap}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`-14 -14 ${SIZE + 28} ${SIZE + 28}`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('a11y.dial')}>
        <Circle cx={CENTRE} cy={CENTRE} r={RING} stroke={colors.surface} strokeWidth={26} fill="none" />
        {HOURS.map((hour) => {
          const major = hour % 6 === 0;
          const from = dialPoint(hour * 60, RING - 13, CENTRE);
          const to = dialPoint(hour * 60, RING - (major ? 3 : 9), CENTRE);
          return (
            <Line
              key={hour}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={colors.muted}
              strokeOpacity={major ? 0.9 : 0.35}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}
        {LABELS.map((hour) => {
          const point = dialPoint(hour * 60, RING + 22, CENTRE);
          return (
            <SvgText
              key={hour}
              x={point.x}
              y={point.y + 4}
              fill={colors.muted}
              fontSize={12}
              fontFamily={fonts.regular}
              textAnchor="middle">
              {String(hour).padStart(2, '0')}
            </SvgText>
          );
        })}
        {dots.map((dot) => {
          const point = dialPoint(dot.minutes, RING, CENTRE);
          const meal = byId.get(dot.id);
          return (
            <Circle
              key={dot.id}
              cx={point.x}
              cy={point.y}
              r={dot.radius}
              fill={mealColors[dot.mealType]}
              stroke={colors.ground}
              strokeWidth={3}
              onPress={meal ? () => onOpenMeal(meal) : undefined}
            />
          );
        })}
      </Svg>
      <Pressable
        testID="add-meal"
        accessibilityRole="button"
        accessibilityLabel={t('home.addMeal')}
        accessibilityState={{ disabled: !!addDisabled }}
        disabled={addDisabled}
        onPress={onAdd}
        style={({ pressed }) => [styles.core, pressed && styles.pressed, addDisabled && styles.disabled]}>
        <Icon name="plus" size={34} color={colors.onSage} />
        <AppText variant="label" color={colors.onSage} center maxFontSizeMultiplier={1.25}>
          {t('home.addMeal')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // The dial keeps its left-to-right geometry even when the app layout is mirrored.
  wrap: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    direction: 'ltr',
  },
  core: {
    width: '46%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
});
