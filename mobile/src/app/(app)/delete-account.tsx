import { useState } from 'react';
import { Alert, Keyboard, Platform } from 'react-native';

import { isApiError } from '@/api/errors';
import { errorMessageKey } from '@/api/messages';
import { useAuth } from '@/auth/AuthProvider';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { validatePassword } from '@/domain/validation';
import { useI18n } from '@/i18n/I18nProvider';
import type { TKey } from '@/i18n/translate';

export default function DeleteAccount() {
  const { t } = useI18n();
  const { deleteAccount, deleteWithApple, user } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const confirm = () => {
    const invalid = validatePassword(password);
    if (invalid) { setError(invalid); return; }
    Keyboard.dismiss();
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.deleteConfirm'), style: 'destructive', onPress: async () => {
        setBusy(true);
        setError(null);
        try { await deleteAccount(password); }
        catch (failure) {
          setError(isApiError(failure) && failure.kind === 'forbidden'
            ? 'settings.deleteWrongPassword'
            : isApiError(failure) && failure.outcomeUnknown
              ? 'settings.deleteUnknown' : errorMessageKey(failure));
          setBusy(false);
        }
      } },
    ]);
  };
  if (user?.apple_linked && Platform.OS === 'ios') return (
    <Screen header={<Header title={t('settings.deleteAccount')} />}>
      <AppText>{t('settings.deleteBody')}</AppText>
      <AppText>{t('apple.deleteHint')}</AppText>
      <AppleSignInButton onPress={async () => {
        const confirmed = await new Promise<boolean>(resolve => Alert.alert(
          t('settings.deleteAccount'), t('settings.deleteBody'), [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('settings.deleteConfirm'), style: 'destructive', onPress: () => resolve(true) },
          ], { cancelable: true, onDismiss: () => resolve(false) }));
        if (confirmed) await deleteWithApple();
      }} />
    </Screen>
  );
  return (
    <Screen header={<Header title={t('settings.deleteAccount')} />}>
      <AppText>{t('settings.deleteBody')}</AppText>
      <TextField testID="delete-password" label={t('settings.deletePassword')} secret ltr
        autoCapitalize="none" autoCorrect={false} autoComplete="current-password"
        value={password} onChangeText={setPassword} editable={!busy} />
      {error ? <Notice tone="error" message={t(error)} /> : null}
      <Button testID="confirm-delete-account" kind="danger" label={t('settings.deleteConfirm')}
        busy={busy} onPress={confirm} />
    </Screen>
  );
}
