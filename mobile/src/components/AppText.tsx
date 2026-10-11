import { Text, TextProps, TextStyle } from 'react-native';

import { TypeVariant, colors, type } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
  /** Centre the text. The default follows the reading direction. */
  center?: boolean;
  /** Keep codes, addresses and numbers left-to-right inside Hebrew screens. */
  ltr?: boolean;
};

/**
 * All text in the app. `textAlign: 'left'` is mirrored by React Native in
 * right-to-left layouts, so text always starts at the reading edge.
 */
export function AppText({ variant = 'body', color, center, ltr, style, ...rest }: Props) {
  const base: TextStyle = {
    ...type[variant],
    color: color ?? colors.sand,
    textAlign: center ? 'center' : 'left',
    ...(ltr ? { writingDirection: 'ltr' } : null),
  };
  return (
    <Text
      // Large text is supported; the cap keeps a single word from filling the screen.
      maxFontSizeMultiplier={variant === 'display' ? 1.3 : 1.8}
      {...rest}
      style={[base, style]}
    />
  );
}
