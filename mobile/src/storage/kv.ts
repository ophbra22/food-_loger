/**
 * Small JSON store on top of AsyncStorage. Not for secrets: the session token
 * lives in the device keystore (see auth/session-store.ts).
 *
 * Everything that belongs to an account is stored under that account's id, so one
 * account never reads another account's drafts or cached journal days.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROOT = 'fl:v1';
const clearing = new Set<string>();
const pendingWrites = new Map<string, Promise<void>>();

export const globalKey = (name: string) => `${ROOT}:app:${name}`;
export const accountPrefix = (userId: string) => `${ROOT}:u:${userId}:`;
export function openAccountStorage(userId: string) {
  clearing.delete(accountPrefix(userId));
}
export const accountKey = (userId: string, name: string) => accountPrefix(userId) + name;

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    if ([...clearing].some((prefix) => key.startsWith(prefix))) return;
    const previous = pendingWrites.get(key) ?? Promise.resolve();
    const writing = previous.then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
    pendingWrites.set(key, writing);
    try { await writing; } finally {
      if (pendingWrites.get(key) === writing) pendingWrites.delete(key);
    }
  } catch {
    // A full or unavailable store must not break logging a meal.
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

/** Remove everything stored for one account (used on sign-out). */
export async function clearAccount(userId: string): Promise<void> {
  const prefix = accountPrefix(userId);
  clearing.add(prefix);
  {
    await Promise.allSettled([...pendingWrites].filter(([key]) => key.startsWith(prefix)).map(([, task]) => task));
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  }
}
