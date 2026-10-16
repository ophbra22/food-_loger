import {HealthSync} from '../sync';
import type {HealthPort} from '../types';
const choices={nutrition:false,water:false,weight:true,steps:false};
const sample={operation:'upsert',external_id:'12345678-1234-1234-1234-123456789012',kind:'weight',value:70,start:'2026-10-16T10:00:00Z',end:'2026-10-16T10:00:00Z',source_bundle:'com.scale',modified_at:'2026-10-16T10:01:00Z',timezone_id:'UTC',start_offset_seconds:0,end_offset_seconds:0};
const page={events:[sample],nextCursor:'cursor1',hasMore:false,recovered:false};
function fixture(){
 let saved:any=null;let active=true;
 const api={captureSession:()=>()=>{if(!active)throw Error('account ended');},healthSnapshot:async()=>({scope:'a'.repeat(32),items:[],withheld:0}),healthImport:jest.fn(),healthConnectImport:jest.fn(async(events:unknown[])=>({accepted:events.length,weight_dates:['2026-10-16']}))};
 const port={bind:jest.fn(),stop:jest.fn(),authorize:jest.fn(async()=>{}),status:jest.fn(async()=>({available:true,read:'unknown',write:{},readGranted:{weight:true,steps:true}})),read:jest.fn(),applyBatch:jest.fn(),readPage:jest.fn(async()=>page)};
 const storage={read:async()=>saved,write:jest.fn(async(v:any)=>{saved=JSON.parse(JSON.stringify(v));})};const changed=jest.fn();
 const service=new HealthSync(api as never,port as unknown as HealthPort,storage,()=> 'session',changed);
 return {api,port,storage,service,changed,get:()=>saved,set:(v:any)=>saved=v,end:()=>{active=false;}};
}
test('persists page before upload and advances cursor only after all acknowledgements',async()=>{
 const f=fixture();await f.service.connect(choices);
 f.api.healthConnectImport.mockImplementation(async events=>{expect(f.get().pull.pending.page).toEqual(page);expect(f.get().pull.cursors.weight).toBeUndefined();return {accepted:events.length,weight_dates:[]};});
 await f.service.sync();expect(f.get().pull).toMatchObject({pending:null,cursors:{weight:'cursor1'}});expect(f.api.healthImport).not.toHaveBeenCalled();
});
test('lost acknowledgement replays durable page after restart without fetching newer changes',async()=>{
 const f=fixture();await f.service.connect(choices);f.api.healthConnectImport.mockRejectedValueOnce(Error('lost ack'));
 await expect(f.service.sync()).rejects.toThrow('lost ack');expect(f.get().pull.pending).toBeTruthy();
 f.service.close();f.port.readPage.mockClear();const next=new HealthSync(f.api as never,f.port as never,f.storage,()=> 'restart');
 await next.sync();expect(f.port.readPage).not.toHaveBeenCalled();expect(f.api.healthConnectImport).toHaveBeenCalledTimes(2);expect(f.get().pull.pending).toBeNull();
});
test('revoke permission while page is pending blocks upload; deselect drops pending without advancing',async()=>{
 const f=fixture();await f.service.connect(choices);f.api.healthConnectImport.mockRejectedValueOnce(Error('offline'));await expect(f.service.sync()).rejects.toThrow();
 f.port.status.mockResolvedValue({available:true,read:'unknown',write:{},readGranted:{weight:false,steps:true}});
 await f.service.sync();expect(f.api.healthConnectImport).toHaveBeenCalledTimes(1);expect(f.get().pull.pending).toBeTruthy();
 await f.service.connect({...choices,weight:false});expect(f.get().pull.pending).toBeNull();expect(f.get().pull.cursors.weight).toBeUndefined();
});
test('large changes pages upload in 100-event chunks and retain cursor if second chunk fails',async()=>{
 const f=fixture();f.port.readPage.mockResolvedValue({...page,events:Array.from({length:205},()=>sample)});
 await f.service.connect(choices);f.api.healthConnectImport.mockResolvedValueOnce({accepted:100,weight_dates:['2026-10-16']}).mockRejectedValueOnce(Error('offline'));
 await expect(f.service.sync()).rejects.toThrow();expect(f.api.healthConnectImport.mock.calls.map(([e])=>e.length)).toEqual([100,100]);expect(f.changed).toHaveBeenCalledWith(['2026-10-16']);expect(f.get().pull.cursors.weight).toBeUndefined();
 await f.service.sync();expect(f.get().pull.cursors.weight).toBe('cursor1');expect(f.api.healthConnectImport.mock.calls.map(([e])=>e.length)).toEqual([100,100,100,100,5]);
});
test('expired-token warning survives restart and incomplete pages remain retryable',async()=>{
 const f=fixture();let n=0;f.port.readPage.mockImplementation(async()=>({...page,nextCursor:String(++n),hasMore:true,recovered:n===1}));
 await f.service.connect(choices);await f.service.sync();expect(f.port.readPage).toHaveBeenCalledTimes(20);expect(f.service.state).toMatchObject({recovered:true,more:true});
 const next=new HealthSync(f.api as never,f.port as never,f.storage,()=> 'restart');await next.restore();expect(next.state.recovered).toBe(true);
});
test('account change after read prevents storage or uploads',async()=>{
 const f=fixture();f.port.readPage.mockImplementation(async()=>{f.end();return page;});await f.service.connect(choices);
 await expect(f.service.sync()).rejects.toThrow('account ended');expect(f.api.healthConnectImport).not.toHaveBeenCalled();expect(f.get().pull.pending).toBeNull();
});
test('permission activity background preserves consent request but does not sync while backgrounded',async()=>{
 const f=fixture();f.port.authorize.mockImplementation(async()=>{f.service.background();});await f.service.connect(choices);await f.service.sync();expect(f.port.readPage).not.toHaveBeenCalled();f.service.resume();await f.service.sync();expect(f.port.readPage).toHaveBeenCalledTimes(1);
});
test('storage failure before upload never sends health data',async()=>{
 const f=fixture();await f.service.connect(choices);const write=f.storage.write.getMockImplementation()!;f.storage.write.mockImplementation(async data=>{if(data.pull?.pending)throw Error('disk');await write(data);});
 await expect(f.service.sync()).rejects.toThrow('disk');expect(f.api.healthConnectImport).not.toHaveBeenCalled();
});
test('malformed saved import pages fail closed',async()=>{
 const f=fixture();await f.service.connect(choices);f.set({...f.get(),pull:{scope:'a'.repeat(32),cursors:{},pending:{kind:'weight',page:{...page,events:[{...sample,kind:'nutrition'}]}},recovered:false}});
 const next=new HealthSync(f.api as never,f.port as never,f.storage,()=> 'restart');await expect(next.restore()).rejects.toThrow();
});
test('permission revoked between read and upload prevents transmission',async()=>{
 const f=fixture();f.port.readPage.mockImplementation(async()=>{f.port.status.mockResolvedValue({available:true,read:'unknown',write:{},readGranted:{weight:false,steps:true}});return page;});await f.service.connect(choices);await f.service.sync();expect(f.api.healthConnectImport).not.toHaveBeenCalled();expect(f.get().pull.pending).toBeTruthy();
});
