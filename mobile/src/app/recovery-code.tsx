import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, fonts, radius, spacing, touch } from '@/theme/tokens';

/** Shown once after creating an account or resetting the password. */
export default function RecoveryCode() {
  const { t } = useI18n();
  const toast = useToast();
  const { pendingRecoveryCode, confirmRecoveryCodeSaved } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const code = pendingRecoveryCode ?? '';

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    toast(t('recoveryCode.copied'));
  };

  return (
    <Screen
      footer={
        <Button
          testID="continue"
          label={t('recoveryCode.continue')}
          disabled={!confirmed}
          busy={busy}
          onPress={async () => {
            setBusy(true);
            await confirmRecoveryCodeSaved();
          }}
        />
      }>
      <View style={styles.intro}>
        <AppText variant="title" accessibilityRole="header">
          {t('recoveryCode.title')}
        </AppText>
        <AppText variant="body" color={colors.muted}>
          {t('recoveryCode.body')}
        </AppText>
      </View>

      <View style={styles.codeBox}>
        <AppText variant="label" color={colors.muted}>
          {t('recoveryCode.label')}
        </AppText>
        {/* Always left-to-right, selectable, and never translated or reformatted. */}
        <AppText
          testID="recovery-code"
          variant="bodyStrong"
          ltr
          selectable
          style={styles.code}
          accessibilityLabel={`${t('recoveryCode.label')}: ${code.split('').join(' ')}`}>
          {code}
        </AppText>
        <Button kind="secondary" icon="copy" label={t('recoveryCode.copy')} onPress={copy} />
      </View>

      <Notice tone="warning" message={t('recoveryCode.warning')} />

      <Pressable
        testID="confirm-saved"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        accessibilityLabel={t('recoveryCode.confirm')}
        onPress={() => setConfirmed((value) => !value)}
        style={styles.check}>
        <View style={[styles.box, confirmed && styles.boxOn]}>
          {confirmed ? <Icon name="check" size={18} color={colors.onSage} /> : null}
        </View>
        <AppText variant="body" style={styles.checkText}>
          {t('recoveryCode.confirm')}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: spacing.sm, paddingTop: spacing.xxl },
  codeBox: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  code: { fontFamily: fonts.mono, fontSize: 18, lineHeight: 28, letterSpacing: 1, textAlign: 'left' },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touch },
  box: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.sage, borderColor: colors.sage },
  checkText: { flex: 1 },
});
