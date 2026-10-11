import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessageKey } from '@/api/messages';
import { useAuth } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { AuthIntro, FormStack } from '@/components/AuthForm';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { validatePassword, validateUsername } from '@/domain/validation';
import { useI18n } from '@/i18n/I18nProvider';
import type { TKey } from '@/i18n/translate';
import { colors, spacing } from '@/theme/tokens';

export default function Register() {
  const { t } = useI18n();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<TKey | null>(null);

  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (usernameError || passwordError) return;
    setBusy(true);
    try {
      // On success the app moves to the recovery-code screen by itself.
      await register(username, password);
    } catch (error) {
      setFailure(errorMessageKey(error, 'register'));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <AuthIntro title={t('auth.registerTitle')} body={t('auth.tagline')} />
      {failure ? <Notice tone="error" message={t(failure)} /> : null}
      <FormStack>
        <TextField
          testID="username"
          label={t('auth.username')}
          hint={t('auth.usernameHint')}
          value={username}
          onChangeText={setUsername}
          error={submitted && usernameError ? t(usernameError) : null}
          ltr
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          editable={!busy}
        />
        <TextField
          testID="password"
          label={t('auth.password')}
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
          returnKeyType="go"
          onSubmitEditing={submit}
          editable={!busy}
        />
        <Button testID="submit" label={t('auth.createAccount')} onPress={submit} busy={busy} />
      </FormStack>
      <View style={styles.links}>
        <Link href="/sign-in" replace accessibilityRole="link">
          <AppText variant="bodyStrong" color={colors.sage} center>
            {t('auth.toSignIn')}
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { alignItems: 'center', paddingTop: spacing.md },
});
