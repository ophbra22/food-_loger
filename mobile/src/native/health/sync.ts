import {object} from '@/domain/library';
import {validateSnapshot,validateChoices,validateImportPage,type ReadKind,type ImportPage,type ConnectEvent,validateImportResult,emptyChoices,type Choices,type HealthPort,type HealthSnapshot,type HealthSample,type HealthRecord} from './types';
type Api={healthConnectImport?:(events:ConnectEvent[])=>Promise<unknown>;captureSession:()=>()=>void;healthSnapshot:()=>Promise<HealthSnapshot>;healthImport:(samples:HealthSample[])=>Promise<unknown>};
type Acknowledged={scope:string;revisions:Record<string,number>};
type Pull={scope:string;cursors:Partial<Record<ReadKind,string>>;pending:{kind:ReadKind;page:ImportPage}|null;recovered:boolean};
type Saved={pull?:Pull;version:1;connected:boolean;choices:Choices;pending:HealthSnapshot|null;acknowledged?:Acknowledged};
export type HealthStorage={read:()=>Promise<unknown>;write:(value:Saved)=>Promise<void>};
const BATCH_SIZE=50;
export class HealthSync {
 private data:Saved={version:1,connected:false,choices:emptyChoices(),pending:null};
 private authorizing=false;
 private paused=false;private closed=false;private loaded=false;private restoring:Promise<void>|null=null;
 private serial=0;private session:string;private queue:Promise<unknown>=Promise.resolve();private listeners=new Set<()=>void>();
 state={recovered:false,more:false,availability:'unavailable' as 'available'|'install_required'|'unavailable',readGranted:{} as Partial<Record<ReadKind,boolean>>,connected:false,busy:false,error:false,blocked:0,withheld:0,imported:0,available:false,read:'unknown' as const,imports:[] as HealthSample[]};
 constructor(private api:Api,private port:HealthPort,private storage:HealthStorage,identity:()=>string,private imported:(dates:string[])=>void|Promise<void>=()=>{}){this.session=identity();}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(p:Partial<typeof this.state>){if(!this.closed){this.state={...this.state,...p};this.listeners.forEach(f=>f());}}
 private guard(){const n=this.serial,assert=this.api.captureSession();return()=>{assert();if(this.closed||n!==this.serial)throw Error('Health session ended');};}
 private enqueue(run:()=>Promise<void>){const task=this.queue.then(run,run);this.queue=task;return task;}
 private async persist(data:Saved){await this.storage.write(data);this.data=data;}
 async restore(){
  if(this.loaded)return;if(this.restoring)return this.restoring;
  // Pausing a same-owner operation must not start a second storage read. Consent
  // mutations wait on this one initialization and the serialized operation queue.
  const assert=this.api.captureSession();
  this.restoring=(async()=>{
   const raw=await this.storage.read();assert();if(this.closed)throw Error('Health session ended');
   if(raw!==null){
    if(!object(raw)||raw.version!==1||typeof raw.connected!=='boolean'||!('pending' in raw))throw Error('Invalid saved Health state');
    validateChoices(raw.choices);if(raw.pending!==null)validateSnapshot(raw.pending);
    const ack=raw.acknowledged;
    if(ack!==undefined&&(!object(ack)||typeof ack.scope!=='string'||!/^[a-f0-9]{32}$/.test(ack.scope)||!object(ack.revisions)||Object.keys(ack.revisions).length>10000||Object.entries(ack.revisions).some(([id,v])=>!/^[a-f0-9]{32}$/.test(id)||!Number.isSafeInteger(v)||Number(v)<1)))throw Error('Invalid Health acknowledgements');
    if(raw.pull!==undefined){
     const p=raw.pull;
     if(!object(p)||typeof p.scope!=='string'||!/^[a-f0-9]{32}$/.test(p.scope)||!object(p.cursors)||Object.entries(p.cursors).some(([k,v])=>!['weight','steps'].includes(k)||typeof v!=='string'||!v||v.length>32768)||typeof p.recovered!=='boolean')throw Error('Invalid Health cursors');
     if(p.pending!==null){if(!object(p.pending)||!['weight','steps'].includes(String(p.pending.kind)))throw Error('Invalid pending Health page');validateImportPage(p.pending.page,p.pending.kind as ReadKind);}
    }
    this.data=raw as Saved;
   }
   this.loaded=true;this.publish({connected:this.data.connected,recovered:this.data.pull?.recovered??false});
  })().finally(()=>{this.restoring=null;});return this.restoring;
 }
 connect(choices:Choices){
  const selected={...validateChoices(choices)};this.pause();const check=this.guard();
  return this.enqueue(async()=>{
   check();this.resume();await this.restore();check();this.authorizing=true;this.publish({busy:true});
   try {
    await this.port.authorize(selected);check();
    const status=await this.port.status();check();if(!status.available)throw Error('Health unavailable');
    const pull=this.data.pull;const pending=pull?.pending;
    await this.persist({...this.data,connected:true,choices:selected,...(pull?{pull:{...pull,pending:pending&&!selected[pending.kind]?null:pending??null}}:{})});check();
    this.publish({connected:true,available:true,error:false,availability:status.availability??'available',readGranted:status.readGranted??{}});
   }finally{this.authorizing=false;this.publish({busy:false});}
  });
 }
 choices(){return this.data.choices;}
 background(){if(this.authorizing){this.paused=true;this.port.stop(this.session);}else this.pause();}
 async manage(){await this.port.manage?.();}
 async refreshStatus(){const check=this.guard();const status=await this.port.status();check();this.publish({available:status.available,availability:status.availability??(status.available?'available':'unavailable'),readGranted:status.readGranted??{}});}
 resume(){this.paused=false;}
 close(){this.closed=true;this.serial++;this.port.stop(this.session);this.listeners.clear();}
 pause(){this.paused=true;this.serial++;this.port.stop(this.session);}
 disconnect(){
  this.pause();const check=this.guard();
  return this.enqueue(async()=>{await this.restore();check();await this.persist({...this.data,connected:false});check();this.publish({connected:false,busy:false});});
 }
 sync():Promise<void>{return this.enqueue(()=>this.run());}
 private async run(){
  const check=this.guard();await this.restore();check();if(!this.data.connected||this.paused)return;
  this.publish({busy:true,error:false,blocked:0,more:false});
  try{
   const status=await this.port.status();check();this.publish({available:status.available,availability:status.availability??(status.available?'available':'unavailable'),readGranted:status.readGranted??{}});if(!status.available)throw Error('Health unavailable');
   // Server mappings/tombstones are the durable outbox. Keep compact revision
   // checkpoints locally, rather than rewriting all food payloads after each item.
   const snapshot=validateSnapshot(await this.api.healthSnapshot());check();
   const acknowledged=this.data.acknowledged?.scope===snapshot.scope?this.data.acknowledged:{scope:snapshot.scope,revisions:{}};
   const next={...this.data,acknowledged,pending:{...snapshot,items:[]}};
   if(JSON.stringify(next)!==JSON.stringify(this.data)){await this.persist(next);check();}
   this.port.bind(this.session,snapshot.scope);this.publish({withheld:snapshot.withheld});
   let blocked=0;const work:HealthRecord[]=[];
   for(const item of snapshot.items){
    const selected=item.kind==='water'?this.data.choices.water:this.data.choices.nutrition;
    if(!selected||(acknowledged.revisions[item.id]??0)>=item.revision)continue;
    if(status.write[item.kind]!=='authorized'){blocked++;continue;}work.push(item);
   }
   this.publish({blocked});
   for(let i=0;i<work.length;i+=BATCH_SIZE){
    check();const batch=work.slice(i,i+BATCH_SIZE);await this.port.applyBatch(this.session,snapshot.scope,batch);check();
    const revisions={...this.data.acknowledged!.revisions};for(const row of batch)revisions[row.id]=row.revision;
    await this.persist({...this.data,acknowledged:{scope:snapshot.scope,revisions}});check();
   }
   if(this.port.readPage){await this.pull(snapshot.scope,check);}
   else if(this.data.choices.weight||this.data.choices.steps){
    const now=new Date(),from=new Date(now.getTime()-30*86400000);
    const samples=await this.port.read(this.session,snapshot.scope,this.data.choices,from.toISOString(),now.toISOString());check();
    for(let i=0;i<samples.length;i+=100){
     const result=validateImportResult(await this.api.healthImport(samples.slice(i,i+100)));check();
     if(result.weight_dates.length){await this.imported(result.weight_dates);check();}
    }
    this.publish({imported:samples.length,imports:samples});
   }
  }catch(error){this.publish({error:true});throw error;}finally{this.publish({busy:false});}
 }
 private async pull(scope:string,check:()=>void){
  if(!this.api.healthConnectImport||!this.port.readPage)throw Error('Health Connect transport unavailable');
  if(this.data.pull?.scope!==scope){await this.persist({...this.data,pull:{scope,cursors:{},pending:null,recovered:this.data.pull?.recovered??false}});check();}
  for(const kind of ['weight','steps'] as const){
   if(!this.data.choices[kind])continue;
   for(let n=0;n<20;n++){
    check();const status=await this.port.status();check();this.publish({readGranted:status.readGranted??{}});
    if(!status.available||!status.readGranted?.[kind]){this.publish({blocked:this.state.blocked+1});break;}
    let pending=this.data.pull!.pending;
    if(pending&&pending.kind!==kind)continue;
    if(!pending){
     const now=new Date(),from=new Date(now.getTime()-30*86400000);
     const page=validateImportPage(await this.port.readPage(this.session,scope,kind,this.data.pull!.cursors[kind]??null,from.toISOString(),now.toISOString()),kind);check();
     if(page.hasMore&&page.nextCursor===this.data.pull!.cursors[kind])throw Error('Health cursor did not advance');
     pending={kind,page};await this.persist({...this.data,pull:{...this.data.pull!,pending,recovered:this.data.pull!.recovered||page.recovered}});check();
     this.publish({recovered:this.data.pull!.recovered});
    }
    const page=pending.page;
    for(let i=0;i<page.events.length;i+=100){
     const permission=await this.port.status();check();
     if(!permission.available||!permission.readGranted?.[kind]){this.publish({blocked:this.state.blocked+1,readGranted:permission.readGranted??{}});return;}
     const chunk=page.events.slice(i,i+100);
     const result=validateImportResult(await this.api.healthConnectImport(chunk));check();
     if(result.accepted!==chunk.length)throw Error('Incomplete Health acknowledgement');
     if(result.weight_dates.length){await this.imported(result.weight_dates);check();}
    }
    await this.persist({...this.data,pull:{...this.data.pull!,pending:null,cursors:{...this.data.pull!.cursors,[kind]:page.nextCursor}}});check();
    this.publish({imported:this.state.imported+page.events.length,imports:page.events.filter((e):e is Extract<ConnectEvent,{operation:'upsert'}>=>e.operation==='upsert').slice(-10)});
    if(!page.hasMore)break;
    if(n===19)this.publish({more:true});
   }
  }
 }

}
