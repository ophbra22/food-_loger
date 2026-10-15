import {TrendsStore} from '../trends-store';
import {JournalStore} from '../journal-store';
import {openAccountStorage,clearAccount} from '@/storage/kv';
import {first} from '@/test-fixtures/goals';
import fixture from '@/test-fixtures/trends.json';
import type {TrendResponse} from '@/domain/trends';
const caps={canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,trends:true,goals:true};
const response=(n:number)=>({...fixture,current:{...fixture.current,statistics:{...fixture.current.statistics,logged_days:n}}}) as TrendResponse;
test('invalidated historical trend refuses old response and reloads active subscribers',async()=>{
 let resolve!:(value:any)=>void,n=0;
 const api={capabilities:async()=>caps,trends:()=>++n===1?new Promise<any>(r=>{resolve=r;}):Promise.resolve(response(2))};
 const store=new TrendsStore(api);store.subscribe(()=>{});
 const firstRead=store.load('2026-10-11','2026-10-17');await Promise.resolve();store.invalidate();
 await new Promise(r=>setTimeout(r,0));resolve(response(1));await firstRead;
 expect(store.get('2026-10-11','2026-10-17').data?.current.statistics.logged_days).toBe(2);
 store.close();expect(store.get('2026-10-11','2026-10-17').data).toBeNull();
});
test('journal and confirmed dated goal changes invalidate the same trend store',async()=>{
 openAccountStorage('trend-owner');let n=0;
 const api={capabilities:async()=>caps,trends:async()=>response(++n),day:jest.fn(),deleteMeal:async()=>null,library:jest.fn(),getGoals:async()=>({version:1,revisions:[first]})};
 const store=new JournalStore('trend-owner',api);store.trends.subscribe(()=>{});
 await store.trends.load('2026-10-11','2026-10-17');store.onLogChanged(['2026-10-11']);await new Promise(r=>setTimeout(r,0));
 expect(store.trends.get('2026-10-11','2026-10-17').data?.current.statistics.logged_days).toBe(2);
 await store.goals.load();await new Promise(r=>setTimeout(r,0));
 expect(store.trends.get('2026-10-11','2026-10-17').data?.current.statistics.logged_days).toBe(3);
 store.close();await clearAccount('trend-owner');
});
