import { useState } from 'react';

import { errorMessageKey } from '@/api/messages';
import { useAuth } from '@/auth/AuthProvider';
import { AuthIntro, FormStack } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import {
  cleanRecoveryCode,
  validatePassword,
  validateRecoveryCode,
  validateUsername,
} from '@/domain/validation';
import { useI18n } from '@/i18n/I18nProvider';
import type { TKey } from '@/i18n/translate';

export default function Recover() {
  const { t } = useI18n();
  const { recover } = useAuth();
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<TKey | null>(null);

  const usernameError = validateUsername(username);
  const codeError = validateRecoveryCode(code);
  const passwordError = validatePassword(password);

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (usernameError || codeError || passwordError) return;
    setBusy(true);
    try {
      // On success the app shows the new recovery code before opening the journal.
      await recover(username, cleanRecoveryCode(code), password);
    } catch (error) {
      setFailure(errorMessageKey(error, 'recover'));
      setBusy(false);
    }
  };

  return (
    <Screen header={<Header title="" />}>
      <AuthIntro title={t('auth.recoverTitle')} body={t('auth.recoverBody')} />
      {failure ? <Notice tone="error" message={t(failure)} /> : null}
      <FormStack>
        <TextField
          testID="username"
          label={t('auth.username')}
          value={username}
          onChangeText={setUsername}
          error={submitted && usernameError ? t(usernameError) : null}
          ltr
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          editable={!busy}
        />
        <TextField
          testID="recovery-code"
          label={t('auth.recoveryCode')}
          hint={t('auth.recoveryCodeHint')}
          value={code}
          onChangeText={setCode}
          error={submitted && codeError ? t(codeError) : null}
          ltr
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          editable={!busy}
        />
        <TextField
          testID="password"
          label={t('auth.newPassword')}
          hint={t('auth.passwordHint')}
          value={password}
          onChangeText={setPassword}
          error={submitted && passwordError ? t(passwordError) : null}
          ltr
          secret
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!busy}
        />
        <Button testID="submit" label={t('auth.resetPassword')} onPress={submit} busy={busy} />
      </FormStack>
    </Screen>
  );
}
