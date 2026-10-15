import {useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {useAdvice} from '@/data/useAdvice';
import {useDraft} from '@/data/DraftProvider';
import {useAuth} from '@/auth/AuthProvider';
import {recommendationDraft,type Feature,type RecommendationChoice} from '@/domain/advice';
import {addDays,isIsoDay,todayIso} from '@/domain/dates';
import {periodDates} from '@/domain/trends';
import {useI18n} from '@/i18n/I18nProvider';
import {adviceText} from '@/i18n/advice';
import {errorMessageKey} from '@/api/messages';
import {AdvicePanel} from './AdvicePanel';
import {Screen} from './Screen';
import {Header} from './Header';
import {AppText} from './AppText';
import {Button} from './Button';
import {Notice} from './Notice';
export function AdviceScreen({feature}:{feature:Feature}){
 const {day}=useLocalSearchParams<{day?:string}>(),{language,t}=useI18n(),a=(k:string)=>adviceText(language,k);
 const [anchor,setAnchor]=useState(isIsoDay(day)?day:todayIso()),[error,setError]=useState<unknown>(null),[selecting,setSelecting]=useState(false);
 const date=feature==='insight'?periodDates(anchor,'week').from:anchor,state=useAdvice(feature,date),{start,newKey}=useDraft(),{api}=useAuth();
 const select=async(choice:RecommendationChoice)=>{if(!state.fresh||state.loading||selecting)return;setSelecting(true);setError(null);const assertSession=api.captureSession();try{assertSession();await start(recommendationDraft(choice,newKey()));assertSession();router.push('/add/review');}catch(e){setError(e);}finally{setSelecting(false);}};
 return <Screen header={<Header title={a(feature)} leading="back"/>}>
  <AppText ltr>{date}{feature==='insight'?` – ${addDays(date,6)}`:''}</AppText>
  {feature==='insight'?<><Button kind="secondary" label={a('previous')} onPress={()=>setAnchor(addDays(date,-7))}/><Button kind="secondary" label={a('next')} onPress={()=>setAnchor(addDays(date,7))}/></>:<Button kind="secondary" label={a('preferences')} onPress={()=>router.push('/food-restrictions')}/>}
  {state.enabled===false?<Notice message={a('unavailable')}/>:null}
  {state.error||error?<Notice tone="error" message={t(errorMessageKey(state.error??error))}/>:null}
  {!state.fresh&&state.data?<Notice tone="warning" message={a('stale')}/>:null}
  <Button kind="ghost" label={a('retry')} disabled={state.loading} onPress={()=>{void state.refresh();}}/>
  {state.data?<AdvicePanel data={state.data} selectable={state.fresh&&!state.loading&&!selecting} onSelect={choice=>{void select(choice);}}/>:null}
  {state.wording&&state.data?<><Notice message={a('wordingNotice')}/><Button kind="secondary" label={a('wording')} disabled={!state.fresh||state.loading} onPress={()=>{void state.enhance(newKey());}}/></>:null}
  {state.data&&['unavailable','quota','disabled'].includes(state.data.ai_status)?<Notice message={a('fallback')}/>:null}
 </Screen>;
}
