import type { DayResponse } from '@/api/types';
import { ApiError } from '@/api/errors';
import type { Draft } from '@/domain/drafts';
import { accountKey,readJson,remove,writeJson } from './kv';
import { storedDay,storedDraft } from './validation';
export type CachedDay={data:DayResponse;savedAt:number};
export const dayCache={
  async read(userId:string,day:string):Promise<CachedDay|null> {
    const modern=await readJson<{schemaVersion?:number;ownerId?:string;data:unknown;savedAt:number}>(accountKey(userId,`day:v2:${day}`));
    if(modern!==null && (modern.schemaVersion!==2 || modern.ownerId!==userId))return null;
    const value=modern??await readJson<{data:unknown;savedAt:number}>(accountKey(userId,`day:${day}`));
    if(!value || !Number.isFinite(value.savedAt) || !storedDay(value.data,day)) return null;
    return {data:value.data,savedAt:value.savedAt};
  },
  write:(userId:string,data:DayResponse,now=Date.now())=>writeJson(accountKey(userId,`day:v2:${data.day}`),
    {schemaVersion:2,ownerId:userId,data,savedAt:now}),
  remove:async(userId:string,day:string)=>{
    await remove(accountKey(userId,`day:v2:${day}`));await remove(accountKey(userId,`day:${day}`));
  },
};
async function envelope(userId:string) {
  const value=await readJson<{schemaVersion?:number;ownerId?:string;draft?:unknown}>(accountKey(userId,'draft:v2'),true);
  if(value!==null && (value.schemaVersion!==2 || value.ownerId!==userId || !storedDraft(value.draft))) throw new ApiError('draftFormat');
  return value;
}
export const draftStore={
  async read(userId:string):Promise<Draft|null> {
    const value=await envelope(userId);
    if(value) return value.draft as Draft;
    const legacy=await readJson<unknown>(accountKey(userId,'draft'),true);
    if(legacy===null) return null;
    if(!storedDraft(legacy)) throw new ApiError('draftFormat');
    return legacy;
  },
  async write(userId:string,draft:Draft):Promise<void> {
    await draftStore.read(userId); // Never overwrite an unreadable draft implicitly.
    if(!storedDraft(draft)) throw new ApiError('draftFormat');
    await writeJson(accountKey(userId,'draft:v2'),{schemaVersion:2,ownerId:userId,draft},true);
  },
  async clear(userId:string) {
    await remove(accountKey(userId,'draft:v2'),true);
    await remove(accountKey(userId,'draft'),true);
  },
};
