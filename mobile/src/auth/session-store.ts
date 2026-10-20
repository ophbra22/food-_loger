/**
 * The session token is a credential, so it is kept in the Keychain (iOS) or the
 * Keystore-encrypted store (Android), never in plain app storage.
 */
import * as SecureStore from 'expo-secure-store';

import { STAGING_BUILD } from '@/config/env';

import type { User } from '@/api/types';

export type StoredSession = {
  token: string;
  /** Bound origin prevents credentials being replayed after a staging endpoint change. */
  serverUrl?: string;
  appleSignIn?: boolean;
  user: User;
  /** Epoch milliseconds after which the server no longer accepts the token. */
  expiresAt: number;
  /**
   * A recovery code the server showed once and the user has not confirmed saving.
   * Kept until they confirm, so closing the app on that screen does not lose it.
   */
  pendingRecoveryCode?: string;
};

const KEY = STAGING_BUILD ? 'foodlogger.session.staging' : 'foodlogger.session';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const sessionStore = {
  async read(): Promise<StoredSession | null> {
    try {
      const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
      if (!raw) return null;
      const value = JSON.parse(raw) as StoredSession;
      return typeof value?.token === 'string' && typeof value?.user?.id === 'string' ? value : null;
    } catch {
      return null;
    }
  },
  async write(session: StoredSession): Promise<void> {
    await SecureStore.setItemAsync(KEY, JSON.stringify(session), OPTIONS);
  },
  async clear(strict = false): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEY, OPTIONS);
    } catch (error) {
      if (strict) throw error;
      // Session expiry can still sign out while the keystore is unavailable.
    }
  },
};
