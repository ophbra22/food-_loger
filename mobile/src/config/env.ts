import { Platform } from 'react-native';

const clean = (value: string | undefined) => (value ?? '').trim().replace(/\/+$/, '');

/** Address compiled into the build from EXPO_PUBLIC_API_URL (see .env.example). */
const builtIn = clean(process.env.EXPO_PUBLIC_API_URL);

/** In a development build with nothing configured, assume a backend on this computer. */
const developmentDefault = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

export const DEFAULT_API_URL = builtIn || (__DEV__ ? developmentDefault : '');

export const STAGING_BUILD = process.env.EXPO_PUBLIC_STAGING_BUILD === '1';

/** Test builds may point the app at another server from Settings. Never on in store builds. */
export const ALLOW_SERVER_OVERRIDE =
  !STAGING_BUILD && (__DEV__ || process.env.EXPO_PUBLIC_ALLOW_SERVER_OVERRIDE === '1');

/** An origin such as `https://host` or `http://192.168.1.5:8000`, without a path. */
export function normalizeServerUrl(value: string): string | null {
  const text = clean(value);
  return /^https?:\/\/[A-Za-z0-9.\-[\]:]+$/.test(text) ? text : null;
}
