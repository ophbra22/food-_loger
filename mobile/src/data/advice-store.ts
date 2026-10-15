import type {Api} from '@/api/endpoints';
import {ApiError,isApiError} from '@/api/errors';
import type {Advice,AdviceLanguage,Feature} from '@/domain/advice';
export type AdviceApi=Partial<Pick<Api,'capabilities'|'advice'|'wording'>>;
export type AdviceState={data:Advice|null;enabled:boolean|null;wording:boolean;loading:boolean;fresh:boolean;error:ApiError|null};
export const EMPTY_ADVICE:AdviceState={data:null,enabled:null,wording:false,loading:false,fresh:false,error:null};
/** Bounded memory only, owned and destroyed by the authenticated journal. */
export class AdviceStore {
 private states=new Map<string,AdviceState>();private reads=new Map<string,number>();private listeners=new Set<()=>void>();private serial=0;private closed=false;
 constructor(private api:AdviceApi){}
 private key(f:Feature,d:string,l:AdviceLanguage){return JSON.stringify([f,d,l]);}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 get=(f:Feature,d:string,l:AdviceLanguage)=>this.states.get(this.key(f,d,l))??EMPTY_ADVICE;
 private set(key:string,patch:Partial<AdviceState>){if(this.closed)return;this.states.set(key,{...(this.states.get(key)??EMPTY_ADVICE),...patch});while(this.states.size>12){const oldest=this.states.keys().next().value!;this.states.delete(oldest);this.reads.delete(oldest);}this.listeners.forEach(f=>f());}
 close(){this.closed=true;this.states.clear();this.reads.clear();this.listeners.clear();}
 invalidate(){if(this.closed)return;const keys=[...this.states.keys()];for(const key of keys){this.reads.delete(key);this.set(key,{data:null,fresh:false,loading:false});}if(this.listeners.size)for(const key of keys){const [f,d,l]=JSON.parse(key);void this.load(f,d,l);}}
 async load(f:Feature,d:string,l:AdviceLanguage){
  if(this.closed)return;const key=this.key(f,d,l),request=++this.serial;this.reads.set(key,request);const current=()=>!this.closed&&this.reads.get(key)===request;this.set(key,{loading:true,error:null,fresh:false});
  try{const caps=await this.api.capabilities?.();if(!current())return;
   if(!(f==='insight'?caps?.insights:caps?.recommendations)||!this.api.advice){this.set(key,{enabled:false,data:null,loading:false,fresh:true});return;}
   this.set(key,{enabled:true,wording:!!caps?.wording});const data=await this.api.advice(f,d,l);if(current())this.set(key,{data,fresh:true,loading:false});
  }catch(e){if(current())this.set(key,{loading:false,fresh:false,error:isApiError(e)?e:new ApiError('server')});}
 }
 async enhance(f:Feature,d:string,l:AdviceLanguage,id:string){
  const state=this.get(f,d,l);if(this.closed||!state.data||!state.fresh||state.loading||!this.api.wording)return;
  const key=this.key(f,d,l),request=++this.serial;this.reads.set(key,request);const current=()=>!this.closed&&this.reads.get(key)===request;this.set(key,{loading:true,error:null});
  try{const data=await this.api.wording(f,d,l,state.data.revision,id);if(current())this.set(key,{data,loading:false});}
  catch(e){if(current())this.set(key,{loading:false,fresh:false,error:isApiError(e)?e:new ApiError('server')});}
 }
}
