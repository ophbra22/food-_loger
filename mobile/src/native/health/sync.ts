import {validateSnapshot,validateChoices,emptyChoices,type Choices,type HealthPort,type HealthSnapshot,type HealthSample} from './types';
type Api={captureSession:()=>()=>void;healthSnapshot:()=>Promise<HealthSnapshot>;healthImport:(samples:Awaited<ReturnType<HealthPort['read']>>)=>Promise<unknown>};
type Saved={version:1;connected:boolean;choices:Choices;pending:HealthSnapshot|null};
export type HealthStorage={read:()=>Promise<unknown>;write:(value:Saved)=>Promise<void>};
export class HealthSync{
 private data:Saved={version:1,connected:false,choices:emptyChoices(),pending:null};
 private paused=false;private closed=false;private loaded=false;private serial=0;private session:string;private queue:Promise<unknown>=Promise.resolve();private listeners=new Set<()=>void>();
 state={connected:false,busy:false,error:false,blocked:0,withheld:0,imported:0,available:false,read:'unknown' as const,imports:[] as HealthSample[]};
 constructor(private api:Api,private port:HealthPort,private storage:HealthStorage,identity:()=>string){this.session=identity();}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private publish(p:Partial<typeof this.state>){if(!this.closed){this.state={...this.state,...p};this.listeners.forEach(f=>f());}}
 private guard(){const n=this.serial,assert=this.api.captureSession();return()=>{assert();if(this.closed||n!==this.serial)throw Error('Health session ended');};}
 async restore(){if(this.loaded)return;const check=this.guard(),raw=await this.storage.read();check();if(raw!==null){const v=raw as Saved;if(v.version!==1||typeof v.connected!=='boolean'||!('pending' in v))throw Error('Invalid saved Health state');validateChoices(v.choices);if(v.pending!==null)validateSnapshot(v.pending);this.data=v;}this.loaded=true;this.publish({connected:this.data.connected});}
 async connect(choices:Choices){this.resume();const check=this.guard();await this.restore();check();validateChoices(choices);await this.port.authorize(choices);check();const status=await this.port.status();check();if(!status.available)throw Error('Health unavailable');this.data={...this.data,connected:true,choices};await this.storage.write(this.data);check();this.publish({connected:true,available:true,error:false});}
 choices(){return this.data.choices;}
 resume(){this.paused=false;}
 close(){this.closed=true;this.serial++;this.port.stop(this.session);this.listeners.clear();}
 pause(){this.paused=true;this.serial++;this.port.stop(this.session);}
 async disconnect(){this.pause();const check=this.guard();await this.restore();check();this.data={...this.data,connected:false};await this.storage.write(this.data);check();this.publish({connected:false,busy:false});}
 sync():Promise<void>{const run=()=>this.run();const task=this.queue.then(run,run);this.queue=task;return task;}
 private async run(){
  const check=this.guard();await this.restore();check();if(!this.data.connected||this.paused)return;
  this.publish({busy:true,error:false,blocked:0});
  try{
   const status=await this.port.status();check();this.publish({available:status.available});if(!status.available)throw Error('Health unavailable');
   // Fresh server snapshot replaces stale pending values; the server retains tombstones.
   const snapshot=validateSnapshot(await this.api.healthSnapshot());check();
   this.data={...this.data,pending:snapshot};await this.storage.write(this.data);check();
   this.port.bind(this.session,snapshot.scope);this.publish({withheld:snapshot.withheld});
   let blocked=0;
   for(const item of snapshot.items){
    check();const selected=item.kind==='water'?this.data.choices.water:this.data.choices.nutrition;
    if(!selected)continue;
    if(status.write[item.kind]!=='authorized'){blocked++;continue;}
    await this.port.apply(this.session,snapshot.scope,item);check();
    this.data={...this.data,pending:{...snapshot,items:this.data.pending!.items.filter(i=>i.id!==item.id)}};
    await this.storage.write(this.data);check();
   }
   this.publish({blocked});
   if(this.data.choices.weight||this.data.choices.steps){
    const now=new Date(),from=new Date(now.getTime()-30*86400000);
    const samples=await this.port.read(this.session,snapshot.scope,this.data.choices,from.toISOString(),now.toISOString());check();
    for(let i=0;i<samples.length;i+=100){await this.api.healthImport(samples.slice(i,i+100));check();}
    this.publish({imported:samples.length,imports:samples});
   }
  }catch(error){this.publish({error:true});throw error;}finally{this.publish({busy:false});}
 }
}
