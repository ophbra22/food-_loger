/** Account JSON storage. Tokens belong in SecureStore, never here. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '@/api/errors';
const ROOT='fl:v1';
const clearing=new Set<string>();
const epochs=new Map<string,number>();
const pendingWrites=new Map<string,Promise<void>>();
const clearTasks=new Map<string,Promise<void>>();
export const globalKey=(name:string)=>`${ROOT}:app:${name}`;
export const accountPrefix=(userId:string)=>`${ROOT}:u:${userId}:`;
export const accountKey=(userId:string,name:string)=>accountPrefix(userId)+name;
export function openAccountStorage(userId:string) {
  const prefix=accountPrefix(userId);
  epochs.set(prefix,(epochs.get(prefix)??0)+1);clearing.delete(prefix);
}
const ownerPrefix=(key:string)=>key.startsWith(`${ROOT}:u:`)?key.slice(0,key.indexOf(':',ROOT.length+3)+1):null;
export async function readJson<T>(key:string,strict=false):Promise<T|null> {
  try {
    const raw=await AsyncStorage.getItem(key);
    return raw===null?null:JSON.parse(raw) as T;
  } catch(error) { if(strict) throw new ApiError(error instanceof SyntaxError?'draftFormat':'storage'); return null; }
}
export async function writeJson(key:string,value:unknown,strict=false):Promise<void> {
  const prefix=ownerPrefix(key),epoch=prefix?epochs.get(prefix):undefined;
  const blocked=()=>prefix && (clearing.has(prefix) || epochs.get(prefix)!==epoch);
  try {
    if(blocked()) throw new ApiError('unauthorized');
    const previous=pendingWrites.get(key)??Promise.resolve();
    const clearingTask=prefix?clearTasks.get(prefix):undefined;
    const writing=previous.catch(()=>undefined).then(async()=>{
      if(clearingTask) await clearingTask;
      if(blocked()) throw new ApiError('unauthorized');
      await AsyncStorage.setItem(key,JSON.stringify(value));
    });
    pendingWrites.set(key,writing);
    try { await writing; } finally { if(pendingWrites.get(key)===writing) pendingWrites.delete(key); }
  } catch(error) {
    if(strict) throw error instanceof ApiError?error:new ApiError('storage');
  }
}
export async function remove(key:string,strict=false):Promise<void> {
  const previous=pendingWrites.get(key)??Promise.resolve();
  const removing=previous.catch(()=>undefined).then(()=>AsyncStorage.removeItem(key));
  pendingWrites.set(key,removing);
  try { await removing; } catch { if(strict) throw new ApiError('storage'); }
  finally { if(pendingWrites.get(key)===removing) pendingWrites.delete(key); }
}
export async function clearAccount(userId:string):Promise<void> {
  const prefix=accountPrefix(userId);
  epochs.set(prefix,(epochs.get(prefix)??0)+1);clearing.add(prefix);
  const pending=[...pendingWrites].filter(([key])=>key.startsWith(prefix)).map(([,task])=>task);
  const prior=clearTasks.get(prefix);
  const task=(async()=>{
    if(prior) await prior;
    await Promise.allSettled(pending);
    const keys=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith(prefix));
    if(keys.length) await AsyncStorage.multiRemove(keys);
  })();
  clearTasks.set(prefix,task);
  try { await task; } finally { if(clearTasks.get(prefix)===task) clearTasks.delete(prefix); }
}
