import {TrackingStore} from '../tracking-store';
import {ApiError} from '@/api/errors';
import {openAccountStorage,clearAccount} from '@/storage/kv';
import type {Measurement,TrackingPage} from '@/domain/tracking';
const day='2026-10-11';
const entry:Measurement={id:'a'.repeat(32),kind:'water',value:250,occurred_at:'2026-10-11T06:00:00.000000+00:00',local_date:day,timezone_id:'Asia/Jerusalem',source:'manual',external_id:null,version:1,created_at:'2026-10-11T06:00:00Z',updated_at:'2026-10-11T06:00:00Z'};
const page:TrackingPage={from:day,to:day,items:[],total:0,has_more:false,latest:null,previous:null,delta:null};
const body={value:250,occurred_at:'2026-10-11T09:00:00+03:00',local_date:day,timezone_id:'Asia/Jerusalem'};
const deferred=<T,>()=>{let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
beforeEach(()=>openAccountStorage('tracking-owner'));
afterEach(()=>clearAccount('tracking-owner'));
function setup(){const api={capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,tracking:true,tracking_writes:true}),tracking:async()=>page,saveMeasurement:jest.fn(),deleteMeasurement:jest.fn()};const changed=jest.fn();return {api,changed,store:new TrackingStore('tracking-owner',api,changed)};}
test('water appears immediately and a failed save visibly rolls back with stable retry',async()=>{
 const {api,store}=setup();await store.load('water',day);
 const pending=deferred<Measurement>();api.saveMeasurement.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(entry);
 const saving=store.save('water',body,'water-stable-request');await new Promise(r=>setTimeout(r,0));
 expect(store.get('water',day).data?.total).toBe(250);expect(store.get('water',day).saving).toBe(true);
 pending.reject(new ApiError('network'));await expect(saving).rejects.toThrow();
 expect(store.get('water',day).data?.total).toBe(0);expect(store.get('water',day).error?.kind).toBe('network');
 api.tracking=async()=>({...page,items:[entry],total:250});
 await store.retry();expect(store.get('water',day).data?.total).toBe(250);
 expect(api.saveMeasurement.mock.calls.map(c=>c[3])).toEqual(['water-stable-request','water-stable-request']);
});
test('old read cannot replace optimistic or confirmed water; account switch drops late results',async()=>{
 const {api,store}=setup();await store.load('water',day);
 const read=deferred<TrackingPage>();api.tracking=()=>read.promise;
 const loading=store.load('water',day);await new Promise(r=>setTimeout(r,0));
 const save=deferred<Measurement>();api.saveMeasurement.mockReturnValue(save.promise);
 const saving=store.save('water',body,'water-stable-request');await new Promise(r=>setTimeout(r,0));
 read.resolve(page);await loading;expect(store.get('water',day).data?.total).toBe(250);
 store.close();save.resolve(entry);await expect(saving).rejects.toThrow();
 expect(store.get('water',day).data).toBeNull();
});
test('pending request survives restart and prevents a new duplicate write',async()=>{
 const {api,store}=setup();await store.load('water',day);
 api.saveMeasurement.mockRejectedValue(new ApiError('timeout'));
 await expect(store.save('water',body,'persisted-water-key')).rejects.toThrow();store.close();
 const restarted=new TrackingStore('tracking-owner',api,()=>{});await restarted.load('water',day);
 expect(restarted.get('water',day).pending).toBe(true);
 await expect(restarted.save('water',body,'new-key')).rejects.toThrow();
});
test('successful save remains visible even if the following read fails',async()=>{
 const {api,store}=setup();await store.load('water',day);api.saveMeasurement.mockResolvedValue(entry);
 api.tracking=async()=>{throw new ApiError('network');};
 await store.save('water',body,'confirmed-before-offline');
 expect(store.get('water',day).data?.total).toBe(250);
 expect(store.get('water',day).data?.items[0].id).toBe(entry.id);
 expect(store.get('water',day).fresh).toBe(false);
});
it.each(['create','edit','delete'] as const)('lost acknowledgement then authoritative read and failed retry refresh does not replay %s delta',async action=>{
 const {api,store}=setup();const updated={...entry,value:500,version:2};const other={...entry,id:'c'.repeat(32),value:500};
 api.tracking=async()=>({...page,items:action==='create'?[]:[entry],total:action==='create'?0:250});
 await store.load('water',day);
 api.saveMeasurement.mockRejectedValueOnce(new ApiError('timeout')).mockResolvedValueOnce(action==='edit'?updated:entry);
 api.deleteMeasurement.mockRejectedValueOnce(new ApiError('timeout')).mockResolvedValueOnce(undefined);
 await expect(store.save('water',action==='edit'?{...body,value:500}:body,'lost-ack',action==='create'?null:entry,action==='delete')).rejects.toThrow();
 const committed=action==='delete'?[other]:[action==='edit'?updated:entry];
 api.tracking=async()=>({...page,items:committed,total:committed.reduce((n,e)=>n+e.value,0)});
 await store.load('water',day);
 api.tracking=async()=>{throw new ApiError('network');};
 await store.retry();
 expect(store.get('water',day).data?.total).toBe(action==='create'?250:500);
 expect(store.get('water',day).data?.items).toEqual(committed);
 expect(store.get('water',day).pending).toBe(false);
});
test('replayed creation subsequently edited on another device releases queue with authoritative value',async()=>{
 const {api,store}=setup();await store.load('water',day);
 api.saveMeasurement.mockRejectedValueOnce(new ApiError('timeout')).mockResolvedValueOnce({...entry,value:500,version:2});
 await expect(store.save('water',body,'edited-receipt')).rejects.toThrow();
 api.tracking=async()=>{throw new ApiError('network');};
 await expect(store.retry()).resolves.toBeUndefined();
 expect(store.get('water',day).pending).toBe(false);expect(store.get('water',day).data?.total).toBe(500);
});
test('uncertain aggregate on incomplete page is unavailable after receipt replay',async()=>{
 const {api,store}=setup();api.tracking=async()=>({...page,has_more:true,total:10000});await store.load('water',day);
 api.saveMeasurement.mockResolvedValue(entry);api.tracking=async()=>{throw new ApiError('network');};
 await store.save('water',body,'partial-page');
 expect(store.get('water',day).data).toBeNull();expect(store.get('water',day).fresh).toBe(false);
});
it.each(['create','edit','delete'] as const)('confirmed weight %s cannot leave stale latest summary after refresh fails',async action=>{
 const {api,store}=setup();const weight={...entry,kind:'weight' as const,value:70};
 const updated={...weight,id:action==='create'?'b'.repeat(32):weight.id,value:69.5,version:action==='create'?1:2,occurred_at:'2026-10-11T07:00:00.000000+00:00'};
 api.tracking=async()=>({...page,items:[weight],total:null,latest:weight});await store.load('weight',day);
 api.saveMeasurement.mockResolvedValue(updated);api.deleteMeasurement.mockResolvedValue(undefined);
 api.tracking=async()=>{throw new ApiError('network');};
 await store.save('weight',{...body,value:action==='delete'?70:69.5,occurred_at:action==='delete'?body.occurred_at:'2026-10-11T10:00:00+03:00'},'weight-confirmed',action==='create'?null:weight,action==='delete');
 const data=store.get('weight',day).data!;
 expect(data.latest).toBeNull();expect(data.previous).toBeNull();expect(data.delta).toBeNull();
 expect(data.items.map(e=>e.value)).toEqual(action==='delete'?[]:action==='edit'?[69.5]:[69.5,70]);
});
test('restart receipt replay reconciles an intervening move between other dates',async()=>{
 const {api,store}=setup();await store.load('water',day);api.saveMeasurement.mockRejectedValueOnce(new ApiError('timeout'));
 await expect(store.save('water',body,'moved-after-commit')).rejects.toThrow();store.close();
 const intermediate={...entry,local_date:'2026-10-12',occurred_at:'2026-10-12T06:00:00.000000+00:00',version:2};
 api.tracking=async()=>({...page,from:intermediate.local_date,to:intermediate.local_date,items:[intermediate],total:250});
 const restarted=new TrackingStore('tracking-owner',api,()=>{});await restarted.load('water',intermediate.local_date);
 api.saveMeasurement.mockResolvedValue({...intermediate,local_date:'2026-10-13',occurred_at:'2026-10-13T06:00:00.000000+00:00',version:3});
 api.tracking=async()=>{throw new ApiError('network');};await restarted.retry();
 expect(restarted.get('water',intermediate.local_date).data?.total).toBe(0);
 expect(restarted.get('water',intermediate.local_date).data?.items).toEqual([]);
 expect(restarted.get('water',intermediate.local_date).pending).toBe(false);
});

test('external weight imports refresh loaded latest values and notify dependent trend/advice stores',async()=>{
 const {api,store,changed}=setup();await store.load('weight',day);
 const imported={...entry,kind:'weight' as const,value:70,source:'apple_health' as const,external_id:'healthkit:sample'};
 api.tracking=async()=>({...page,items:[imported],latest:imported,total:null});
 await store.externalChanged('weight',[day]);
 expect(store.get('weight',day).data?.latest).toEqual(imported);expect(store.get('weight',day).fresh).toBe(true);expect(changed).toHaveBeenCalledWith([day]);
 api.tracking=async()=>{throw new ApiError('network');};await store.externalChanged('weight',[day]);
 expect(store.get('weight',day).fresh).toBe(false);expect(store.get('weight',day).data?.latest).toBeNull();
});
