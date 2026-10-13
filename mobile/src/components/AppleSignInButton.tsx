import * as Apple from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { isApiError } from '@/api/errors';
import { errorMessageKey } from '@/api/messages';
import { useI18n } from '@/i18n/I18nProvider';
import type { TKey } from '@/i18n/translate';
import { colors, spacing } from '@/theme/tokens';
import { Notice } from './Notice';

export function AppleSignInButton({ onPress, disabled = false }: {
  onPress: () => Promise<void>; disabled?: boolean;
}) {
  const { t } = useI18n();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  useEffect(() => {
    let mounted = true;
    if (Platform.OS === 'ios') Apple.isAvailableAsync()
      .then(value => { if (mounted) setAvailable(value); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  if (!available) return null;
  const submit = async () => {
    if (busy || disabled) return;
    setBusy(true); setError(null);
    try { await onPress(); }
    catch (failure) {
      if ((failure as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        setError(isApiError(failure) && failure.kind === 'conflict' ? 'apple.conflict'
          : isApiError(failure) && failure.kind === 'forbidden' ? 'apple.invalid'
          : isApiError(failure) ? errorMessageKey(failure) : 'apple.failed');
      }
    } finally { setBusy(false); }
  };
  return <View style={{ gap: spacing.sm }}>
    {error ? <Notice tone="error" message={t(error)} /> : null}
    <View pointerEvents={busy || disabled ? 'none' : 'auto'}
      accessibilityState={{ disabled: busy || disabled, busy }} style={{ opacity: busy || disabled ? 0.5 : 1 }}>
      <Apple.AppleAuthenticationButton
        buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={Apple.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={12} style={{ width: '100%', height: 50 }} onPress={submit} />
    </View>
    {busy ? <ActivityIndicator color={colors.sage} accessibilityLabel={t('apple.working')} /> : null}
  </View>;
}
