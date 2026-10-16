import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {AppState} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {useAuth} from '@/auth/AuthProvider';
import {useI18n} from '@/i18n/I18nProvider';
import {accountKey,readJson,writeJson,captureAccountStorage} from '@/storage/kv';
import {widgetPort} from '@/native/widgets/native';
import {WidgetLifecycle} from '@/native/widgets/lifecycle';
import {startWidgetSession,stopWidgetSession,releaseWidgetSession} from '@/native/widgets/session';
type State={available:boolean;enabled:boolean;error:boolean;setEnabled:(value:boolean)=>Promise<void>;refresh:()=>Promise<void>};
type Scope={closed:boolean;service:WidgetLifecycle|null};
const Context=createContext<State>({available:false,enabled:false,error:false,setEnabled:async()=>{},refresh:async()=>{}});
export const useWidgets=()=>useContext(Context);
export function WidgetProvider({children}:{children:ReactNode}){const {user}=useAuth(),{language}=useI18n();return <AccountWidgets key={(user?.id??'signed-out')+':'+language}>{children}</AccountWidgets>;}
function AccountWidgets({children}:{children:ReactNode}){
 const {user,journal,pendingRecoveryCode}=useAuth(),{language}=useI18n();const owner=user?.id;
 const [enabled,setEnabledState]=useState(false),[error,setError]=useState(false);
 const scope=useRef<Scope|null>(null);const available=widgetPort.available();
 const start=(active:Scope)=>{if(!journal||active.closed)return;const next=startWidgetSession(()=>new WidgetLifecycle(journal,widgetPort,randomUUID(),language,Date.now,()=>{if(!active.closed)setError(true);}));active.service=next;void next.start().catch(()=>{if(!active.closed)setError(true);});};
 useEffect(()=>{
  const active:Scope={closed:false,service:null};scope.current=active;
  const restore=async()=>{
   try{
    stopWidgetSession();if(!owner||!journal||pendingRecoveryCode||!available)return;
    const check=captureAccountStorage(owner),value=await readJson(accountKey(owner,'widget-enabled'),true);check();if(active.closed)return;
    if(value===true){const next=startWidgetSession(()=>new WidgetLifecycle(journal,widgetPort,randomUUID(),language,Date.now,()=>{if(!active.closed)setError(true);}));active.service=next;setEnabledState(true);await next.start();}
   }catch{if(!active.closed)setError(true);}
  };
  void restore();
  const listener=AppState.addEventListener('change',state=>{if(state==='active'&&!active.closed)void active.service?.refresh().catch(()=>{if(!active.closed)setError(true);});});
  return()=>{active.closed=true;listener.remove();try{if(active.service)releaseWidgetSession(active.service);}catch{/* Auth cleanup separately exposes failure and blocks account restoration. */}};
 },[owner,journal,pendingRecoveryCode,available,language]);
 const setEnabled=async(value:boolean)=>{
  const active=scope.current;if(!active||active.closed||!owner||!journal||!available||pendingRecoveryCode)return;
  const check=captureAccountStorage(owner);setError(false);
  try{
   if(!value){stopWidgetSession();active.service=null;setEnabledState(false);}
   await writeJson(accountKey(owner,'widget-enabled'),value,true);check();if(active.closed)return;
   if(value){start(active);setEnabledState(true);}
  }catch{if(!active.closed)setError(true);}
 };
 const refresh=async()=>{setError(false);try{await scope.current?.service?.refresh();}catch{setError(true);}};
 return <Context.Provider value={{available,enabled,error,setEnabled,refresh}}>{children}</Context.Provider>;
}
