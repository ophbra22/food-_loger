import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { ServerSettings } from '@/components/ServerSettings';
import { ALLOW_SERVER_OVERRIDE } from '@/config/env';
import { useDraft } from '@/data/DraftProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ltr } from '@/i18n/format';
import type { Language } from '@/i18n/translate';
import { colors, radius, spacing } from '@/theme/tokens';

export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { user, signOut, linkApple } = useAuth();
  const { draft } = useDraft();
  const [switching, setSwitching] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const changeLanguage = async (next: Language) => {
    if (next === language || switching) return;
    setSwitching(true);
    // The draft is already on disk, so the reload that flips the layout loses nothing.
    const result = await setLanguage(next);
    if (result === 'restart-needed') setRestartNeeded(true);
    if (result !== 'reloading') setSwitching(false);
  };

  const confirmSignOut = () =>
    Alert.alert(
      t('settings.signOutTitle'),
      `${t('settings.signOutBody')}${draft ? `\n\n${t('settings.signOutUnsaved')}` : ''}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            await signOut();
          },
        },
      ],
    );

  return (
    <Screen header={<Header title={t('settings.title')} />}>
      <Button label={t('recipes.title')} onPress={()=>router.push('/recipes')}/>
      <Button label={t('goals.title')} onPress={() => router.push('/goals')} />
      <View style={styles.card}>
        <Segmented
          label={t('settings.language')}
          value={language}
          onChange={changeLanguage}
          disabled={switching}
          options={[
            { value: 'he', label: t('settings.hebrew') },
            { value: 'en', label: t('settings.english') },
          ]}
        />
        <AppText variant="caption" color={colors.muted}>
          {t('settings.languageNote')}
        </AppText>
        {restartNeeded ? <Notice tone="warning" message={t('settings.restartNeeded')} /> : null}
      </View>

      <View style={styles.card}>
        <AppText variant="label" color={colors.muted} accessibilityRole="header">
          {t('settings.account')}
        </AppText>
        <View accessible accessibilityLabel={`${t('settings.signedInAs')} ${user?.username ?? ''}`}>
          <AppText variant="caption" color={colors.muted}>
            {t('settings.signedInAs')}
          </AppText>
          <AppText testID="account-name" variant="heading">
            {ltr(user?.username ?? '')}
          </AppText>
        </View>
        {Platform.OS === 'ios' && (user?.apple_linked ? <Notice tone="info" message={t('apple.linked')} /> : <>
          <AppText variant="caption" color={colors.muted}>{t('apple.linkHint')}</AppText>
          <AppleSignInButton onPress={linkApple} disabled={signingOut} />
        </>)}
        <Button
          testID="sign-out"
          kind="danger"
          icon="log-out"
          label={t('settings.signOut')}
          busy={signingOut}
          onPress={confirmSignOut}
        />
      </View>

      <Button testID="delete-account" kind="danger" label={t('settings.deleteAccount')}
        onPress={() => router.push('/delete-account')} />

      {ALLOW_SERVER_OVERRIDE ? <ServerSettings /> : null}

      <View style={styles.card}>
        <AppText variant="label" color={colors.muted} accessibilityRole="header">
          {t('settings.about')}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {t('settings.privacyNote')}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {t('settings.nutritionNote')}
        </AppText>
        <AppText variant="caption" color={colors.muted}>
          {t('settings.version')} {ltr(Constants.expoConfig?.version ?? '')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
});
