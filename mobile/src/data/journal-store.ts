import {AdviceStore,type AdviceApi} from './advice-store';
import {TrackingStore} from './tracking-store';
import {TrendsStore} from './trends-store';
/**
 * Journal days for one signed-in account.
 *
 * A day is shown from the copy saved on the phone first, then replaced by the
 * server's answer. Only meals the server confirmed ever enter this store.
 */
import {LibraryStore,type LibraryApi} from './library-store';
import { GoalsStore } from './goals-store';
import type { Api } from '@/api/endpoints';
import { ApiError, isApiError } from '@/api/errors';
import type { DayResponse, DaySummary, Meal } from '@/api/types';
import { sum } from '@/domain/exact';
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

export function summarize(meals: Meal[]): DaySummary {
  const keys = ['calories','protein','carbs','fat'] as const;
  const known_totals = Object.fromEntries(keys.map(k=>[k,sum(meals.flatMap(m=>m[k]===null?[]:[m[k]!]))]));
  const partial = Object.fromEntries(keys.map(k=>[k,meals.some(m=>m[k]===null)]));
  return {count:meals.length, known_totals, partial,
    ...Object.fromEntries(keys.map(k=>[k,partial[k]?null:known_totals[k]]))} as DaySummary;
}

type Cache = typeof dayCache;

export class JournalStore {
  private days = new Map<string, DayState>();
  private listeners = new Set<() => void>();
  private requests = new Map<string, number>();
  private closed = false;
  private revision = 0;
  private changes = new Set<(change: {owner:string;dates:string[];revision:number})=>void>();

  subscribeChanges(listener:(change:{owner:string;dates:string[];revision:number})=>void) {
    this.changes.add(listener);
    return ()=>{ this.changes.delete(listener); };
  }

  onLogChanged(dates:string[]) {
    if(this.closed) return;
    this.revision++;
    this.library.invalidate();
    this.trends.invalidate();
    this.advice.invalidate();
    for(const day of dates) {
      this.requests.set(day,(this.requests.get(day)??0)+1);
      this.set(day,{loading:false,error:null});
    }
    this.changes.forEach(listener=>listener({owner:this.userId,dates,revision:this.revision}));
  }

  readonly library:LibraryStore;
  readonly recipes:LibraryStore;
  readonly goals:GoalsStore;
  readonly tracking:TrackingStore;
  readonly trends:TrendsStore;
  readonly advice:AdviceStore;

  constructor(
    readonly userId: string,
    private api: Pick<Api, 'day' | 'deleteMeal'> & LibraryApi & AdviceApi & Partial<Pick<Api,'recipes'|'dailySummary'|'getGoals'|'putGoals'|'capabilities'|'captureSession'|'tracking'|'saveMeasurement'|'deleteMeasurement'|'trends'>>,
    private cache: Cache = dayCache,
    private now: () => number = Date.now,
  ) {this.advice=new AdviceStore(api);this.trends=new TrendsStore(api);this.tracking=new TrackingStore(userId,api,()=>{this.trends.invalidate();this.advice.invalidate();});this.goals=new GoalsStore(userId,api,()=>{this.trends.invalidate();this.advice.invalidate();});this.library=new LibraryStore(userId,api);this.recipes=new LibraryStore(userId,{
      ...api,library:(_favorite,query,offset)=>api.recipes?api.recipes(query,offset):Promise.reject(new ApiError('unavailable')),
      capabilities:async()=>{const caps=await api.capabilities?.();return {...caps,canonical_writes:!!caps?.canonical_writes,partial_core_writes:!!caps?.partial_core_writes,tiny_portion_writes:!!caps?.tiny_portion_writes,library:!!caps?.recipes};}
    },'recipes'); }

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
    this.goals.close();
    this.tracking.close();
    this.trends.close();
    this.advice.close();
    this.library.close();
    this.recipes.close();
    this.listeners.clear();
    this.changes.clear();
    this.days.clear();
  }

  private set(day: string, patch: Partial<DayState>) {
    if (this.closed) return;
    this.days.set(day, { ...this.get(day), ...patch });
    this.listeners.forEach((listener) => listener());
  }

  /** Show the saved copy (if any), then ask the server. */
  async load(day: string): Promise<void> {
    const revision=this.revision;
    if(this.closed) return;
    if (!this.get(day).data) {
      const cached = await this.cache.read(this.userId, day);
      if (cached && !this.get(day).data && revision===this.revision && !this.closed) {
        this.set(day, { data: cached.data, savedAt: cached.savedAt, fresh: false });
      }
    }
    if(revision===this.revision && !this.closed) await this.refresh(day);
  }

  async refresh(day: string): Promise<void> {
    const request = (this.requests.get(day) ?? 0) + 1;
    this.requests.set(day, request);
    this.set(day, { loading: true, error: null });
    try {
      let data:DayResponse;
      if(this.api.dailySummary) {
        await this.goals.load();
        if(this.closed || this.requests.get(day)!==request)return;
        if(this.goals.get().enabled) {
          const daily=await this.api.dailySummary(day);
          this.goals.accept(daily.goals);
          // The day cache holds journal data only; goal history has its own account cache.
          data={day:daily.day,meals:daily.meals,summary:daily.summary};
        } else data=await this.api.day(day);
      } else data=await this.api.day(day);
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
    if(this.closed) return;
    this.onLogChanged([meal.day]);
    const state = this.get(meal.day);
    if (!state.data) { void this.refresh(meal.day); return; }
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
    this.onLogChanged([meal.day]);
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
