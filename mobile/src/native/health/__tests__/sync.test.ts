import {HealthSync} from '../sync';
import {validateSnapshot} from '../types';
const item={id:'a'.repeat(32),record_key:'meal:'+('b'.repeat(32))+':calories',revision:1,kind:'calories',unit:'kcal',value:100,start:'2026-10-15T09:00:00+00:00',end:'2026-10-15T09:00:00+00:00',local_date:'2026-10-15',timezone_id:'Asia/Jerusalem',provenance:'user_confirmed_unverified',deleted:false};
const snapshot={scope:'c'.repeat(32),items:[item],withheld:0};
function fixture(){
 let saved:unknown=null,alive=true;const samples=new Map<string,unknown>();let fail=false;let current=snapshot;
 const storage={read:async()=>saved,write:async(v:unknown)=>{if(fail)throw Error('disk');saved=JSON.parse(JSON.stringify(v));}};
 const native={bind:jest.fn(),stop:jest.fn(),status:async()=>({available:true,write:{calories:'authorized'},read:'unknown'}),authorize:async()=>{},apply:async(_session:string,scope:string,row:typeof item)=>{if(row.deleted)samples.delete(scope+row.id);else samples.set(scope+row.id,row);},read:async()=>[]};
 const applyBatch=async(session:string,scope:string,rows:typeof item[])=>{for(const row of rows)await native.apply(session,scope,row);};const port=Object.assign(native,{applyBatch});
 const api={captureSession:()=>()=>{if(!alive)throw Error('logout');},healthSnapshot:async()=>current,healthImport:async()=>({accepted:0,weight_dates:[] as string[]})};
 const sync=new HealthSync(api as never,native as never,storage,()=> 'session');
 return {sync,api,native:port,samples,storage,setSaved:(v:unknown)=>{saved=v;},getSaved:()=>saved,setFail:(v:boolean)=>{fail=v;},logout:()=>{alive=false;sync.close();},setCurrent:(v:typeof snapshot)=>{current=v;}};
}
test('repeated sync and restart replay preserve one stable sample',async()=>{const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});await f.sync.sync();await f.sync.sync();expect(f.samples.size).toBe(1);expect([...f.samples.values()][0]).toEqual(item);});
test('write succeeded but ack failed can retry without a duplicate',async()=>{const f=fixture();const write=f.storage.write;let calls=0;f.storage.write=async v=>{if(++calls===3)throw Error('disk');await write(v);};await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});await f.sync.sync().catch(()=>{});await f.sync.sync();expect(f.samples.size).toBe(1);});
test('new canonical revision replaces, tombstone removes only mapped sample',async()=>{const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});await f.sync.sync();f.setCurrent({...snapshot,items:[{...item,revision:2,value:200}]});await f.sync.sync();expect([...f.samples.values()][0]).toMatchObject({value:200,revision:2});f.setCurrent({...snapshot,items:[{...item,revision:3,deleted:true,value:null} as never]});await f.sync.sync();expect(f.samples.size).toBe(0);});
test('logout during snapshot await prevents native write',async()=>{const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});let resolve!:(v:typeof snapshot)=>void;f.api.healthSnapshot=()=>new Promise(r=>{resolve=r;});const pending=f.sync.sync();await new Promise(r=>setTimeout(r,0));f.logout();resolve(snapshot);await pending.catch(()=>{});expect(f.samples.size).toBe(0);});
test('failed durable enqueue prevents any native write',async()=>{const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});f.setFail(true);await expect(f.sync.sync()).rejects.toThrow();expect(f.samples.size).toBe(0);});
test('disconnect preserves server mapping but disables subsequent writes',async()=>{const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});await f.sync.disconnect();await f.sync.sync();expect(f.samples.size).toBe(0);expect(f.getSaved()).toMatchObject({connected:false});});
test('denied nutrient permission leaves pending item and ordinary API independent',async()=>{const f=fixture();f.native.status=async()=>({available:true,read:'unknown',write:{calories:'denied'}});await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});await f.sync.sync();expect(f.samples.size).toBe(0);expect(f.sync.state.blocked).toBe(1);});
test('malformed durable state fails closed',async()=>{const f=fixture();f.setSaved({connected:true});await expect(f.sync.restore()).rejects.toThrow();expect(f.samples.size).toBe(0);});
test.each([{...snapshot,items:[{...item,value:NaN}]},{...snapshot,items:[item,item]},{...snapshot,scope:'another account'},{...snapshot,items:[{...item,revision:0}]}])('rejects unsafe snapshot',bad=>{expect(()=>validateSnapshot(bad)).toThrow();});
test('reopened queue reconstructs pending work after native success and lost ack',async()=>{
 const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});
 const original=f.storage.write;let fail=true;f.storage.write=async v=>{if(f.samples.size&&fail){fail=false;throw Error('crashed after Health write');}await original(v);};
 await expect(f.sync.sync()).rejects.toThrow();expect(f.samples.size).toBe(1);
 f.sync.close();const next=new HealthSync(f.api as never,f.native as never,f.storage,()=> 'next-session');await next.sync();
 expect(f.samples.size).toBe(1);expect(f.getSaved()).toMatchObject({pending:{items:[]}});
});
test('edit during a native write is reconciled by queued refresh',async()=>{
 const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});const apply=f.native.apply;let resolve!:()=>void;let first=true;
 f.native.apply=async(...args)=>{if(first){first=false;await new Promise<void>(r=>{resolve=r;});}await apply(...args);};
 const initial=f.sync.sync();await new Promise(r=>setTimeout(r,0));f.setCurrent({...snapshot,items:[{...item,revision:2,value:250}]});const queued=f.sync.sync();resolve();await initial;await queued;
 expect([...f.samples.values()][0]).toMatchObject({revision:2,value:250});
});
test('background pauses queued work until explicit foreground resume',async()=>{const f=fixture();await f.sync.connect({nutrition:true,water:false,weight:false,steps:false});f.sync.pause();await f.sync.sync();expect(f.samples.size).toBe(0);f.sync.resume();await f.sync.sync();expect(f.samples.size).toBe(1);});
test('step and weight import includes source identity and no nutrition read selection',async()=>{const f=fixture();const sample={external_id:'d',kind:'weight',value:70,start:'2026-10-15T09:00:00Z',end:'2026-10-15T09:00:00Z',source_bundle:'com.example.scale',timezone_id:'UTC'};f.native.read=async()=>[sample] as never;let imported:unknown;f.api.healthImport=async(samples?:unknown)=>{imported=samples;return {accepted:1,weight_dates:[]};};await f.sync.connect({nutrition:false,water:false,weight:true,steps:true});await f.sync.sync();expect(imported).toEqual([sample]);expect(f.samples.size).toBe(0);});

