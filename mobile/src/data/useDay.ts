import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/auth/AuthProvider';

import type { DayState } from './journal-store';

const SIGNED_OUT: DayState = { data: null, savedAt: null, fresh: false, loading: false, error: null };
const noop = () => () => undefined;

/** One journal day for the signed-in account: saved copy first, then the server's answer. */
export function useDay(day: string): DayState & { refresh: () => Promise<void> } {
  const { journal } = useAuth();
  const state = useSyncExternalStore(
    journal ? journal.subscribe : noop,
    () => (journal ? journal.get(day) : SIGNED_OUT),
  );
  useEffect(() => {
    void journal?.load(day);
  }, [journal, day]);
  const refresh = useCallback(async () => {
    await journal?.refresh(day);
  }, [journal, day]);
  return { ...state, refresh };
}
