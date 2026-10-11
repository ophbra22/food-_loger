import { ReactNode, createContext, useContext } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/tokens';

/**
 * True for screens shown inside the "add a meal" modal. On iOS that modal is a
 * sheet that already starts below the status bar, so the top safe-area inset
 * must not be added a second time.
 */
export const SheetContext = createContext(false);

type Props = {
  children: ReactNode;
  /** Fixed above the scrolling content. */
  header?: ReactNode;
  /** Fixed below the scrolling content; stays above the keyboard. */
  footer?: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  edges?: Edge[];
  padded?: boolean;
};

/** Page frame: safe areas, the pine ground, and content that moves out of the keyboard's way. */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  refreshControl,
  edges,
  padded = true,
}: Props) {
  const inSheet = useContext(SheetContext);
  const safeEdges: Edge[] =
    edges ?? (inSheet && Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']);
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, padded && styles.padded]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {header}
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  flex: { flex: 1 },
  content: { flexGrow: 1, gap: spacing.lg, paddingBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm },
});
