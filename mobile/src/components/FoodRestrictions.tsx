import {useCallback,useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
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
export function FoodRestrictions(){
 const {journal}=useAuth();return <RestrictionEditor key={journal?.userId??'signed-out'}/>;
}
function RestrictionEditor(){
 const {api,journal}=useAuth(),{language,t}=useI18n(),a=(k:string)=>adviceText(language,k);
 const [prefs,setPrefs]=useState<Preferences|null>(null),[sources,setSources]=useState<ReviewSource[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [busy,setBusy]=useState(false),[enabled,setEnabled]=useState(false),[error,setError]=useState<unknown>(null),[saved,setSaved]=useState(false),[clearing,setClearing]=useState(false);
 const alive=useRef(true),serial=useRef(0),busyRef=useRef(false);
 useEffect(()=>{alive.current=true;const requests=serial;return()=>{alive.current=false;requests.current++;};},[]);
 const reload=useCallback(async()=>{
  if(busyRef.current)return;const request=++serial.current,assertSession=api.captureSession();setBusy(true);setError(null);
  try{const caps=await api.capabilities();assertSession();if(!alive.current||request!==serial.current)return;
   setEnabled(!!caps.recommendations&&!!caps.recommendation_writes);if(!caps.recommendations){setPrefs(null);setSources([]);return;}
   const [p,s]=await Promise.all([api.recommendationPreferences(),api.recommendationSources()]);assertSession();if(alive.current&&request===serial.current){setPrefs(p);setSources(s);setSelected(null);setSaved(false);setClearing(false);}
  }catch(e){if(alive.current&&request===serial.current){setError(e);setEnabled(false);}}
  finally{if(alive.current&&request===serial.current)setBusy(false);}
 },[api]);
 useFocusEffect(useCallback(()=>{void reload();},[reload]));
 const mutate=async(work:()=>Promise<void>)=>{if(busyRef.current||busy||!enabled)return;busyRef.current=true;setBusy(true);setError(null);setSaved(false);try{await work();if(alive.current){journal?.advice.invalidate();setSaved(true);}}catch(e){if(alive.current){setError(e);setEnabled(false);}}finally{busyRef.current=false;if(alive.current)setBusy(false);}};
 const save=()=>mutate(async()=>{if(!prefs)return;const assertSession=api.captureSession();assertSession();const value=await api.saveRecommendationPreferences(prefs);assertSession();if(alive.current)setPrefs(value);});
 const clear=()=>mutate(async()=>{if(!prefs)return;const assertSession=api.captureSession();assertSession();const value=await api.clearRecommendationPreferences(prefs.version);assertSession();if(alive.current){setPrefs(value);setSources(s=>s.map(x=>({...x,review:{version:0,ingredients_reviewed:false,allergens:[],suitable_diets:[]}})));setSelected(null);setClearing(false);}});
 const source=sources.find(s=>s.entry.kind+':'+s.entry.id===selected);
 const update=(patch:Partial<ReviewSource['review']>)=>setSources(s=>s.map(x=>x===source?{...x,review:{...x.review,...patch}}:x));
 const toggle=(values:string[],key:string)=>values.includes(key)?values.filter(v=>v!==key):[...values,key];
 const choices=(keys:readonly string[],values:string[],onToggle:(k:string)=>void)=><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{keys.map(k=><Button compact disabled={busy||!enabled} kind={values.includes(k)?'primary':'secondary'} label={`${values.includes(k)?'✓ ':''}${a(k)}`} key={k} onPress={()=>onToggle(k)}/>)}</View>;
 return <Screen header={<Header title={a('preferences')} leading="back"/>}>
  <Notice message={a('privacy')}/><Button kind="ghost" label={a('retry')} disabled={busy} onPress={()=>{void reload();}}/>
  {!enabled&&!busy?<Notice message={a('unavailable')}/>:null}{error?<Notice tone="error" message={t(errorMessageKey(error))}/>:null}{saved?<Notice message={a('saved')}/>:null}
  {prefs?<>
   <AppText variant="heading">{a('status')}</AppText>
   {(['unknown','none','declared'] as const).map(status=><Button key={status} disabled={busy||!enabled} kind={prefs.allergy_status===status?'primary':'secondary'} label={a(status+'Status')} onPress={()=>setPrefs({...prefs,allergy_status:status,allergens:status==='declared'?prefs.allergens:[]})}/>)}
   {prefs.allergy_status==='declared'?<><AppText>{a('allergens')}</AppText>{choices(ALLERGENS,prefs.allergens,k=>setPrefs({...prefs,allergens:toggle(prefs.allergens,k)}))}{!prefs.allergens.length?<Notice message={a('chooseAllergy')}/>:null}</>:null}
   <AppText variant="heading">{a('diets')}</AppText>{choices(DIETS,prefs.diets,k=>setPrefs({...prefs,diets:toggle(prefs.diets,k)}))}
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
    <AppText>{a('contains')}</AppText>{choices(ALLERGENS,source.review.allergens,k=>update({allergens:toggle(source.review.allergens,k)}))}
    <AppText>{a('suitable')}</AppText>{choices(DIETS,source.review.suitable_diets,k=>update({suitable_diets:toggle(source.review.suitable_diets,k)}))}
    <Button label={a('saveReview')} disabled={busy||!enabled} onPress={()=>{void mutate(async()=>{const assertSession=api.captureSession();assertSession();const review=await api.saveRecommendationReview(source);assertSession();if(alive.current)setSources(s=>s.map(x=>x===source?{...x,review}:x));});}}/>
   </View>:null}
  </>:null}
 </Screen>;
}
