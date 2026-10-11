import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';

import type { DayState } from './journal-store';

const SIGNED_OUT: DayState = { data: null, savedAt: null, fresh: false, loading: false, error: null };
const noop = () => () => undefined;

/**
 * One journal day for the signed-in account: the phone's saved copy first, then the
 * server's answer. It is asked again whenever the screen or the app comes back
 * into view, so changes made on the website or another phone show up.
 */
export function useDay(day: string): DayState & { refresh: () => Promise<void> } {
  const { journal } = useAuth();
  const state = useSyncExternalStore(
    journal ? journal.subscribe : noop,
    () => (journal ? journal.get(day) : SIGNED_OUT),
  );

  useFocusEffect(
    useCallback(() => {
      void journal?.load(day);
    }, [journal, day]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void journal?.refresh(day);
    });
    return () => subscription.remove();
  }, [journal, day]);

  const refresh = useCallback(async () => {
    await journal?.refresh(day);
  }, [journal, day]);
  return { ...state, refresh };
}
