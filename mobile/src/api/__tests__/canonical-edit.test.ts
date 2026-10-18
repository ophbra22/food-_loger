import AsyncStorage from '@react-native-async-storage/async-storage';
import {createApi} from '../endpoints';
import {createApiClient} from '../client';
import {ApiError} from '../errors';
import {editDraft,manualDraft} from '@/domain/drafts';
import {mealEditDraft,loadMealForEdit} from '@/domain/meal-edit';
import {saveDraft} from '@/data/save-draft';
import {draftStore} from '@/storage/account-data';
import {openAccountStorage,accountKey} from '@/storage/kv';
import {libraryEntry} from '@/test-fixtures/library';

const id='a'.repeat(32),component='b'.repeat(32);
const group=()=>({id,version:1,local_date:'2026-10-13',occurred_at:null,timezone_id:null,snapshot:{draft:libraryEntry().draft,meals:[{id:component,day:'2026-10-13',meal_type:'lunch' as const,food_id:'custom',name:'Salad',emoji:'',grams:100,calories:100,protein:null,carbs:10,fat:5,created_at:'2026-10-13T12:00:00Z',details:{group_id:id,canonical_item:libraryEntry().draft.items[0]}}]}});
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
beforeEach(async()=>{await AsyncStorage.clear();openAccountStorage('edit-owner');});

test('resolve component to complete group with existing GET routes, preserve unknown time',async()=>{
 const paths:string[]=[];
 const api=createApi(createApiClient({baseUrl:()=> 'http://fixture.test',token:()=> 'token',onSessionRejected:()=>{},fetch:(async(url:string)=>{paths.push(url);return json(url.endsWith(id)?group():{groups:[group()]});}) as typeof fetch}));
 const saved=await loadMealForEdit(api,component,'2026-10-13');
 const d=mealEditDraft(saved,'stable-edit-key');
 expect(paths.map(p=>new URL(p).pathname)).toEqual(['/api/meal-logs','/api/meal-logs/'+id]);
 expect(d.edit).toMatchObject({groupId:id,expectedVersion:1,originalDate:'2026-10-13',entryIds:[component]});
 expect(d.occurredAt).toBe('');expect(d.timezoneId).toBe('');
 const legacy=group();delete (legacy.snapshot as {draft?:unknown}).draft;legacy.snapshot.meals[0].details={} as never;
 const legacyApi={mealLogs:async()=>[legacy],mealLog:async()=>legacy};
 const loaded=await loadMealForEdit(legacyApi as never,component,'2026-10-13');
 const old=mealEditDraft(loaded,'legacy-edit-key');
 expect(old.analysis!.foods[0].originSource?.verified_status).toBe('legacy_unknown');
 expect(old.occurredAt).toBe('');
});

test('lost PATCH reply survives disk restart and retries same request without POST',async()=>{
 const calls:{method:string;body:string;key:string}[]=[];
 let dropped=true;
 const api=createApi(createApiClient({baseUrl:()=> 'http://fixture.test',token:()=> 'token',onSessionRejected:()=>{},fetch:(async(url:string,init:RequestInit)=>{
  if(url.endsWith('capabilities'))return json({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,basis_correction_provenance:true});
  calls.push({method:init.method!,body:String(init.body),key:(init.headers as Record<string,string>)['Idempotency-Key']});
  if(dropped){dropped=false;throw new TypeError('lost response');}return json({...group(),version:2});
 }) as typeof fetch}));
 const d=mealEditDraft(group(),'stable-edit-key');
 await expect(saveDraft(api,d,v=>draftStore.write('edit-owner',v))).rejects.toMatchObject({kind:'network'});
 const resumed=(await draftStore.read('edit-owner'))!;
 expect(resumed.attempted).toBe(true);
 expect(JSON.parse((await AsyncStorage.getItem(accountKey('edit-owner','draft:v2')))! ).schemaVersion).toBe(3);
 expect(editDraft(resumed,{day:'2026-10-15'},()=> 'different')).toEqual(resumed);
 await saveDraft(api,resumed,v=>draftStore.write('edit-owner',v));
 expect(calls).toHaveLength(2);expect(calls[0]).toEqual(calls[1]);expect(calls[0].method).toBe('PATCH');
 expect(JSON.parse(calls[0].body)).toMatchObject({confirmed:true,expected_version:1,draft:{local_date:'2026-10-13'}});
});

test('reload a known group after a concurrent day move without consulting the old day',async()=>{
 const moved={...group(),version:2,local_date:'2026-10-15'};
 const api={mealLogs:jest.fn(async()=>[]),mealLog:jest.fn(async()=>moved)};
 await expect(loadMealForEdit(api as never,id,'2026-10-13','group')).resolves.toEqual(moved);
 expect(api.mealLog).toHaveBeenCalledWith(id);expect(api.mealLogs).not.toHaveBeenCalled();
});

test('a deleted known group stays unavailable without fallback to stale day data',async()=>{
 const api={mealLogs:jest.fn(async()=>[group()]),mealLog:jest.fn(async()=>{throw new ApiError('notFound');})};
 await expect(loadMealForEdit(api as never,id,'2026-10-13','group')).rejects.toMatchObject({kind:'notFound'});
 expect(api.mealLogs).not.toHaveBeenCalled();
});

test.each(['conflict','notFound','unauthorized'])('%s retains attempted edit and never creates a new meal',async(kind)=>{
 const d=mealEditDraft(group(),'failed-edit-key'),stored:unknown[]=[];let calls=0;
 const api={capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),patchMealLog:async()=>{calls++;throw new ApiError(kind as never);},addMeal:jest.fn(),addCustomMeal:jest.fn()};
 await expect(saveDraft(api,d,async v=>{stored.push(v);})).rejects.toMatchObject({kind});
 expect(calls).toBe(1);expect(stored[0]).toMatchObject({attempted:true,edit:{groupId:id}});
 expect(api.addMeal).not.toHaveBeenCalled();expect(api.addCustomMeal).not.toHaveBeenCalled();
});

test('disk failure and session change before dispatch cannot mutate journal',async()=>{
 const d=mealEditDraft(group(),'disk-edit-key');let sent=0,session=true;
 const api={captureSession:()=>()=>{if(!session)throw new ApiError('unauthorized');},capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),patchMealLog:async()=>{sent++;return group();},addMeal:jest.fn(),addCustomMeal:jest.fn()};
 await expect(saveDraft(api,d,async()=>{throw new ApiError('storage');})).rejects.toMatchObject({kind:'storage'});
 await expect(saveDraft(api,d,async()=>{session=false;})).rejects.toMatchObject({kind:'unauthorized'});
 expect(sent).toBe(0);
 expect(manualDraft('ordinary-key').edit).toBeUndefined();
});
