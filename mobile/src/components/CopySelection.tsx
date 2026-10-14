import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import type {Api} from '@/api/endpoints';
import {ApiError} from '@/api/errors';
import {errorMessageKey} from '@/api/messages';
import {type CopySelection as Selection,copyDraft,validCopySelection,type CopyPreview} from '@/domain/copying';
import type {Draft} from '@/domain/drafts';
import {useI18n} from '@/i18n/I18nProvider';
import {AppText} from './AppText';
import {Button} from './Button';
import {DayNav} from './DayNav';
import {TextField} from './TextField';
import {Segmented} from './Segmented';
import {Notice} from './Notice';
type Source=Awaited<ReturnType<Api['copySources']>>[number];
function wall(source:Source){try{return source.draft.occurred_at&&source.draft.timezone_id?new Intl.DateTimeFormat('en-GB',{timeZone:source.draft.timezone_id,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(source.draft.occurred_at)):'';}catch{return '';}}
export function CopySelection({api,sourceDay,destinationDay,mealId,newKey,onReview}:{api:Pick<Api,'copySources'|'copyPreview'|'captureSession'>;sourceDay:string;destinationDay:string;mealId?:string;newKey:()=>string;onReview:(draft:Draft)=>Promise<void>}){
 const {t}=useI18n();const [source,setSource]=useState(sourceDay),[destination,setDestination]=useState(destinationDay),[zone,setZone]=useState(()=>Intl.DateTimeFormat().resolvedOptions().timeZone),[items,setItems]=useState<Source[]>([]),[selected,setSelected]=useState<string[]>([]),[times,setTimes]=useState<Selection['times']>({}),[issues,setIssues]=useState<CopyPreview['time_issues']>([]),[error,setError]=useState<unknown>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const guard=useRef(false);useEffect(()=>{let active=true;const assertSession=api.captureSession();
  api.copySources(source).then(result=>{assertSession();if(active){setItems(result);setSelected(result.filter(s=>!mealId||s.entry_ids.includes(mealId)).map(s=>s.id));setLoading(false);}}).catch(e=>{if(active){setError(e);setLoading(false);}});return()=>{active=false;};
 },[api,source,mealId,attempt]);
 const selection:Selection={source_day:source,destination_date:destination,timezone_id:zone,sources:items.filter(i=>selected.includes(i.id)).map(i=>({id:i.id,version:i.version})),times:Object.fromEntries(Object.entries(times).filter(([id])=>selected.includes(id)))};
 const review=async()=>{if(guard.current||loading||!validCopySelection(selection))return;guard.current=true;setBusy(true);setError(null);const assertSession=api.captureSession();
  try{const result=await api.copyPreview(selection);assertSession();setIssues(result.time_issues);if(!result.time_issues.length)await onReview(copyDraft(selection,result,newKey()));}
  catch(e){setError(e);}finally{guard.current=false;setBusy(false);}
 };
 const reset=()=>{setLoading(true);setItems([]);setSelected([]);setTimes({});setIssues([]);setError(null);};
 return <>
  <AppText variant="label">{t('copy.source')}</AppText><DayNav day={source} onChange={day=>{if(!busy){reset();setSource(day);}}}/>
  <AppText variant="label">{t('copy.destination')}</AppText><DayNav day={destination} onChange={day=>{if(!busy){setDestination(day);setIssues([]);}}}/>
  <TextField label={t('unified.zone')} value={zone} ltr editable={!busy} maxLength={80} onChangeText={setZone}/>
  <Notice message={t('copy.timeHint')}/>
  {loading?<Notice message={t('common.loading')}/>:null}
  {error?<Notice tone="error" message={t(error instanceof ApiError&&error.kind==='conflict'?'copy.changed':errorMessageKey(error))}/>:null}
  <Button label={t('common.retry')} kind="ghost" disabled={busy||loading} onPress={()=>{reset();setAttempt(x=>x+1);}}/>
  {!loading&&items.length===0?<Notice message={t('copy.empty')}/>:null}
  {selected.length>20?<Notice tone="warning" message={t('copy.limit')}/>:null}
  <Button label={t('copy.entireDay')} kind="secondary" disabled={busy||loading||!items.length} onPress={()=>setSelected(items.map(i=>i.id))}/>
  <Button label={t('copy.clearSelection')} kind="ghost" disabled={busy||loading} onPress={()=>setSelected([])}/>
  {items.map(item=><View key={item.id}>
   <Button testID={'copy-select-'+item.id} label={(selected.includes(item.id)?'☑ ':'☐ ')+item.name} kind="secondary" disabled={busy||loading} onPress={()=>setSelected(selected.includes(item.id)?selected.filter(id=>id!==item.id):[...selected,item.id])}/>
   {selected.includes(item.id)?<>
    <TextField testID={'copy-time-'+item.id} label={t('copy.wallTime')} hint={wall(item)||t('copy.unknown_time')} value={times[item.id]?.wall_time??''} editable={!busy} ltr maxLength={8} onChangeText={value=>setTimes(current=>{const next={...current};if(value)next[item.id]={wall_time:value};else delete next[item.id];return next;})}/>
    <Segmented label={t('copy.overlap')} value={String(times[item.id]?.fold??'auto')} disabled={busy} options={[{value:'auto',label:t('copy.unresolved')},{value:'0',label:t('copy.first')},{value:'1',label:t('copy.second')}]} onChange={value=>{setTimes(current=>{const next={...current},valueTime=current[item.id]?.wall_time||wall(item);if(value==='auto'){if(current[item.id])next[item.id]={wall_time:current[item.id].wall_time};}else next[item.id]={wall_time:valueTime,fold:value==='0'?0:1};return next;});}}/>
    {issues.filter(i=>i.id===item.id).map(i=><Notice key={i.reason} tone="warning" message={t(`copy.${i.reason}`)}/>)}</>:null}
  </View>)}
  <Button testID="preview-copy" label={t('copy.preview')} disabled={loading||!validCopySelection(selection)} busy={busy} onPress={review}/>
 </>;
}
