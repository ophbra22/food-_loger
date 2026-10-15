import {HealthSync} from '../sync';
import {validateSnapshot} from '../types';
const item={id:'a'.repeat(32),record_key:'meal:'+('b'.repeat(32))+':calories',revision:1,kind:'calories',unit:'kcal',value:100,start:'2026-10-15T09:00:00+00:00',end:'2026-10-15T09:00:00+00:00',local_date:'2026-10-15',timezone_id:'Asia/Jerusalem',provenance:'user_confirmed_unverified',deleted:false};
const snapshot={scope:'c'.repeat(32),items:[item],withheld:0};
function fixture(){
 let saved:unknown=null,alive=true;const samples=new Map<string,unknown>();let fail=false;let current=snapshot;
 const storage={read:async()=>saved,write:async(v:unknown)=>{if(fail)throw Error('disk');saved=JSON.parse(JSON.stringify(v));}};
 const native={bind:jest.fn(),stop:jest.fn(),status:async()=>({available:true,write:{calories:'authorized'},read:'unknown'}),authorize:async()=>{},apply:async(_session:string,scope:string,row:typeof item)=>{if(row.deleted)samples.delete(scope+row.id);else samples.set(scope+row.id,row);},read:async()=>[]};
 const api={captureSession:()=>()=>{if(!alive)throw Error('logout');},healthSnapshot:async()=>current,healthImport:async()=>({accepted:0})};
 const sync=new HealthSync(api as never,native as never,storage,()=> 'session');
 return {sync,api,native,samples,storage,setSaved:(v:unknown)=>{saved=v;},getSaved:()=>saved,setFail:(v:boolean)=>{fail=v;},logout:()=>{alive=false;sync.close();},setCurrent:(v:typeof snapshot)=>{current=v;}};
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
test('step and weight import includes source identity and no nutrition read selection',async()=>{const f=fixture();const sample={external_id:'d',kind:'weight',value:70,start:'2026-10-15T09:00:00Z',end:'2026-10-15T09:00:00Z',source_bundle:'com.example.scale',timezone_id:'UTC'};f.native.read=async()=>[sample] as never;let imported:unknown;f.api.healthImport=async(samples?:unknown)=>{imported=samples;return {accepted:1};};await f.sync.connect({nutrition:false,water:false,weight:true,steps:true});await f.sync.sync();expect(imported).toEqual([sample]);expect(f.samples.size).toBe(0);});
