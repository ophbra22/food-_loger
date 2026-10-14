import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoalsStore } from '../goals-store';
import { JournalStore } from '../journal-store';
import { ApiError } from '@/api/errors';
import { first,document,values } from '@/test-fixtures/goals';
import { effectiveGoal, goalProgress, type GoalDocument } from '@/domain/goals';
import { goalsCache } from '@/storage/goals-cache';
import { openAccountStorage,clearAccount } from '@/storage/kv';
import type { Meal } from '@/api/types';
const update={...values,effective_local_date:'2026-10-15',timezone_id:'UTC',expected_version:1,allow_past:false};
const changed={version:2,revisions:[first,{...first,id:'b'.repeat(32),version:2,effective_local_date:'2026-10-15',calorie_target:2500}]};
const api=()=>({capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,goals:true}),getGoals:async()=>document,putGoals:async()=>changed,captureSession:()=>()=>{}});
const deferred=<T,>()=>{let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(r=>setTimeout(r,0));
beforeEach(async()=>{await AsyncStorage.clear();openAccountStorage('alice');openAccountStorage('bob');});

it('publishes an optimistic revision, rolls it back visibly on failure, and requires refresh',async()=>{
 const request=deferred<GoalDocument>();const store=new GoalsStore('alice',{...api(),putGoals:()=>request.promise});await store.load();
 const saving=store.save({...update,calorie_target:2500});
 expect(effectiveGoal(store.get().data,'2026-10-15')?.calorie_target).toBe(2500);
 expect(effectiveGoal(store.get().data,'2026-10-14')?.calorie_target).toBe(2300);
 expect(store.get().saving).toBe(true);
 request.reject(new ApiError('network'));await expect(saving).rejects.toMatchObject({kind:'network'});
 expect(effectiveGoal(store.get().data,'2026-10-15')?.calorie_target).toBe(2300);
 expect(store.get()).toMatchObject({fresh:false,saving:false,error:{kind:'network'}});
 await expect(store.save(update)).rejects.toMatchObject({kind:'conflict'});
 expect((await goalsCache.read('alice'))?.data.version).toBe(1);
});
it('a late read cannot replace a pending or committed revision; confirmed cache survives restart offline',async()=>{
 const read=deferred<GoalDocument>();let delayed=false;
 const store=new GoalsStore('alice',{...api(),getGoals:()=>delayed?read.promise:Promise.resolve(document)});
 await store.load();delayed=true;const loading=store.refresh();await flush();
 await store.save({...update,calorie_target:2500});read.resolve(document);await loading;await flush();
 expect(store.get().data?.version).toBe(2);
 const offline=new GoalsStore('alice',{...api(),capabilities:async()=>{throw new ApiError('network');}});await offline.load();
 expect(offline.get()).toMatchObject({enabled:true,fresh:false,data:{version:2},error:{kind:'network'}});
 const bob=new GoalsStore('bob',{...api(),capabilities:async()=>{throw new ApiError('network');}});await bob.load();expect(bob.get().data).toBeNull();
});
it('capability off hides goals; old daily responses cannot revive them',async()=>{
 let enabled=true;const store=new GoalsStore('alice',{...api(),capabilities:async()=>({...await api().capabilities(),goals:enabled})});
 await store.load();enabled=false;await store.refresh();store.accept(document);await flush();
 expect(store.get()).toMatchObject({enabled:false,data:null});expect(await goalsCache.read('alice')).toBeNull();
});
it('late goal saves cannot repopulate a signed-out account or issue calls after close',async()=>{
 const response=deferred<GoalDocument>();const put=jest.fn(()=>response.promise);const store=new GoalsStore('alice',{...api(),putGoals:put});await store.load();
 const saving=store.save(update);store.close();await clearAccount('alice');openAccountStorage('alice');
 response.resolve(changed);await expect(saving).rejects.toMatchObject({kind:'unauthorized'});await flush();
 expect(store.get().data).toBeNull();expect(await goalsCache.read('alice')).toBeNull();
 await expect(store.save(update)).rejects.toMatchObject({kind:'unauthorized'});expect(put).toHaveBeenCalledTimes(1);
});
it('daily read model and every confirmed lunch mutation use one journal total and active goal history',async()=>{
 const meal:Meal={id:'m1',day:'2026-10-14',meal_type:'lunch',food_id:'banana',name:'Lunch',emoji:'',grams:100,calories:1150,protein:75,carbs:100,fat:10,created_at:'2026-10-14T12:00:00Z',details:{}};
 const journal=new JournalStore('alice',{...api(),day:async()=>{throw new Error('legacy path should not be used');},dailySummary:async(day)=>({day,meals:[],summary:{count:0,calories:0,protein:0,carbs:0,fat:0},goals:document}),deleteMeal:async()=>null});
 await journal.load(meal.day);journal.addConfirmed(meal);
 const progress=()=>goalProgress(journal.get(meal.day).data!.summary,effectiveGoal(journal.goals.get().data,meal.day));
 expect(progress().calories.percent).toBe(50);
 journal.addConfirmed({...meal,calories:2300,protein:150});expect(progress().calories.percent).toBe(100);expect(progress().protein.status).toBe('met');
 await journal.goals.save({...update,calorie_target:2500});expect(progress().calories.target).toBe(2300);
 await journal.delete(meal);expect(progress().calories.status).toBe('unlogged');
});

it('a server response that does not acknowledge the requested revision rolls back visibly',async()=>{
 const store=new GoalsStore('alice',{...api(),putGoals:async()=>document});await store.load();
 await expect(store.save(update)).rejects.toMatchObject({kind:'server'});
 expect(store.get()).toMatchObject({data:{version:1},fresh:false,saving:false,error:{kind:'server'}});
});
