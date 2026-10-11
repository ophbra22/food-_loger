import { useEffect, useState } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { formatDay, ltr, relativeDayLabel } from '@/i18n/format';
import { todayIso } from '@/domain/dates';

/**
 * Temporary foundation check, replaced by the real screens once the visual
 * direction is chosen. It proves the build, the language and direction switch,
 * and the connection to the backend.
 */
export default function FoundationCheck() {
  const { t, language, setLanguage } = useI18n();
  const { api, serverUrl, status } = useAuth();
  const [server, setServer] = useState('…');

  useEffect(() => {
    api
      .health()
      .then((health) => setServer(t('settings.serverOk', { version: health.version })))
      .catch(() => setServer(t('settings.serverFail')));
  }, [api, t]);

  const today = todayIso();
  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>{t('common.appName')}</Text>
      <Text style={styles.line}>
        {relativeDayLabel(language, today)}, {formatDay(language, today)}
      </Text>
      <Text style={styles.line}>{t('home.items', { count: 2 })}</Text>
      <Text style={styles.line}>
        {t('settings.server')}: {ltr(serverUrl)}
      </Text>
      <Text style={styles.line}>{server}</Text>
      <Text style={styles.line}>
        isRTL={String(I18nManager.isRTL)} · auth={status}
      </Text>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setLanguage('he')}>
          <Text style={styles.buttonText}>{t('settings.hebrew')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setLanguage('en')}>
          <Text style={styles.buttonText}>{t('settings.english')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F1EFE7', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '800', color: '#1D2821', textAlign: 'left' },
  line: { fontSize: 17, color: '#1D2821', textAlign: 'left' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  button: { backgroundColor: '#34513D', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28 },
  buttonText: { color: '#F6F4EA', fontSize: 17, fontWeight: '700' },
});
