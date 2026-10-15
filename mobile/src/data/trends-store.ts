import type {Api} from '@/api/endpoints';
import {ApiError,isApiError} from '@/api/errors';
import type {TrendResponse} from '@/domain/trends';
export type TrendsState={data:TrendResponse|null;enabled:boolean|null;loading:boolean;fresh:boolean;error:ApiError|null};
export const EMPTY_TRENDS:TrendsState={data:null,enabled:null,loading:false,fresh:false,error:null};
export class TrendsStore {
 private states=new Map<string,TrendsState>();private listeners=new Set<()=>void>();private reads=new Map<string,number>();private closed=false;
 constructor(private api:Partial<Pick<Api,'trends'|'capabilities'>>){}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 get=(from:string,to:string)=>this.states.get(from+':'+to)??EMPTY_TRENDS;
 private set(key:string,patch:Partial<TrendsState>){if(this.closed)return;this.states.set(key,{...(this.states.get(key)??EMPTY_TRENDS),...patch});this.listeners.forEach(f=>f());}
 close(){this.closed=true;this.states.clear();this.listeners.clear();}
 invalidate(){if(this.closed)return;for(const key of this.states.keys()){this.reads.set(key,(this.reads.get(key)??0)+1);this.set(key,{fresh:false,loading:false});}if(this.listeners.size)for(const key of this.states.keys())void this.load(key.slice(0,10),key.slice(11));}
 async load(from:string,to:string){
  if(this.closed)return;const key=from+':'+to,request=(this.reads.get(key)??0)+1;this.reads.set(key,request);
  const current=()=>!this.closed&&this.reads.get(key)===request;this.set(key,{loading:true,error:null});
  try{const caps=await this.api.capabilities?.();if(!current())return;
   if(!caps?.trends||!this.api.trends){this.set(key,{enabled:false,data:null,loading:false,fresh:true});return;}
   this.set(key,{enabled:true});const data=await this.api.trends(from,to);if(current())this.set(key,{data,loading:false,fresh:true});
  }catch(error){if(current())this.set(key,{loading:false,fresh:false,error:isApiError(error)?error:new ApiError('server')});}
 }
}
