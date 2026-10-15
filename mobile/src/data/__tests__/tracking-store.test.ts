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
