import Feather from '@expo/vector-icons/Feather';
import { ComponentProps } from 'react';
import { I18nManager } from 'react-native';

import { colors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Feather>['name'];

type Props = { name: IconName; size?: number; color?: string };

/** One icon family (Feather) throughout, so stroke weight and corners stay consistent. */
export function Icon({ name, size = 22, color = colors.sand }: Props) {
  return <Feather name={name} size={size} color={color} />;
}

/** Arrows that mean "back" and "forward" point with the reading direction. */
export const directional = {
  get back(): IconName {
    return I18nManager.isRTL ? 'chevron-right' : 'chevron-left';
  },
  get forward(): IconName {
    return I18nManager.isRTL ? 'chevron-left' : 'chevron-right';
  },
};
