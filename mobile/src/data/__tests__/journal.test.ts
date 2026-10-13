import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '@/api/errors';
import type { DayResponse, Meal } from '@/api/types';
import { catalogDraft, Draft } from '@/domain/drafts';
import { dayCache, draftStore } from '@/storage/account-data';
import { clearAccount, openAccountStorage, accountKey } from '@/storage/kv';

import { JournalStore, summarize } from '../journal-store';
import { saveDraft } from '../save-draft';

const meal = (id: string, calories: number, day = '2026-10-11'): Meal => ({
  id,
  day,
  meal_type: 'lunch',
  food_id: 'banana',
  name: 'Banana',
  emoji: '🍌',
  grams: 100,
  calories,
  protein: 1.1,
  carbs: 22.8,
  fat: 0.3,
  created_at: '2026-10-11T10:00:00+00:00',
  details: { basis_unit: 'g', source: 'catalog' },
});
const dayOf = (meals: Meal[], day = '2026-10-11'): DayResponse => ({
  day,
  meals,
  summary: summarize(meals),
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => { await AsyncStorage.clear(); openAccountStorage('alice'); openAccountStorage('bob'); });

describe('journal store', () => {
  it('loads a day from the server and saves a copy for this account', async () => {
    const store = new JournalStore('alice', {
      day: async () => dayOf([meal('m1', 89)]),
      deleteMeal: async () => null,
    });
    await store.load('2026-10-11');
    const state = store.get('2026-10-11');
    expect(state.fresh).toBe(true);
    expect(state.data?.summary.calories).toBe(89);
    await flush();
    expect((await dayCache.read('alice', '2026-10-11'))?.data.meals).toHaveLength(1);
    expect(await dayCache.read('bob', '2026-10-11')).toBeNull();
  });

  it('shows the saved copy when the server cannot be reached, marked as not fresh', async () => {
    await dayCache.write('alice', dayOf([meal('m1', 89)]), 1000);
    const store = new JournalStore('alice', {
      day: async () => {
        throw new ApiError('network');
      },
      deleteMeal: async () => null,
    });
    await store.load('2026-10-11');
    const state = store.get('2026-10-11');
    expect(state.data?.meals[0].id).toBe('m1');
    expect([state.fresh, state.savedAt, state.error?.kind]).toEqual([false, 1000, 'network']);
  });

  it('has nothing to show for a day that was never loaded while offline', async () => {
    const store = new JournalStore('alice', {
      day: async () => {
        throw new ApiError('network');
      },
      deleteMeal: async () => null,
    });
    await store.load('2026-10-09');
    expect(store.get('2026-10-09').data).toBeNull();
    expect(store.get('2026-10-09').error?.kind).toBe('network');
  });

  it('ignores an older answer that arrives after a newer one', async () => {
    const answers: ((value: DayResponse) => void)[] = [];
    const store = new JournalStore('alice', {
      day: () => new Promise<DayResponse>((resolve) => answers.push(resolve)),
      deleteMeal: async () => null,
    });
    const first = store.refresh('2026-10-11');
    const second = store.refresh('2026-10-11');
    answers[1](dayOf([meal('new', 50)]));
    answers[0](dayOf([meal('old', 10)]));
    await Promise.all([first, second]);
    expect(store.get('2026-10-11').data?.meals[0].id).toBe('new');
  });

  it('adds a confirmed meal once and updates the totals', async () => {
    const store = new JournalStore('alice', {
      day: async () => dayOf([meal('m1', 89)]),
      deleteMeal: async () => null,
    });
    await store.load('2026-10-11');
    store.addConfirmed(meal('m2', 100.5));
    store.addConfirmed(meal('m2', 100.5));
    const data = store.get('2026-10-11').data!;
    expect(data.meals.map((item) => item.id)).toEqual(['m2', 'm1']);
    expect(data.summary).toMatchObject({ count: 2, calories: 189.5 });
  });

  it('deletes on the server first and keeps the meal if that fails', async () => {
    let fail = true;
    const deleted: string[] = [];
    const store = new JournalStore('alice', {
      day: async () => dayOf([meal('m1', 89), meal('m2', 11)]),
      deleteMeal: async (id) => {
        if (fail) throw new ApiError('network');
        deleted.push(id);
        return null;
      },
    });
    await store.load('2026-10-11');
    await expect(store.delete({ id: 'm1', day: '2026-10-11' })).rejects.toMatchObject({
      kind: 'network',
    });
    expect(store.get('2026-10-11').data?.meals).toHaveLength(2);
    fail = false;
    await store.delete({ id: 'm1', day: '2026-10-11' });
    expect(deleted).toEqual(['m1']);
    expect(store.get('2026-10-11').data?.summary).toMatchObject({ count: 1, calories: 11 });
  });

  it('treats a meal that is already gone on the server as deleted', async () => {
    const store = new JournalStore('alice', {
      day: async () => dayOf([meal('m1', 89)]),
      deleteMeal: async () => {
        throw new ApiError('notFound', { status: 404 });
      },
    });
    await store.load('2026-10-11');
    await store.delete({ id: 'm1', day: '2026-10-11' });
    expect(store.get('2026-10-11').data?.meals).toEqual([]);
  });

  it('stops publishing after the account signs out', async () => {
    let resolve!: (value: DayResponse) => void;
    const store = new JournalStore('alice', {
      day: () => new Promise<DayResponse>((done) => (resolve = done)),
      deleteMeal: async () => null,
    });
    const pending = store.refresh('2026-10-11');
    store.close();
    resolve(dayOf([meal('m1', 89)]));
    await pending;
    expect(store.get('2026-10-11').data).toBeNull();
  });
});

describe('saving a draft', () => {
  const ready = (): Draft => ({
    ...catalogDraft('draft-key-0000000001', 'banana', 'catalog', { day: '2026-10-11' }),
    amount: '150',
  });

  it('writes the draft as attempted before sending, with its key', async () => {
    const order: string[] = [];
    const keys: string[] = [];
    const saved = await saveDraft(
      {
        addMeal: async (_body, key) => {
          order.push('request');
          keys.push(key);
          return meal('m1', 133.5);
        },
        addCustomMeal: async () => meal('x', 0),
      },
      ready(),
      async (draft) => {
        order.push(draft.attempted ? 'persist-attempted' : 'persist');
      },
    );
    expect(order).toEqual(['persist-attempted', 'request']);
    expect(keys).toEqual(['draft-key-0000000001']);
    expect(Array.isArray(saved)).toBe(false);
    if (Array.isArray(saved)) throw new Error('Expected one catalog meal');
    expect(saved.id).toBe('m1');
  });

  it('retrying after a lost answer reuses the same key', async () => {
    const keys: string[] = [];
    let attempts = 0;
    const api = {
      addMeal: async (_body: unknown, key: string) => {
        keys.push(key);
        attempts += 1;
        if (attempts === 1) throw new ApiError('timeout');
        return meal('m1', 133.5);
      },
      addCustomMeal: async () => meal('x', 0),
    };
    let stored = ready();
    const persist = async (draft: Draft) => {
      stored = draft;
    };
    await expect(saveDraft(api, stored, persist)).rejects.toMatchObject({ kind: 'timeout' });
    expect(stored.attempted).toBe(true);
    await saveDraft(api, stored, persist);
    expect(keys).toEqual(['draft-key-0000000001', 'draft-key-0000000001']);
  });

  it('refuses to send an incomplete draft', async () => {
    const api = { addMeal: jest.fn(), addCustomMeal: jest.fn() };
    await expect(saveDraft(api, { ...ready(), amount: '' }, async () => undefined)).rejects.toThrow();
    expect(api.addMeal).not.toHaveBeenCalled();
  });
});

describe('data saved on the phone', () => {
  it('keeps drafts and days apart per account and removes one account on sign-out', async () => {
    await draftStore.write('alice', { ...catalogDraft('a'.repeat(20), 'banana', 'catalog'), amount: '1' });
    await draftStore.write('bob', { ...catalogDraft('b'.repeat(20), 'apple', 'catalog'), amount: '2' });
    await dayCache.write('alice', dayOf([meal('m1', 89)]));
    expect((await draftStore.read('alice'))?.foodId).toBe('banana');
    expect((await draftStore.read('bob'))?.foodId).toBe('apple');
    expect(await dayCache.read('bob', '2026-10-11')).toBeNull();
    await clearAccount('alice');
    expect(await draftStore.read('alice')).toBeNull();
    expect(await dayCache.read('alice', '2026-10-11')).toBeNull();
    expect((await draftStore.read('bob'))?.foodId).toBe('apple');
  });
});

it('does not repopulate erased account storage from an in-flight refresh', async () => {
  let answer!: (data: DayResponse) => void;
  const store = new JournalStore('alice', {
    day: () => new Promise<DayResponse>((resolve) => { answer = resolve; }),
    deleteMeal: async () => null,
  });
  const request = store.refresh('2026-10-11');
  store.close();
  await clearAccount('alice');
  answer(dayOf([meal('late', 99)]));
  await request;
  await flush();
  expect(await dayCache.read('alice', '2026-10-11')).toBeNull();
});

it('blocks late draft writes after erasure but allows a later sign-in', async () => {
  await draftStore.write('bob', catalogDraft('bob-key', 'banana', 'catalog'));
  await clearAccount('alice');
  await expect(draftStore.write('alice', catalogDraft('late-key', 'banana', 'catalog'))).rejects.toMatchObject({kind:'unauthorized'});
  expect(await draftStore.read('alice')).toBeNull();
  expect(await draftStore.read('bob')).not.toBeNull();
  openAccountStorage('alice');
  await draftStore.write('alice', catalogDraft('new-key', 'banana', 'catalog'));
  expect((await draftStore.read('alice'))?.key).toBe('new-key');
});

describe('P01 confirmed mutations invalidate older reads', () => {
  it.each(['add','delete'] as const)('%s survives a delayed refresh', async operation => {
    let finish!: (data:DayResponse)=>void;
    let delayed=false;
    const store=new JournalStore('alice',{
      day:()=>delayed?new Promise(resolve=>{finish=resolve;}):Promise.resolve(dayOf([meal('old',10)])),
      deleteMeal:async()=>null,
    });
    await store.load('2026-10-11');
    delayed=true;
    const loading=store.refresh('2026-10-11');
    if(operation==='add') store.addConfirmed(meal('new',20));
    else await store.delete(meal('old',10));
    finish(dayOf([meal('old',10)])); await loading;
    expect(store.get('2026-10-11').data?.summary.count).toBe(operation==='add'?2:0);
    expect(store.get('2026-10-11').loading).toBe(false);
  });
});

it('disk-full persistence stops a save before any API request', async () => {
  const draft={...catalogDraft('safe-key','banana','catalog'),amount:'150'};
  const api={addMeal:jest.fn(),addCustomMeal:jest.fn()};
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(saveDraft(api,draft,next=>draftStore.write('alice',next))).rejects.toMatchObject({kind:'storage'});
  expect(api.addMeal).not.toHaveBeenCalled();
  expect(api.addCustomMeal).not.toHaveBeenCalled();
});

it('reads valid legacy drafts but preserves an unsupported envelope for explicit recovery', async () => {
  const draft=catalogDraft('legacy-key','banana','catalog');
  await AsyncStorage.setItem(accountKey('alice','draft'),JSON.stringify(draft));
  expect(await draftStore.read('alice')).toEqual(draft);
  const future=JSON.stringify({schemaVersion:99,ownerId:'alice',draft});
  await AsyncStorage.setItem(accountKey('alice','draft:v2'),future);
  await expect(draftStore.read('alice')).rejects.toMatchObject({kind:'draftFormat'});
  await expect(draftStore.write('alice',draft)).rejects.toMatchObject({kind:'draftFormat'});
  expect(await AsyncStorage.getItem(accountKey('alice','draft:v2'))).toBe(future);
});

it('ignores invalid day cache rather than displaying unknown nutrition as zero', async () => {
  await AsyncStorage.setItem(accountKey('alice','day:2026-10-11'),JSON.stringify({
    data:{...dayOf([meal('bad',10)]),summary:{calories:null}},savedAt:1000,
  }));
  expect(await dayCache.read('alice','2026-10-11')).toBeNull();
});
