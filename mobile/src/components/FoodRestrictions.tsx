import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';
import {ALLERGENS,DIETS,type Preferences,type ReviewSource} from '@/domain/advice';
import {useI18n} from '@/i18n/I18nProvider';
import {adviceText} from '@/i18n/advice';
import {errorMessageKey} from '@/api/messages';
import {AppText} from './AppText';
import {Button} from './Button';
import {Notice} from './Notice';
import {Screen} from './Screen';
import {Header} from './Header';
const sourceKey=(source:ReviewSource)=>source.entry.kind+':'+source.entry.id;
const sourceVersions=(sources:ReviewSource[])=>JSON.stringify(sources.map(s=>[sourceKey(s),s.source_revision,s.entry.version,s.preferences_version,s.review.version]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
export function FoodRestrictions(){
 const {journal}=useAuth();return <RestrictionEditor key={journal?.userId??'signed-out'}/>;
}
function RestrictionChoices({keys,values,onToggle,label,disabled}:{keys:readonly string[];values:string[];onToggle:(key:string)=>void;label:(key:string)=>string;disabled:boolean}){
 return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{keys.map(k=><Button compact disabled={disabled} kind={values.includes(k)?'primary':'secondary'} label={`${values.includes(k)?'✓ ':''}${label(k)}`} key={k} onPress={()=>onToggle(k)}/>)}</View>;
}
function RestrictionEditor(){
 const {api,journal}=useAuth(),{language,t}=useI18n(),a=(k:string)=>adviceText(language,k);
 const [prefs,setPrefs]=useState<Preferences|null>(null),[sources,setSources]=useState<ReviewSource[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[enabled,setEnabled]=useState(false),[error,setError]=useState<unknown>(null),[saved,setSaved]=useState(false),[clearing,setClearing]=useState(false);
 const [refreshConflict,setRefreshConflict]=useState(false),[hasEdits,setHasEdits]=useState(false);
 const baseline=useRef<{prefs:Preferences;sources:ReviewSource[]}|null>(null);
 const dirty=useRef({preferences:false,reviews:new Set<string>()});
 const alive=useRef(true),serial=useRef(0),busyRef=useRef(false),refreshAfterWrite=useRef(false),focused=useRef(false);
 useEffect(()=>{alive.current=true;const requests=serial;return()=>{alive.current=false;requests.current++;};},[]);
 const reload=useCallback(async(discard=false)=>{
  if(busyRef.current){refreshAfterWrite.current=true;return;}const request=++serial.current,assertSession=api.captureSession();setBusy(true);setError(null);
  try{const caps=await api.capabilities();assertSession();if(!alive.current||request!==serial.current)return;
   setEnabled(!!caps.recommendations&&!!caps.recommendation_writes);if(!caps.recommendations)return;
   const [p,s]=await Promise.all([api.recommendationPreferences(),api.recommendationSources()]);assertSession();if(alive.current&&request===serial.current){
    if(!discard&&(dirty.current.preferences||dirty.current.reviews.size)){
     if(!baseline.current||baseline.current.prefs.version!==p.version||sourceVersions(baseline.current.sources)!==sourceVersions(s)){
      setRefreshConflict(true);setEnabled(false);
     }
     return; // Keep unsaved preferences, ingredient reviews and selection intact.
    }
    baseline.current={prefs:p,sources:s};dirty.current={preferences:false,reviews:new Set()};setHasEdits(false);
    setPrefs(p);setSources(s);setSelected(null);setSaved(false);setClearing(false);setRefreshConflict(false);
   }
  }catch(e){if(alive.current&&request===serial.current){setError(e);setEnabled(false);}}
  finally{if(alive.current&&request===serial.current)setBusy(false);}
 },[api]);
 useFocusEffect(useCallback(()=>{
  focused.current=true;void reload();let previous=AppState.currentState;
  const subscription=AppState.addEventListener('change',next=>{
   if(previous!=='active'&&next==='active')void reload();previous=next;
  });
  return()=>{focused.current=false;refreshAfterWrite.current=false;serial.current++;subscription.remove();};
 },[reload]));
 const mutate=async(work:()=>Promise<void>)=>{if(busyRef.current||busy||!enabled)return;busyRef.current=true;setBusy(true);setError(null);setSaved(false);try{await work();if(alive.current){journal?.advice.invalidate();setSaved(true);}}catch(e){if(alive.current){setError(e);setEnabled(false);}}finally{busyRef.current=false;if(alive.current){setBusy(false);if(refreshAfterWrite.current&&focused.current){refreshAfterWrite.current=false;void reload();}}}};
 const save=()=>mutate(async()=>{if(!prefs)return;const assertSession=api.captureSession();assertSession();const value=await api.saveRecommendationPreferences(prefs);assertSession();if(alive.current){
   dirty.current.preferences=false;setHasEdits(dirty.current.reviews.size>0);
   if(baseline.current)baseline.current={prefs:value,sources:baseline.current.sources.map(x=>({...x,preferences_version:value.version}))};
   setPrefs(value);setSources(s=>s.map(x=>({...x,preferences_version:value.version})));
  }});
 const clear=()=>mutate(async()=>{if(!prefs)return;const assertSession=api.captureSession();assertSession();const value=await api.clearRecommendationPreferences(prefs.version);assertSession();if(alive.current){
   const cleared=sources.map(x=>({...x,preferences_version:value.version,review:{version:0,ingredients_reviewed:false,allergens:[],suitable_diets:[]}}));
   dirty.current={preferences:false,reviews:new Set()};setHasEdits(false);baseline.current={prefs:value,sources:cleared};
   setPrefs(value);setSources(cleared);setSelected(null);setClearing(false);setRefreshConflict(false);
  }});
 const source=sources.find(s=>s.entry.kind+':'+s.entry.id===selected);
 const changePreferences=(value:Preferences)=>{dirty.current.preferences=true;setHasEdits(true);setPrefs(value);setSaved(false);};
 const update=(patch:Partial<ReviewSource['review']>)=>{if(!source)return;dirty.current.reviews.add(sourceKey(source));setHasEdits(true);setSaved(false);setSources(s=>s.map(x=>x===source?{...x,review:{...x.review,...patch}}:x));};
 const toggle=(values:string[],key:string)=>values.includes(key)?values.filter(v=>v!==key):[...values,key];
 return <Screen header={<Header title={a('preferences')} leading="back"/>}>
  <Notice message={a('privacy')}/><Button kind="ghost" label={a('retry')} disabled={busy} onPress={()=>{void reload();}}/>
  {hasEdits?<><Notice message={a(refreshConflict?'refreshConflict':'unsaved')}/><Button kind="secondary" label={a('discardReload')} disabled={busy} onPress={()=>{void reload(true);}}/></>:null}
  {!enabled&&!busy?<Notice message={a('unavailable')}/>:null}{error?<Notice tone="error" message={t(errorMessageKey(error))}/>:null}{saved?<Notice message={a('saved')}/>:null}
  {prefs?<>
   <AppText variant="heading">{a('status')}</AppText>
   {(['unknown','none','declared'] as const).map(status=><Button key={status} disabled={busy||!enabled} kind={prefs.allergy_status===status?'primary':'secondary'} label={a(status+'Status')} onPress={()=>changePreferences({...prefs,allergy_status:status,allergens:status==='declared'?prefs.allergens:[]})}/>)}
   {prefs.allergy_status==='declared'?<><AppText>{a('allergens')}</AppText><RestrictionChoices keys={ALLERGENS} values={prefs.allergens} onToggle={k=>changePreferences({...prefs,allergens:toggle(prefs.allergens,k)})} label={a} disabled={busy||!enabled}/>{!prefs.allergens.length?<Notice message={a('chooseAllergy')}/>:null}</>:null}
   <AppText variant="heading">{a('diets')}</AppText><RestrictionChoices keys={DIETS} values={prefs.diets} onToggle={k=>changePreferences({...prefs,diets:toggle(prefs.diets,k)})} label={a} disabled={busy||!enabled}/>
   <Button label={a('save')} disabled={busy||!enabled||prefs.allergy_status==='declared'&&!prefs.allergens.length} onPress={()=>{void save();}}/>
   <Button kind="secondary" label={a('clear')} disabled={busy||!enabled} onPress={()=>setClearing(true)}/>
   {clearing?<><Button label={a('confirmClear')} disabled={busy||!enabled} onPress={()=>{void clear();}}/><Button kind="ghost" label={a('cancel')} disabled={busy} onPress={()=>setClearing(false)}/></>:null}
   <AppText variant="heading">{a('ingredients')}</AppText><Notice message={a('pool')}/>
   {!sources.length?<AppText>{a('empty')}</AppText>:null}
   {sources.map(s=><Button key={s.entry.kind+':'+s.entry.id} kind="secondary" label={`${s.entry.name} (v${s.entry.version})`} disabled={busy} onPress={()=>setSelected(s.entry.kind+':'+s.entry.id)}/>)}
   {source?<View style={{gap:12}}>
    <AppText variant="heading">{source.entry.name}</AppText>
    {source.entry.draft.items.map(item=><AppText key={item.id}>{item.display_name} · {item.source.provider} / {item.source.reference_id??'—'} / {item.source.version??'—'}</AppText>)}
    <Button disabled={busy||!enabled} kind={source.review.ingredients_reviewed?'primary':'secondary'} label={a(source.review.ingredients_reviewed?'reviewed':'notReviewed')} onPress={()=>update({ingredients_reviewed:!source.review.ingredients_reviewed})}/>
    <AppText>{a('contains')}</AppText><RestrictionChoices keys={ALLERGENS} values={source.review.allergens} onToggle={k=>update({allergens:toggle(source.review.allergens,k)})} label={a} disabled={busy||!enabled}/>
    <AppText>{a('suitable')}</AppText><RestrictionChoices keys={DIETS} values={source.review.suitable_diets} onToggle={k=>update({suitable_diets:toggle(source.review.suitable_diets,k)})} label={a} disabled={busy||!enabled}/>
    <Button label={a('saveReview')} disabled={busy||!enabled} onPress={()=>{void mutate(async()=>{const assertSession=api.captureSession();assertSession();const review=await api.saveRecommendationReview(source);assertSession();if(alive.current){
     dirty.current.reviews.delete(sourceKey(source));setHasEdits(dirty.current.preferences||dirty.current.reviews.size>0);
     if(baseline.current)baseline.current={...baseline.current,sources:baseline.current.sources.map(x=>sourceKey(x)===sourceKey(source)?{...x,review}:x)};
     setSources(s=>s.map(x=>x===source?{...x,review}:x));
    }});}}/>
   </View>:null}
  </>:null}
 </Screen>;
}
