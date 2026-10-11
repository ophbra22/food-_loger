import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';

import { AuthProvider } from '@/auth/AuthProvider';
import { DraftProvider } from '@/data/DraftProvider';
import { I18nProvider, loadInitialLanguage } from '@/i18n/I18nProvider';
import { ensureDirection } from '@/i18n/direction';
import type { Language } from '@/i18n/translate';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [language, setLanguage] = useState<Language | null>(null);

  useEffect(() => {
    (async () => {
      const initial = await loadInitialLanguage();
      // The splash screen stays up while the layout direction is matched to the language.
      const direction = await ensureDirection(initial);
      if (direction !== 'reloading') setLanguage(initial);
    })();
  }, []);

  useEffect(() => {
    if (language) SplashScreen.hideAsync();
  }, [language]);

  if (!language) return null;
  return (
    <I18nProvider initial={language}>
      <AuthProvider>
        <DraftProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DraftProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
