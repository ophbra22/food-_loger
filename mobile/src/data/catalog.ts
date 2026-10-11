import { useEffect, useState } from 'react';

import { ApiError, isApiError } from '@/api/errors';
import type { CatalogFood, FoodsResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { globalKey, readJson, writeJson } from '@/storage/kv';

// The catalog is public and the same for every account, so it is shared on the phone.
const KEY = globalKey('catalog');
let memory: FoodsResponse | null = null;

type State = { foods: CatalogFood[] | null; loading: boolean; error: ApiError | null };

/** The food catalog: from memory, then the phone's saved copy, then the server. */
export function useCatalog(): State & { reload: () => void } {
  const { api } = useAuth();
  const [state, setState] = useState<State>({ foods: memory?.foods ?? null, loading: !memory, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!memory) {
        const saved = await readJson<FoodsResponse>(KEY);
        if (saved?.foods?.length && !cancelled && !memory) {
          memory = saved;
          setState({ foods: saved.foods, loading: true, error: null });
        }
      }
      try {
        const fresh = await api.foods();
        memory = fresh;
        void writeJson(KEY, fresh);
        if (!cancelled) setState({ foods: fresh.foods, loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          foods: memory?.foods ?? null,
          loading: false,
          error: memory ? null : isApiError(error) ? error : new ApiError('server'),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, attempt]);

  return { ...state, reload: () => setAttempt((value) => value + 1) };
}

export const catalogFood = (foods: CatalogFood[] | null, id: string | null) =>
  (id && foods?.find((food) => food.id === id)) || null;
