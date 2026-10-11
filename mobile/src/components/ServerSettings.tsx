import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { normalizeServerUrl } from '@/config/env';
import { useI18n } from '@/i18n/I18nProvider';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './TextField';

/**
 * Test builds only: point the app at another FoodLogger server, for example the
 * computer's address on the Wi-Fi network when testing on a real phone.
 */
export function ServerSettings() {
  const { t } = useI18n();
  const { serverUrl, setServerUrl, api, user } = useAuth();
  const [address, setAddress] = useState(serverUrl);
  const [invalid, setInvalid] = useState(false);
  const [check, setCheck] = useState<string | null>(null);

  const apply = async (value: string | null) => {
    setCheck(null);
    if (value !== null && !normalizeServerUrl(value)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    await setServerUrl(value);
  };
  const checkServer = async () => {
    setCheck('…');
    try {
      const health = await api.health();
      setCheck(t('settings.serverOk', { version: health.version }));
    } catch {
      setCheck(t('settings.serverFail'));
    }
  };

  return (
    <View style={styles.card}>
      <AppText variant="label" color={colors.muted} accessibilityRole="header">
        {t('settings.server')}
      </AppText>
      <TextField
        testID="server-address"
        label={t('settings.serverAddress')}
        hint={t('settings.serverHint')}
        value={address}
        onChangeText={(text) => {
          setAddress(text);
          setInvalid(false);
        }}
        error={invalid ? t('settings.serverInvalid') : null}
        ltr
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {user ? (
        <AppText variant="caption" color={colors.muted}>
          {t('settings.serverChangeNote')}
        </AppText>
      ) : null}
      <Button kind="secondary" label={t('settings.serverSave')} onPress={() => apply(address)} />
      <Button kind="ghost" label={t('settings.serverCheck')} onPress={checkServer} />
      <Button kind="ghost" label={t('settings.serverReset')} onPress={() => apply(null)} />
      {check ? (
        <AppText variant="caption" color={colors.muted} accessibilityLiveRegion="polite">
          {check}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
});
