import {useState,useSyncExternalStore} from 'react';
import {useI18n} from '@/i18n/I18nProvider';
import {healthEnabled} from '@/native/health/ios';
import {emptyChoices,type Choices} from '@/native/health/types';
import {useHealth} from './HealthProvider';
import {Screen} from './Screen';import {Header} from './Header';import {Button} from './Button';import {Notice} from './Notice';import {AppText} from './AppText';
export function HealthSettings(){const service=useHealth();return service?<Editor service={service}/>:null;}
function Editor({service}:{service:NonNullable<ReturnType<typeof useHealth>>}){
 const {language}=useI18n(),he=language==='he';
 const state=useSyncExternalStore(service.subscribe,()=>service.state);
 const [selection,setSelection]=useState<{service:typeof service;choices:Choices}|null>(null),[error,setError]=useState(false);
 const choices=selection?.service===service?selection.choices:service.choices?.()??emptyChoices();
 const setChoices=(choices:Choices)=>setSelection({service,choices});
 const action=async(fn:()=>Promise<void>)=>{setError(false);try{await fn();}catch{setError(true);}};
 const labels:Record<keyof Choices,string>={nutrition:he?'כתיבת תזונה':'Write nutrition',water:he?'כתיבת מים':'Write water',weight:he?'ייבוא משקל גוף':'Import body weight',steps:he?'ייבוא דגימות צעדים':'Import step samples'};
 return <Screen header={<Header leading="back" title={he?'בריאות Apple':'Apple Health'}/>}>
  <Notice message={he?'ייבוא משקל וצעדים מעביר את הנתונים שנבחרו ליומן הפרטי בחשבון המחובר. תזונה היא נתון שאישרתם, ולא מדידה מאומתת.':'Importing weight and steps sends the selected data to your signed-in private journal. Nutrition is user-confirmed data, not a verified measurement.'}/>
  <Notice message={he?'תוצאות ריקות אינן מוכיחות הרשאת קריאה. הרשאות חלקיות אינן מונעות רישום רגיל. הסנכרון מתבצע כשהיישום פתוח.':'Empty results do not prove read permission. Partial permissions do not prevent ordinary logging. Sync runs while the app is open.'}/>
  {!healthEnabled?<Notice message={he?'החיבור מושבת בגרסה זו.':'Apple Health is disabled in this build.'}/>:null}
  <AppText>{state.connected?(he?'מחובר':'Connected'):(he?'מנותק':'Disconnected')}</AppText>
  {(Object.keys(labels) as (keyof Choices)[]).map(k=><Button key={k} disabled={!healthEnabled||state.busy} label={labels[k]+': '+(choices[k]?(he?'פעיל':'on'):(he?'כבוי':'off'))} onPress={()=>setChoices({...choices,[k]:!choices[k]})}/>)}
  <Button label={he?'חיבור הנתונים שנבחרו':'Connect selected data'} disabled={!healthEnabled||state.busy||!Object.values(choices).some(Boolean)} onPress={()=>{void action(async()=>{await service.connect(choices);await service.sync();});}}/>
  <Button label={he?'סנכרון וניסיון חוזר':'Sync / retry'} disabled={!healthEnabled||!state.connected||state.busy} onPress={()=>{void action(()=>service.sync());}}/>
  <Button label={he?'ניתוק':'Disconnect'} disabled={!state.connected} onPress={()=>{void action(()=>service.disconnect());}}/>
  {state.busy?<Notice message={he?'מסנכרן…':'Syncing…'}/>:null}
  {error||state.error?<Notice message={he?'הסנכרון לא הושלם. אפשר לנסות שוב; היומן נשמר.':'Sync did not finish. Retry is safe; your journal is retained.'}/>:null}
  <AppText>{(he?'רשומות חסומות לפי הרשאה: ':'Records blocked by permission: ')+state.blocked}</AppText>
  <AppText>{(he?'רשומות ללא זמן מקורי תקין: ':'Records withheld without a valid original timestamp: ')+state.withheld}</AppText>
  <Notice message={he?'הניתוק עוצר סנכרון אך אינו מוחק דגימות שכבר נכתבו. אפשר לנהל הרשאות ונתונים ביישום בריאות. ייבוא מוגבל ל־30 הימים האחרונים; דגימות צעדים אינן סכום יומי מנוכה כפילויות.':'Disconnect stops sync and retains existing Health samples. Manage permissions and data in the Health app. Imports cover the last 30 days; raw step samples are not a deduplicated daily total.'}/>
  {(state.imports??[]).slice(-10).map(s=><AppText key={s.external_id}>{`${s.kind}: ${s.value} ${s.kind==='weight'?'kg':''} · ${s.start} · ${s.source_bundle}`}</AppText>)}
 </Screen>;
}
