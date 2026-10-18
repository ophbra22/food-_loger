import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';
import {useDraft} from '@/data/DraftProvider';
import {loadMealForEdit,mealEditDraft} from '@/domain/meal-edit';
import {resumeDraftPath} from '@/domain/drafts';
import {isIsoDay,todayIso} from '@/domain/dates';
import {Screen} from '@/components/Screen';
import {Notice} from '@/components/Notice';
import {Button} from '@/components/Button';
import {Header} from '@/components/Header';
import {useI18n} from '@/i18n/I18nProvider';

export default function MealEdit(){
 const {id,day,kind}=useLocalSearchParams<{id:string;day?:string;kind?:string}>();
 const {api,user}=useAuth(),{draft,start,newKey}=useDraft(),{t}=useI18n();
 const [failure,setFailure]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!user||draft!==null)return;
  let live=true;const guard=api.captureSession();
  void (async()=>{
   try{
    const caps=await api.capabilities();guard();
    if(!caps.canonical_writes||!caps.partial_core_writes||!caps.tiny_portion_writes)throw new Error('unavailable');
    const group=await loadMealForEdit(api,id,isIsoDay(day)?day:todayIso(),kind==='group'?'group':'component');guard();
    if(!live)return;
    void start(mealEditDraft(group,newKey())).catch(()=>{if(live)setFailure(true);});
    router.replace('/add/review');
   }catch{if(live)setFailure(true);}
  })();
  return()=>{live=false;};
 },[api,user,draft,id,day,kind,start,newKey,retry]);
 return <Screen header={<Header title={t('mealEdit.title')}/>}>
  <Notice message={t(draft?'mealEdit.existing':failure?'mealEdit.unavailable':'common.loading')}/>
  {draft?<Button label={t('mealEdit.resume')} onPress={()=>router.replace(resumeDraftPath(draft))}/>:failure?<Button label={t('common.retry')} onPress={()=>{setFailure(false);setRetry(n=>n+1);}}/>:null}
 </Screen>;
}
