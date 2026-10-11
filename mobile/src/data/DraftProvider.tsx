import { randomUUID } from 'expo-crypto';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Meal } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Draft, editDraft } from '@/domain/drafts';
import { draftStore } from '@/storage/account-data';

import { saveDraft } from './save-draft';

type DraftValue = {
  /** The meal being reviewed, or null. `undefined` while it is read from disk. */
  draft: Draft | null | undefined;
  saving: boolean;
  newKey: () => string;
  start: (draft: Draft) => Promise<void>;
  update: (changes: Parameters<typeof editDraft>[1]) => void;
  discard: () => Promise<void>;
  /** Saves to the server. The draft is removed only after the server confirms. */
  save: () => Promise<Meal>;
};

/** A draft always travels with the account it belongs to. */
type Owned = { userId: string; draft: Draft | null };

const DraftContext = createContext<DraftValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const { user, api, journal } = useAuth();
  const userId = user?.id ?? null;
  const [owned, setOwned] = useState<Owned | null>(null);
  const [saving, setSaving] = useState(false);
  const latest = useRef<Owned | null>(null);
  const busy = useRef(false);

  const put = useCallback((next: Owned | null) => {
    latest.current = next;
    setOwned(next);
  }, []);

  // Each account has its own draft; switching accounts never carries one over.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      latest.current = null;
      return;
    }
    draftStore.read(userId).then((stored) => {
      if (!cancelled) put({ userId, draft: stored });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, put]);

  /** The current account's draft, or undefined when it is not this account's or not loaded. */
  const current = useCallback(() => {
    const value = latest.current;
    return userId && value?.userId === userId ? value.draft : undefined;
  }, [userId]);

  const start = useCallback(
    async (next: Draft) => {
      if (!userId) return;
      put({ userId, draft: next });
      await draftStore.write(userId, next);
    },
    [userId, put],
  );

  const update = useCallback(
    (changes: Parameters<typeof editDraft>[1]) => {
      const draft = current();
      if (!userId || !draft || busy.current) return;
      const next = editDraft(draft, changes, randomUUID);
      put({ userId, draft: next });
      void draftStore.write(userId, next);
    },
    [userId, put, current],
  );

  const discard = useCallback(async () => {
    if (!userId) return;
    put({ userId, draft: null });
    await draftStore.clear(userId);
  }, [userId, put]);

  const save = useCallback(async () => {
    const draft = current();
    if (!userId || !draft) throw new Error('No draft to save.');
    // One request at a time: a second tap while saving does nothing.
    if (busy.current) throw new Error('Already saving.');
    busy.current = true;
    setSaving(true);
    try {
      const meal = await saveDraft(api, draft, async (attempted) => {
        put({ userId, draft: attempted });
        await draftStore.write(userId, attempted);
      });
      journal?.addConfirmed(meal);
      put({ userId, draft: null });
      await draftStore.clear(userId);
      return meal;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, [userId, api, journal, put, current]);

  const draft = userId && owned?.userId === userId ? owned.draft : undefined;
  const value = useMemo<DraftValue>(
    () => ({ draft, saving, newKey: randomUUID, start, update, discard, save }),
    [draft, saving, start, update, discard, save],
  );
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftValue {
  const value = useContext(DraftContext);
  if (!value) throw new Error('useDraft must be used inside DraftProvider');
  return value;
}
