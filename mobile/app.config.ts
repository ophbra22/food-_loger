import type { ConfigContext, ExpoConfig } from 'expo/config';

// The backend address is baked in at build time. See .env.example.
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
// Plain HTTP is only for a backend on your own computer or Wi-Fi network.
const voiceMicrophone = 'Biteflow uses the microphone only when you choose to dictate food on this device.';
const voiceEnabled = process.env.EXPO_PUBLIC_VOICE_ENABLED === '1';
const allowsCleartext = apiUrl === '' || apiUrl.startsWith('http://');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Biteflow',
  slug: 'foodlogger',
  owner: 'ophir_braude',
  extra: {
    ...config.extra,
    eas: { ...config.extra?.eas, projectId: '244a63eb-e8cc-4c08-b1d8-2c18d84e7ff7' },
  },
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'foodlogger',
  // One dark look (deep pine), whatever the system theme is.
  userInterfaceStyle: 'dark',
  backgroundColor: '#14251D',
  icon: './assets/images/icon.png',
  // Localized app name and iOS permission texts.
  locales: {
    en: './src/i18n/native/en.json',
    he: './src/i18n/native/he.json',
  },
  ios: {
    usesAppleSignIn: true,
    bundleIdentifier: 'io.github.ophbra22.foodlogger',
    supportsTablet: false,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: 'io.github.ophbra22.foodlogger',
    adaptiveIcon: {
      backgroundColor: '#14251D',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    blockedPermissions: voiceEnabled ? [] : ['android.permission.RECORD_AUDIO'],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    ['./plugins/with-on-device-speech.cjs', {enabled: voiceEnabled}],
    ...(voiceEnabled ? [['expo-speech-recognition', {
      microphonePermission: 'Biteflow uses the microphone only when you choose to dictate food on this device.',
      speechRecognitionPermission: 'Biteflow converts your food description to editable text on this device.',
      androidSpeechServicePackages: ['com.google.android.as'],
    }] as [string, Record<string, unknown>]] : []),
    ['expo-notifications', {defaultChannel:'biteflow-reminders', enableBackgroundRemoteNotifications:false}],
    'expo-apple-authentication',
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#14251D', image: './assets/images/splash-icon.png', imageWidth: 120 },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Biteflow uses the camera to photograph food and scan product barcodes.',
        microphonePermission: voiceEnabled ? voiceMicrophone : false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Biteflow reads the photo you choose to suggest a food or read a barcode.',
        cameraPermission:
          'Biteflow uses the camera to photograph food and scan product barcodes.',
        microphonePermission: voiceEnabled ? voiceMicrophone : false,
      },
    ],
    // Direction is switched at runtime from the in-app language setting, so
    // supportsRTL/forcesRTL stay unset: setting them resets that choice on launch.
    ['expo-localization', { supportedLocales: ['en', 'he'] }],
    'expo-secure-store',
    'expo-sharing',
    [
      'expo-build-properties',
      {
        ios: { enableSceneSupport: true },
        android: { usesCleartextTraffic: allowsCleartext },
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
});
