import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/Toast';
import { DraftProvider } from '@/data/DraftProvider';
import { I18nProvider, loadInitialLanguage } from '@/i18n/I18nProvider';
import { ensureDirection } from '@/i18n/direction';
import type { Language } from '@/i18n/translate';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [language, setLanguage] = useState<Language | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
  });

  useEffect(() => {
    (async () => {
      const initial = await loadInitialLanguage();
      // The splash screen stays up while the layout direction is matched to the language.
      const direction = await ensureDirection(initial);
      if (direction !== 'reloading') setLanguage(initial);
    })();
  }, []);

  // If the font files fail to load the app still opens, in the system font.
  if (!language || (!fontsLoaded && !fontError)) return null;
  return (
    <SafeAreaProvider>
      <I18nProvider initial={language}>
        <AuthProvider>
          <DraftProvider>
            <ToastProvider>
              <StatusBar style="light" />
              <Navigator />
            </ToastProvider>
          </DraftProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

function Navigator() {
  const { status, pendingRecoveryCode } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';
  const mustSaveCode = signedIn && pendingRecoveryCode !== null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={signedIn && !mustSaveCode}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* A new recovery code is shown once and must be acknowledged before the journal opens. */}
      <Stack.Protected guard={mustSaveCode}>
        <Stack.Screen name="recovery-code" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="register" />
        <Stack.Screen name="recover" />
        <Stack.Screen name="server" />
      </Stack.Protected>
    </Stack>
  );
}
