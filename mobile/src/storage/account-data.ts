import type { DayResponse } from '@/api/types';
import type { Draft } from '@/domain/drafts';

import { accountKey, readJson, remove, writeJson } from './kv';

export type CachedDay = { data: DayResponse; savedAt: number };

/** Last copy of a journal day fetched from the server, for showing while offline. */
export const dayCache = {
  read: (userId: string, day: string) => readJson<CachedDay>(accountKey(userId, `day:${day}`)),
  write: (userId: string, data: DayResponse, now: number = Date.now()) =>
    writeJson(accountKey(userId, `day:${data.day}`), { data, savedAt: now } satisfies CachedDay),
  remove: (userId: string, day: string) => remove(accountKey(userId, `day:${day}`)),
};

/** The one meal currently being reviewed. Survives restarts, reloads and failed saves. */
export const draftStore = {
  read: (userId: string) => readJson<Draft>(accountKey(userId, 'draft')),
  write: (userId: string, draft: Draft) => writeJson(accountKey(userId, 'draft'), draft),
  clear: (userId: string) => remove(accountKey(userId, 'draft')),
};
