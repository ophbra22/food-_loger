import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n/I18nProvider';
import { spacing, touch } from '@/theme/tokens';

import { AppText } from './AppText';
import { directional } from './Icon';
import { IconButton } from './IconButton';

type Props = {
  title: string;
  /** "back" steps back in the stack, "close" leaves a modal flow. */
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  trailing?: ReactNode;
};

export function Header({ title, leading = 'back', onLeading, trailing }: Props) {
  const { t } = useI18n();
  const leave = onLeading ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.row}>
      {leading === 'none' ? (
        <View style={styles.spacer} />
      ) : (
        <IconButton
          icon={leading === 'close' ? 'x' : directional.back}
          label={leading === 'close' ? t('common.close') : t('common.back')}
          onPress={leave}
        />
      )}
      <AppText variant="heading" center accessibilityRole="header" style={styles.title} numberOfLines={2}>
        {title}
      </AppText>
      {trailing ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minHeight: touch + spacing.sm,
  },
  title: { flex: 1 },
  spacer: { width: touch },
});
