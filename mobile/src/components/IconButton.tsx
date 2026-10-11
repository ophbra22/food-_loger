import { Pressable, StyleSheet } from 'react-native';

import { colors, touch } from '@/theme/tokens';

import { Icon, IconName } from './Icon';

type Props = {
  icon: IconName;
  /** Read by screen readers; an icon alone says nothing. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
  filled?: boolean;
  color?: string;
  testID?: string;
};

export function IconButton({ icon, label, onPress, disabled, filled, color, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        filled && styles.filled,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <Icon name={icon} color={color ?? colors.sand} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touch,
    height: touch,
    borderRadius: touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.surface },
  pressed: { backgroundColor: colors.field },
  disabled: { opacity: 0.35 },
});
