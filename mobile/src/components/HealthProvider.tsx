import {createContext,useContext,useEffect,useMemo,type ReactNode} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {useAuth} from '@/auth/AuthProvider';
import {accountKey,readJson,writeJson,captureAccountStorage} from '@/storage/kv';
import {HealthSync} from '@/native/health/sync';
import {healthPort,healthEnabled} from '@/native/health/ios';
import {setHealthSession} from '@/native/health/session';
const Context=createContext<HealthSync|null>(null);
export const useHealth=()=>useContext(Context);
export function HealthProvider({children}:{children:ReactNode}){
 const {user,api,journal}=useAuth();
 const service=useMemo(()=>{
  if(!user)return null;const check=captureAccountStorage(user.id),key=accountKey(user.id,'health-sync');
  return new HealthSync(api,healthPort,{read:async()=>{check();const data=await readJson(key,true);check();return data;},write:async data=>{check();await writeJson(key,data,true);check();}},randomUUID,dates=>journal?.tracking.externalChanged('weight',dates));
 },[user,api,journal]);
 useEffect(()=>{
  if(!service||!healthEnabled)return;
  setHealthSession(service);let timer:ReturnType<typeof setTimeout>|null=null;
  const run=()=>{if(AppState.currentState==='active'){service.resume();void service.sync().catch(()=>{});}};
  const changed=()=>{if(timer)clearTimeout(timer);timer=setTimeout(run,250);};
  const state=AppState.addEventListener('change',s=>{if(s==='active')run();else if(s==='background')service.pause();});
  const logs=journal?.subscribeChanges(changed),tracking=journal?.tracking.subscribe(changed);
  run();return()=>{if(timer)clearTimeout(timer);state.remove();logs?.();tracking?.();setHealthSession(null);};
 },[service,journal]);
 return <Context.Provider value={service}>{children}</Context.Provider>;
}
