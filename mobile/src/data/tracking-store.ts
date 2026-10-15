import type {Api} from '@/api/endpoints';
import {ApiError,isApiError} from '@/api/errors';
import {accountKey,captureAccountStorage,readJson,remove,writeJson} from '@/storage/kv';
import {validateTrackingPage,measurementContext,normalizeValue,type Measurement,type MeasurementBody,type TrackingKind,type TrackingPage} from '@/domain/tracking';
import {sum} from '@/domain/exact';
import {object} from '@/domain/library';
export type TrackingState={data:TrackingPage|null;enabled:boolean|null;writable:boolean;fresh:boolean;loading:boolean;saving:boolean;pending:boolean;error:ApiError|null};
export const EMPTY_TRACKING:TrackingState={data:null,enabled:null,writable:false,fresh:false,loading:false,saving:false,pending:false,error:null};
type Operation={kind:TrackingKind;body:MeasurementBody;key:string;entry:Measurement|null;deleting:boolean};
type TrackingApi=Partial<Pick<Api,'capabilities'|'tracking'|'saveMeasurement'|'deleteMeasurement'|'captureSession'>>;
export class TrackingStore {
 private states=new Map<string,TrackingState>();
 private listeners=new Set<()=>void>();
 private generation=0;private closed=false;private busy=false;
 private operation:Operation|null=null;private restored=false;private restoring:Promise<void>|null=null;
 private reads=new Map<string,number>();
 constructor(private owner:string,private api:TrackingApi,private changed:(dates:string[])=>void){}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 get=(kind:TrackingKind,day:string)=>this.states.get(`${kind}:${day}`)??EMPTY_TRACKING;
 private set(key:string,patch:Partial<TrackingState>){if(this.closed)return;this.states.set(key,{...(this.states.get(key)??EMPTY_TRACKING),...patch});this.listeners.forEach(f=>f());}
 close(){this.closed=true;this.generation++;this.states.clear();this.listeners.clear();}
 private async restore(){
  if(this.restored)return;if(this.restoring)return this.restoring;
  this.restoring=(async()=>{const value=await readJson<unknown>(accountKey(this.owner,'tracking-pending'),true);if(this.closed)return;
   if(value!==null){if(!object(value)||!['water','weight'].includes(String(value.kind))||typeof value.key!=='string'||typeof value.deleting!=='boolean'||!object(value.body))throw new ApiError('draftFormat');
    const op=value as Operation;measurementContext(op.body.occurred_at,op.body.timezone_id);normalizeValue(op.body.value,op.kind==='weight'?'kg':'ml');this.operation=op;}
   this.restored=true;
  })().finally(()=>{this.restoring=null;});return this.restoring;
 }
 async load(kind:TrackingKind,day:string,more=false){
  if(this.closed||this.busy)return;
  const key=`${kind}:${day}`,generation=this.generation,request=(this.reads.get(key)??0)+1;this.reads.set(key,request);
  const current=()=>!this.closed&&generation===this.generation&&this.reads.get(key)===request;
  this.set(key,{loading:true,error:null});
  try{
   await this.restore();if(!current())return;
   this.set(key,{pending:!!this.operation});
   if(!this.get(kind,day).data){const cached=await readJson<unknown>(accountKey(this.owner,'tracking:'+key));if(current()&&cached){try{this.set(key,{data:validateTrackingPage(cached,kind,day,day),fresh:false});}catch{/* ignore invalid derived cache */}}}
   const caps=await this.api.capabilities?.();if(!current())return;
   if(!caps?.tracking||!this.api.tracking){this.set(key,{enabled:false,writable:false,data:null,loading:false,fresh:true});return;}
   this.set(key,{enabled:true,writable:!!caps.tracking_writes});
   const before=this.get(kind,day).data,offset=more?before?.items.length??0:0;
   const result=await this.api.tracking(kind,day,day,offset);if(!current())return;
   const data=more&&before?{...result,items:[...before.items,...result.items.filter(i=>!before.items.some(b=>b.id===i.id))]}:result;
   this.set(key,{data,loading:false,fresh:true});
   // Persist only one bounded first page; additional history is fetched explicitly.
   if(!more)void writeJson(accountKey(this.owner,'tracking:'+key),result);
  }catch(error){if(current())this.set(key,{loading:false,fresh:false,error:isApiError(error)?error:new ApiError('server')});}
 }
 async save(kind:TrackingKind,body:MeasurementBody,key:string,entry:Measurement|null=null,deleting=false){
  if(this.closed)throw new ApiError('unauthorized');
  await this.restore();if(this.busy||this.operation)throw new ApiError('conflict');
  const state=this.get(kind,entry?.local_date??body.local_date);
  if(!state.enabled||!state.writable||!state.fresh)throw new ApiError('unavailable');
  measurementContext(body.occurred_at,body.timezone_id);normalizeValue(body.value,kind==='weight'?'kg':'ml');
  const op={kind,body,key,entry,deleting};
  this.busy=true;
  const assertStorage=captureAccountStorage(this.owner),assertSession=this.api.captureSession?.()??(()=>{});
  try{await writeJson(accountKey(this.owner,'tracking-pending'),op,true);assertStorage();assertSession();if(this.closed)throw new ApiError('unauthorized');this.operation=op;}
  finally{this.busy=false;}
  return this.retry();
 }
 async retry(){
  if(this.closed)throw new ApiError('unauthorized');
  await this.restore();if(!this.operation||this.busy)throw new ApiError('conflict');
  const op=this.operation,assertStorage=captureAccountStorage(this.owner),assertSession=this.api.captureSession?.()??(()=>{});
  assertStorage();assertSession();this.busy=true;this.generation++;
  const before=new Map(this.states),dates=[...new Set([op.body.local_date,...(op.entry?[op.entry.local_date]:[])])];
  const optimistic:Measurement={...op.body,id:op.entry?.id??'pending',kind:op.kind,version:(op.entry?.version??0)+1,source:op.body.source??'manual',external_id:op.body.external_id??null,created_at:op.entry?.created_at??new Date().toISOString(),updated_at:new Date().toISOString()};
  for(const [key,state] of this.states){
   if(!key.startsWith(op.kind+':'))continue;
   const day=key.slice(op.kind.length+1);let data=state.data;
   if(data&&dates.includes(day)){
    const items=data.items.filter(i=>i.id!==op.entry?.id);if(!op.deleting&&op.body.local_date===day)items.unshift(optimistic);
    const old=op.entry?.local_date===day?op.entry.value:0,newValue=!op.deleting&&op.body.local_date===day?op.body.value:0;
    data={...data,items,total:op.kind==='water'?sum([Math.max(0,(data.total??0)-old),newValue]):null};
   }
   this.set(key,{data,saving:true,pending:true,loading:false,error:null});
  }
  try{
   let confirmed:Measurement|null=null;
   if(op.deleting&&op.entry){if(!this.api.deleteMeasurement)throw new ApiError('unavailable');await this.api.deleteMeasurement(op.kind,op.entry.id,op.entry.version);}
   else {if(!this.api.saveMeasurement)throw new ApiError('unavailable');const result=await this.api.saveMeasurement(op.kind,op.body,op.entry,op.key);
    if(result.kind!==op.kind||result.value!==op.body.value||result.local_date!==op.body.local_date||(op.entry&&result.id!==op.entry.id))throw new ApiError('server');confirmed=result;}
   assertStorage();assertSession();if(this.closed)throw new ApiError('unauthorized');
   await remove(accountKey(this.owner,'tracking-pending'),true);this.operation=null;
   // Keep the server-confirmed delta even if the next network read is unavailable.
   for(const [key,state] of this.states){
    let data=state.data;
    if(data&&key.startsWith(op.kind+':')){
     data={...data,items:data.items.map(i=>i.id===optimistic.id&&confirmed?confirmed:i)};
     this.set(key,{data,saving:false,pending:false,fresh:false,loading:false});
     void writeJson(accountKey(this.owner,'tracking:'+key),{...data,items:data.items.slice(0,100),has_more:data.has_more||data.items.length>100});
    }else this.set(key,{saving:false,pending:false,fresh:false,loading:false});
   }
   this.changed(dates);this.busy=false;
   await Promise.all([...this.states.keys()].filter(k=>k.startsWith(op.kind+':')).map(k=>this.load(op.kind,k.slice(op.kind.length+1))));
  }catch(error){
   for(const [key,state] of before)this.set(key,{...state,saving:false,pending:!!this.operation,loading:false,fresh:false,error:isApiError(error)?error:new ApiError('server')});
   throw error;
  }finally{this.busy=false;}
 }
 /** Explicitly abandon only a definitive rejection, never an uncertain network outcome. */
 async clearRejected(){
  if(this.busy||!this.operation)throw new ApiError('conflict');
  const errors=[...this.states.values()].map(s=>s.error).filter(Boolean);
  if(!errors.some(e=>e&&['validation','conflict','notFound','forbidden'].includes(e.kind)))throw new ApiError('conflict');
  await remove(accountKey(this.owner,'tracking-pending'),true);this.operation=null;
  for(const key of this.states.keys())this.set(key,{pending:false,error:null});
 }
}
