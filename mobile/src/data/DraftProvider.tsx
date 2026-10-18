import {randomUUID} from 'expo-crypto';
import {ReactNode,createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {Meal} from '@/api/types';
import {ApiError,isApiError} from '@/api/errors';
import {useAuth} from '@/auth/AuthProvider';
import {Draft,editDraft} from '@/domain/drafts';
import {draftStore} from '@/storage/account-data';
import {saveDraft} from './save-draft';

type DraftValue={
  draft:Draft|null|undefined; saving:boolean; persistenceError:ApiError|null;
  newKey:()=>string; start:(draft:Draft)=>Promise<void>;
  update:(changes:Parameters<typeof editDraft>[1])=>void; discard:()=>Promise<void>;
  save:()=>Promise<Meal|Meal[]>;
};
type Owned={userId:string;draft:Draft|null};
const DraftContext=createContext<DraftValue|null>(null);
export function DraftProvider({children}:{children:ReactNode}) {
  const {user,api,journal}=useAuth();const userId=user?.id??null;
  const [owned,setOwned]=useState<Owned|null>(null);
  const [saving,setSaving]=useState(false);
  const [failure,setFailure]=useState<{userId:string;error:ApiError}|null>(null);
  const latest=useRef<Owned|null>(null),busy=useRef(false),activeOwner=useRef(userId);
  useEffect(()=>{activeOwner.current=userId;},[userId]);
  const put=useCallback((next:Owned|null)=>{latest.current=next;setOwned(next);},[]);
  const report=useCallback((owner:string,error:unknown)=>{
    if(activeOwner.current===owner) setFailure({userId:owner,error:isApiError(error)?error:new ApiError('storage')});
  },[]);
  useEffect(()=>{
    let cancelled=false;
    const initial=latest.current;
    if(!userId){latest.current=null;return;}
    draftStore.read(userId).then(stored=>{
      if(!cancelled && latest.current===initial){put({userId,draft:stored});setFailure(null);}
    }).catch(error=>{
      if(!cancelled && latest.current===initial){put({userId,draft:null});report(userId,error);}
    });
    return ()=>{cancelled=true;};
  },[userId,put,report]);
  const current=useCallback(()=>userId && latest.current?.userId===userId?latest.current.draft:undefined,[userId]);
  const persist=useCallback(async(owner:string,draft:Draft)=>{
    try {await draftStore.write(owner,draft);if(activeOwner.current===owner)setFailure(null);}
    catch(error){report(owner,error);throw error;}
  },[report]);
  const start=useCallback(async(next:Draft)=>{
    if(!userId)return;
    if(current()?.edit&&current()?.attempted&&!current()?.edit?.rejected)throw new ApiError('conflict');
    put({userId,draft:next});
    // Keep editing possible; the visible warning persists and save retries critical persistence.
    await persist(userId,next).catch(()=>undefined);
  },[userId,current,put,persist]);
  const update=useCallback((changes:Parameters<typeof editDraft>[1])=>{
    const draft=current();if(!userId || !draft || busy.current)return;
    const next=editDraft(draft,changes,randomUUID);put({userId,draft:next});
    void persist(userId,next).catch(()=>undefined);
  },[userId,current,put,persist]);
  const discard=useCallback(async()=>{
    if(!userId || busy.current)return;
    if(current()?.edit&&current()?.attempted&&!current()?.edit?.rejected)throw new ApiError('conflict');
    try {
      await draftStore.clear(userId);
      if(activeOwner.current===userId){put({userId,draft:null});setFailure(null);}
    } catch(error){report(userId,error);}
  },[userId,current,put,report]);
  const save=useCallback(async()=>{
    const draft=current();if(!userId || !draft)throw new Error('No draft to save.');
    if(busy.current)throw new Error('Already saving.');
    busy.current=true;setSaving(true);
    try {
      const assertSession=api.captureSession();
      const meal=await saveDraft(api,draft,async attempted=>{
        put({userId,draft:attempted});await persist(userId,attempted);
      });
      assertSession();
      if(draft.edit)journal?.replaceConfirmedGroup(draft.edit,Array.isArray(meal)?meal:[meal]);
      else (Array.isArray(meal)?meal:[meal]).forEach(item=>journal?.addConfirmed(item));
      try {await draftStore.clear(userId);} catch {
        const error=new ApiError('draftCleanup');report(userId,error);throw error;
      }
      assertSession();put({userId,draft:null});setFailure(null);
      return meal;
    } catch(error) {
      if(draft.edit&&isApiError(error)&&['conflict','notFound','validation'].includes(error.kind)&&activeOwner.current===userId){
        const rejected={...draft,attempted:true,edit:{...draft.edit,rejected:true}};
        put({userId,draft:rejected});await persist(userId,rejected);
      }
      throw error;
    } finally {busy.current=false;setSaving(false);}
  },[userId,current,api,journal,put,persist,report]);
  const draft=userId && owned?.userId===userId?owned.draft:undefined;
  const persistenceError=userId && failure?.userId===userId?failure.error:null;
  const value=useMemo<DraftValue>(()=>({draft,saving,persistenceError,newKey:randomUUID,start,update,discard,save}),
    [draft,saving,persistenceError,start,update,discard,save]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
export function useDraft():DraftValue {
  const value=useContext(DraftContext);if(!value)throw new Error('useDraft must be used inside DraftProvider');return value;
}
