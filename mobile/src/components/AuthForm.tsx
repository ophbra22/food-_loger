import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

/** Shared top of the sign-in, register and recovery screens. */
export function AuthIntro({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.intro}>
      <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no">
        <View style={styles.ring}>
          <View style={styles.core} />
          <View style={[styles.dot, styles.dotA]} />
          <View style={[styles.dot, styles.dotB]} />
          <View style={[styles.dot, styles.dotC]} />
        </View>
      </View>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      {body ? (
        <AppText variant="body" color={colors.muted}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

export function FormStack({ children }: { children: ReactNode }) {
  return <View style={styles.form}>{children}</View>;
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm, paddingTop: spacing.xl },
  // Sits at the reading edge; its own geometry is never mirrored.
  mark: { marginBottom: spacing.md, direction: 'ltr', alignSelf: 'flex-start' },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 9,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.sage },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ground },
  dotA: { backgroundColor: colors.butter, top: 6, right: -8 },
  dotB: { backgroundColor: colors.rose, bottom: -10, left: 20 },
  dotC: { backgroundColor: colors.lilac, top: 14, left: -11 },
  form: { gap: spacing.lg },
});
