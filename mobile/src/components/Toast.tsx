import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Show = (message: string) => void;

const ToastContext = createContext<Show>(() => undefined);

/** A short confirmation, such as "Saved to your journal". Also read out by screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback<Show>((text) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    AccessibilityInfo.announceForAccessibility(text);
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { top: insets.top + spacing.sm }]}>
          <View style={styles.toast}>
            <Icon name="check-circle" color={colors.ground} size={20} />
            <AppText variant="bodyStrong" color={colors.ground} style={styles.text}>
              {message}
            </AppText>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.sand,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: 480,
  },
  text: { flexShrink: 1 },
});
