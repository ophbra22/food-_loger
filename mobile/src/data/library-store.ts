import type {Api} from '@/api/endpoints';
import {ApiError,isApiError} from '@/api/errors';
import {validateLibraryPage,type LibraryPage,type LibraryEntry} from '@/domain/library';
import {accountKey,readJson,writeJson,remove,captureAccountStorage} from '@/storage/kv';
type State={data:LibraryPage|null;fresh:boolean;loading:boolean;enabled:boolean|null;error:ApiError|null};
const EMPTY:State={data:null,fresh:false,loading:false,enabled:null,error:null};
export type LibraryApi=Partial<Pick<Api,'library'|'capabilities'|'setFavorite'|'captureSession'>>;
export class LibraryStore {
 private states=new Map<string,State>();private listeners=new Set<()=>void>();private closed=false;private generation=0;
 private requests=new Map<string,number>();
 constructor(readonly owner:string,private api:LibraryApi,private namespace='library'){}
 private key(favorites=false,query='',offset=0){return JSON.stringify([favorites,query,offset]);}
 get=(favorites=false,query='',offset=0)=>this.states.get(this.key(favorites,query,offset))??EMPTY;
 subscribe=(f:()=>void)=>{this.listeners.add(f);return ()=>{this.listeners.delete(f);};};
 private set(key:string,patch:Partial<State>){if(this.closed)return;this.states.set(key,{...(this.states.get(key)??EMPTY),...patch});this.listeners.forEach(f=>f());}
 invalidate(){this.generation++;for(const key of this.states.keys())this.set(key,{fresh:false,loading:false});}
 close(){this.closed=true;this.generation++;this.states.clear();this.listeners.clear();}
 private cacheKey(favorites:boolean){return accountKey(this.owner,this.namespace+':v1:'+String(favorites));}
 async load(favorites=false,query='',offset=0){
  const key=this.key(favorites,query,offset),generation=this.generation;
  if(!query&&!offset&&!this.get(favorites).data){
   const cached=await readJson<{owner:string;schema:number;data:unknown}>(this.cacheKey(favorites));
   if(!this.closed&&generation===this.generation&&cached?.owner===this.owner&&cached.schema===1){
    try{this.set(key,{data:validateLibraryPage(cached.data),fresh:false,enabled:true});}catch{}
   }
  }
  await this.refresh(favorites,query,offset);
 }
 async refresh(favorites=false,query='',offset=0){
  if(this.closed)return;
  const key=this.key(favorites,query,offset),generation=this.generation,request=(this.requests.get(key)??0)+1;
  this.requests.set(key,request);const current=()=>!this.closed&&this.generation===generation&&this.requests.get(key)===request;
  const assertStorage=captureAccountStorage(this.owner);this.set(key,{loading:true,error:null});
  try{
   const caps=await this.api.capabilities?.();if(!current())return;
   if(!caps?.library){this.set(key,{data:null,enabled:false,fresh:true,loading:false});await remove(this.cacheKey(favorites));return;}
   if(!this.api.library)throw new ApiError('unavailable');
   const data=validateLibraryPage(await this.api.library(favorites,query,offset));if(!current())return;
   assertStorage();this.set(key,{data,enabled:true,fresh:true,loading:false});
   if(!query&&!offset)await writeJson(this.cacheKey(favorites),{owner:this.owner,schema:1,data});
  }catch(error){if(current())this.set(key,{loading:false,fresh:false,error:isApiError(error)?error:new ApiError('server')});}
 }
 async favorite(entry:LibraryEntry,wanted:boolean){
  if(this.closed)throw new ApiError('unauthorized');if(!this.api.setFavorite)throw new ApiError('unavailable');
  const assertStorage=captureAccountStorage(this.owner),assertSession=this.api.captureSession?.();assertStorage();assertSession?.();
  await this.api.setFavorite(entry.kind,entry.id,wanted);assertStorage();assertSession?.();if(this.closed)throw new ApiError('unauthorized');
  this.invalidate();
  for(const [key,state] of this.states){if(!state.data)continue;const [favorites]=JSON.parse(key);
   this.set(key,{data:{...state.data,items:state.data.items.flatMap(item=>item.id===entry.id&&item.kind===entry.kind?(favorites&&!wanted?[]:[{...item,favorite:wanted}]):[item])}});
  }
  // Confirmed cache membership is refreshed on next load; stale disk copies cannot pretend current.
  await Promise.all([remove(this.cacheKey(false)),remove(this.cacheKey(true))]);
 }
}
