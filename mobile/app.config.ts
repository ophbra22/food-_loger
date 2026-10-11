import type { ConfigContext, ExpoConfig } from 'expo/config';

// The backend address is baked in at build time. See .env.example.
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
// Plain HTTP is only for a backend on your own computer or Wi-Fi network.
const allowsCleartext = apiUrl === '' || apiUrl.startsWith('http://');

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'FoodLogger',
  slug: 'foodlogger',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'foodlogger',
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  // Localized app name and iOS permission texts.
  locales: {
    en: './src/i18n/native/en.json',
    he: './src/i18n/native/he.json',
  },
  ios: {
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
      backgroundColor: '#34513D',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#F1EFE7', image: './assets/images/splash-icon.png', imageWidth: 96 },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'FoodLogger uses the camera to photograph food and scan product barcodes.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'FoodLogger reads the photo you choose to suggest a food or read a barcode.',
        cameraPermission:
          'FoodLogger uses the camera to photograph food and scan product barcodes.',
        microphonePermission: false,
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
