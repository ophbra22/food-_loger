/**
 * Journal days for one signed-in account.
 *
 * A day is shown from the copy saved on the phone first, then replaced by the
 * server's answer. Only meals the server confirmed ever enter this store.
 */
import type { Api } from '@/api/endpoints';
import { ApiError, isApiError } from '@/api/errors';
import type { DayResponse, DaySummary, Meal } from '@/api/types';
import { dayCache } from '@/storage/account-data';

export type DayState = {
  data: DayResponse | null;
  /** When the shown data was received from the server (epoch ms). */
  savedAt: number | null;
  /** False while the data on screen is only the phone's saved copy. */
  fresh: boolean;
  loading: boolean;
  error: ApiError | null;
};

const EMPTY: DayState = { data: null, savedAt: null, fresh: false, loading: false, error: null };

const round1 = (value: number) => Math.round(value * 10) / 10;

export function summarize(meals: Meal[]): DaySummary {
  const total = (key: 'calories' | 'protein' | 'carbs' | 'fat') =>
    round1(meals.reduce((sum, meal) => sum + meal[key], 0));
  return {
    count: meals.length,
    calories: total('calories'),
    protein: total('protein'),
    carbs: total('carbs'),
    fat: total('fat'),
  };
}

type Cache = typeof dayCache;

export class JournalStore {
  private days = new Map<string, DayState>();
  private listeners = new Set<() => void>();
  private requests = new Map<string, number>();
  private closed = false;

  constructor(
    readonly userId: string,
    private api: Pick<Api, 'day' | 'deleteMeal'>,
    private cache: Cache = dayCache,
    private now: () => number = Date.now,
  ) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = (day: string): DayState => this.days.get(day) ?? EMPTY;

  /** Stop publishing; used when the account signs out while a request is in flight. */
  close() {
    this.closed = true;
    this.listeners.clear();
    this.days.clear();
  }

  private set(day: string, patch: Partial<DayState>) {
    if (this.closed) return;
    this.days.set(day, { ...this.get(day), ...patch });
    this.listeners.forEach((listener) => listener());
  }

  /** Show the saved copy (if any), then ask the server. */
  async load(day: string): Promise<void> {
    if (!this.get(day).data) {
      const cached = await this.cache.read(this.userId, day);
      if (cached && !this.get(day).data) {
        this.set(day, { data: cached.data, savedAt: cached.savedAt, fresh: false });
      }
    }
    await this.refresh(day);
  }

  async refresh(day: string): Promise<void> {
    const request = (this.requests.get(day) ?? 0) + 1;
    this.requests.set(day, request);
    this.set(day, { loading: true, error: null });
    try {
      const data = await this.api.day(day);
      if (this.closed || this.requests.get(day) !== request) return;
      const savedAt = this.now();
      this.set(day, { data, savedAt, fresh: true, loading: false, error: null });
      void this.cache.write(this.userId, data, savedAt);
    } catch (error) {
      if (this.closed || this.requests.get(day) !== request) return;
      this.set(day, {
        loading: false,
        fresh: false,
        error: isApiError(error) ? error : new ApiError('server'),
      });
    }
  }

  /** Add a meal the server has just confirmed. Safe to call twice for the same meal. */
  addConfirmed(meal: Meal) {
    const state = this.get(meal.day);
    if (!state.data) return;
    const meals = [meal, ...state.data.meals.filter((item) => item.id !== meal.id)];
    this.replace(meal.day, meals);
  }

  /** Delete on the server, then remove from the day. A meal that is already gone counts as deleted. */
  async delete(meal: Pick<Meal, 'id' | 'day'>): Promise<void> {
    try {
      await this.api.deleteMeal(meal.id);
    } catch (error) {
      if (!(isApiError(error) && error.kind === 'notFound')) throw error;
    }
    const state = this.get(meal.day);
    if (state.data) {
      this.replace(
        meal.day,
        state.data.meals.filter((item) => item.id !== meal.id),
      );
    }
  }

  private replace(day: string, meals: Meal[]) {
    if (this.closed) return;
    const data: DayResponse = { day, meals, summary: summarize(meals) };
    const savedAt = this.now();
    this.set(day, { data, savedAt });
    void this.cache.write(this.userId, data, savedAt);
  }
}
