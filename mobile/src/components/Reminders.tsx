import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';
import {useI18n} from '@/i18n/I18nProvider';
import {formatNumber} from '@/i18n/format';
import {habitsText} from '@/i18n/habits';
import {REMINDERS,validateHabitPreferences,type HabitPreferences,type Habits} from '@/domain/habits';
import {notificationsEnabled,syncNotifications} from '@/native/notifications';
import {Screen} from './Screen';import {Header} from './Header';import {AppText} from './AppText';import {TextField} from './TextField';import {Button} from './Button';import {Notice} from './Notice';
export function Reminders(){const {user}=useAuth();return <Editor key={user?.id??'none'}/>;}
function Editor(){
 const {api,journal}=useAuth(),{language}=useI18n();const t=(k:Parameters<typeof habitsText>[1])=>habitsText(language,k);
 const [prefs,setPrefs]=useState<HabitPreferences|null>(null),[streak,setStreak]=useState<Habits['streak']|null>(null),[busy,setBusy]=useState(false),[enabled,setEnabled]=useState(false),[status,setStatus]=useState<Parameters<typeof habitsText>[1]|null>(null);
 const [isDirty,setDirty]=useState(false);
 const alive=useRef(true),serial=useRef(0),writing=useRef(false),dirty=useRef(false);
 const zone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const reload=useCallback(async(force=false)=>{
  if(writing.current)return;const id=++serial.current,assert=api.captureSession();setBusy(true);
  try{const caps=await api.capabilities();assert();if(!alive.current||id!==serial.current)return;setEnabled(!!caps.habits);
   if(!caps.habits){setPrefs(null);setStreak(null);setStatus('unavailable');return;}
   const data=await api.habits(zone());assert();if(alive.current&&id===serial.current){setStreak(data.streak);if(force||!dirty.current){setPrefs(data.preferences);dirty.current=false;setDirty(false);setStatus(null);}}
  }catch{if(alive.current&&id===serial.current){setEnabled(false);setStatus('unavailable');setStreak(null);}}
  finally{if(alive.current&&id===serial.current)setBusy(false);}
 },[api]);
 useFocusEffect(useCallback(()=>{void reload();},[reload]));
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void reload();});const off=journal?.subscribeChanges(()=>{void reload();});const timer=setInterval(()=>{void reload();},60000);return()=>{sub.remove();off?.();clearInterval(timer);};},[reload,journal]);
 const change=(patch:Partial<HabitPreferences>)=>{dirty.current=true;setDirty(true);setPrefs(p=>p?{...p,...patch}:p);};
 let valid=false;try{validateHabitPreferences(prefs);valid=true;}catch{/* disable malformed writes */}
 const save=async()=>{
  if(!prefs||!valid||busy||writing.current||!enabled)return;writing.current=true;setBusy(true);serial.current++;const assert=api.captureSession();
  try{assert();const saved=await api.saveHabitPreferences({...prefs,language});assert();if(alive.current){setPrefs(saved);dirty.current=false;setDirty(false);setStatus('saved');}await syncNotifications();}
  catch{if(alive.current){setEnabled(false);setStatus('error');}}
  finally{writing.current=false;if(alive.current)setBusy(false);}
 };
 return <Screen header={<Header title={t('title')} leading="back"/>}>
  <Notice message={t('policy')}/><Notice message={t('lease')}/>
  {!notificationsEnabled?<Notice message={t('disabled')}/>:null}
  <Button label={t('refresh')} disabled={busy} onPress={()=>{void reload(true);}}/>
  {streak?(['current','longest'] as const).map(k=><AppText key={k}>{t(k)+': '+formatNumber(language,streak[k])}</AppText>):null}
  {streak?<AppText>{t('days')+': '+formatNumber(language,streak.logged_days)}</AppText>:null}
  {status?<Notice message={t(status)}/>:null}
  {prefs?<>
   <Notice message={t('times')}/>
   <AppText>{t('zone')+': '+prefs.timezone_id}</AppText>
   <Button disabled={busy||!enabled} label={t('travel')} onPress={()=>change({timezone_id:zone()})}/>
   <Button disabled={busy||!enabled} label={t(prefs.muted?'muted':'unmuted')} onPress={()=>change({muted:!prefs.muted})}/>
   {[...REMINDERS,'quiet_start','quiet_end'] .map(k=>{const key=k as typeof REMINDERS[number]|'quiet_start'|'quiet_end';return <TextField key={key} label={t(key)} value={prefs[key]??''} placeholder="HH:MM" ltr editable={!busy&&enabled} maxLength={5} onChangeText={v=>change({[key]:v||null})}/>;})}
   <Button disabled={busy||!enabled||!valid} label={t('save')} onPress={()=>{void save();}}/>
   <Button disabled={busy||!enabled||!notificationsEnabled||isDirty} label={t('permission')} onPress={()=>{void syncNotifications(true).then(s=>{if(alive.current)setStatus(s);});}}/>
  </>:null}
 </Screen>;
}
