import type { Api } from '@/api/endpoints';
import { ApiError,isApiError } from '@/api/errors';
import { GOAL_LIMITS,goalWarnings,type GoalDocument,type GoalUpdate } from '@/domain/goals';
import { goalsCache } from '@/storage/goals-cache';
import { captureAccountStorage } from '@/storage/kv';
export type GoalsState={data:GoalDocument|null;enabled:boolean|null;fresh:boolean;loading:boolean;saving:boolean;error:ApiError|null;savedAt:number|null};
export const EMPTY_GOALS:GoalsState={data:null,enabled:null,fresh:false,loading:false,saving:false,error:null,savedAt:null};
type GoalApi=Partial<Pick<Api,'getGoals'|'putGoals'|'capabilities'|'captureSession'>>;
export class GoalsStore {
 private state:GoalsState=EMPTY_GOALS;
 private listeners=new Set<()=>void>();
 private closed=false;
 private generation=0;
 private loaded=false;
 private pending:Promise<void>|null=null;
 constructor(readonly owner:string,private api:GoalApi) {}
 get=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
 private set(patch:Partial<GoalsState>) {if(this.closed)return;this.state={...this.state,...patch};this.listeners.forEach(f=>f());}
 close(){this.closed=true;this.generation++;this.state=EMPTY_GOALS;this.listeners.clear();}
 accept(data:GoalDocument) {
  if(this.closed || this.state.enabled!==true || this.state.saving || data.version<(this.state.data?.version??0))return;
  const savedAt=Date.now();this.set({data,savedAt,fresh:true,error:null});void goalsCache.write(this.owner,data,savedAt);
 }
 async load() {
  if(this.closed)return;
  if(!this.loaded) {
   this.loaded=true;const generation=this.generation;
   const cached=await goalsCache.read(this.owner);
   if(cached && !this.closed && generation===this.generation && !this.state.data)this.set({...cached,enabled:true,fresh:false});
  }
  await this.refresh();
 }
 refresh():Promise<void> {
  if(this.closed)return Promise.resolve();
  if(this.pending)return this.pending;
  const generation=this.generation;
  this.pending=this.read(generation).finally(()=>{this.pending=null;});return this.pending;
 }
 private async read(generation:number) {
  const current=()=>!this.closed && generation===this.generation;
  if(!this.api.getGoals || !this.api.capabilities){this.set({enabled:false});return;}
  this.set({loading:true,error:null});
  try {
   const enabled=(await this.api.capabilities()).goals===true;
   if(!current())return;
   if(!enabled){this.set({enabled:false,data:null,fresh:true,loading:false});await goalsCache.remove(this.owner);return;}
   this.set({enabled:true});const data=await this.api.getGoals();
   if(current()){this.accept(data);this.set({loading:false});}
  } catch(error) {
   if(current())this.set({fresh:false,loading:false,error:isApiError(error)?error:new ApiError('server')});
  }
 }
 async save(update:GoalUpdate) {
  if(this.closed)throw new ApiError('unauthorized');
  if(!this.state.enabled || !this.api.putGoals)throw new ApiError('unavailable');
  if(this.state.saving || !this.state.fresh || !this.state.data || update.expected_version!==this.state.data.version)throw new ApiError('conflict');
  const assertSession=this.api.captureSession?.()??(()=>{}),assertStorage=captureAccountStorage(this.owner);
  assertSession();assertStorage();const before=this.state;this.generation++;
  const optimistic={...update,id:'0'.repeat(32),version:update.expected_version+1,created_at:new Date().toISOString(),warnings:goalWarnings(update)};
  const data={version:optimistic.version,revisions:[...before.data!.revisions,optimistic]};
  this.set({data,saving:true,loading:false,error:null});
  try {
   const confirmed=await this.api.putGoals(update);
   assertSession();assertStorage();if(this.closed)throw new ApiError('unauthorized');
   const latest=confirmed.revisions.at(-1);
   if(confirmed.version!==update.expected_version+1 || !latest || latest.effective_local_date!==update.effective_local_date ||
     (Object.keys(GOAL_LIMITS) as (keyof typeof GOAL_LIMITS)[]).some(k=>latest[k]!==update[k]))throw new ApiError('server');
   this.set({saving:false});this.accept(confirmed);
  }catch(error){
   this.set({...before,saving:false,loading:false,fresh:false,error:isApiError(error)?error:new ApiError('server')});throw error;
  }
 }
}