const tick=()=>new Promise(r=>setTimeout(r,0));
const nutrition={nutrition:true,water:false,weight:false,steps:false};
test('overlapping startup and new consent cannot restore or read deselected weight',async()=>{
 const f=fixture();const old={version:1,connected:true,choices:{...nutrition,weight:true},pending:null};
 let release!:(v:unknown)=>void;let reads=0;f.storage.read=async()=>{reads++;return reads===1?new Promise(r=>{release=r;}):old;};
 const reading=jest.spyOn(f.native,'read');
 const startup=f.sync.sync().catch(()=>{});await tick();
 const connecting=f.sync.connect(nutrition);await tick();release(old);await startup;await connecting;await f.sync.sync();
 expect(reads).toBe(1);expect(f.getSaved()).toMatchObject({choices:nutrition});expect(reading).not.toHaveBeenCalled();
});
test('large unchanged history and restart avoid per-record persistence and native replay',async()=>{
 const f=fixture();const rows=Array.from({length:1000},(_,n)=>({...item,id:n.toString(16).padStart(32,'0')}));f.setCurrent({...snapshot,items:rows});
 const batches=jest.spyOn(f.native,'applyBatch'),apply=jest.spyOn(f.native,'apply'),write=jest.spyOn(f.storage,'write');await f.sync.connect(nutrition);write.mockClear();
 await f.sync.sync();expect(write.mock.calls.length).toBeLessThanOrEqual(22);expect(apply).toHaveBeenCalledTimes(1000);expect(batches).toHaveBeenCalledTimes(20);
 const bytes=write.mock.calls.reduce((n,[v])=>n+JSON.stringify(v).length,0);expect(bytes).toBeLessThan(1000000);console.info('P10 1000-record first sync:',write.mock.calls.length,'storage writes,',bytes,'serialized ASCII bytes; native batches:',batches.mock.calls.length);
 write.mockClear();apply.mockClear();await f.sync.sync();expect(write.mock.calls.length).toBeLessThanOrEqual(1);expect(apply).not.toHaveBeenCalled();
 f.sync.close();const next=new HealthSync(f.api as never,f.native as never,f.storage,()=> 'restart');await next.sync();expect(apply).not.toHaveBeenCalled();
});
test('successful import batches notify weight dates even when a later batch fails, but duplicate replays do not',async()=>{
 const f=fixture(),changed=jest.fn();const rows=Array.from({length:101},(_,n)=>({external_id:String(n),kind:'weight',value:70,start:item.start,end:item.end,source_bundle:'scale',timezone_id:'UTC'}));
 f.native.read=async()=>rows as never;let calls=0;f.api.healthImport=async()=>{if(++calls===2)throw Error('network');return {accepted:100,weight_dates:['2026-10-15']};};
 const service=new HealthSync(f.api as never,f.native as never,f.storage,()=> 'import-session',changed);
 await service.connect({...nutrition,weight:true});await expect(service.sync()).rejects.toThrow('network');expect(changed).toHaveBeenCalledTimes(1);expect(changed).toHaveBeenCalledWith(['2026-10-15']);
 f.api.healthImport=async()=>({accepted:100,weight_dates:[]});await service.sync();expect(changed).toHaveBeenCalledTimes(1);
});
test('disconnect during an in-flight native batch cannot persist connected state afterward',async()=>{
 const f=fixture();await f.sync.connect(nutrition);const apply=f.native.apply;let release!:()=>void;f.native.apply=async(...args)=>{await new Promise<void>(r=>{release=r;});await apply(...args);};
 const syncing=f.sync.sync().catch(()=>{});await tick();const disconnect=f.sync.disconnect();release();await syncing;await disconnect;
 expect(f.getSaved()).toMatchObject({connected:false});await f.sync.sync();expect(f.sync.state.connected).toBe(false);
});

test('acknowledged IDs from another owner scope never suppress fresh writes',async()=>{
 const f=fixture();await f.sync.connect(nutrition);await f.sync.sync();const apply=jest.spyOn(f.native,'apply');
 f.setCurrent({...snapshot,scope:'d'.repeat(32)});await f.sync.sync();expect(apply).toHaveBeenCalledTimes(1);
});
test('malformed persisted revision acknowledgements fail closed',async()=>{
 const f=fixture();f.setSaved({version:1,connected:true,choices:nutrition,pending:null,acknowledged:{scope:snapshot.scope,revisions:{[item.id]:-1}}});
 await expect(f.sync.sync()).rejects.toThrow('Invalid Health acknowledgements');expect(f.samples.size).toBe(0);
});
