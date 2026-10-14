import {router,useLocalSearchParams} from 'expo-router';
import {useEffect,useRef,useState} from 'react';
import {Alert} from 'react-native';
import {useAuth} from '@/auth/AuthProvider';
import {useDraft} from '@/data/DraftProvider';
import {useI18n} from '@/i18n/I18nProvider';
import {draftFromCanonical,type LibraryEntry} from '@/domain/library';
import {mealTotals} from '@/domain/meal-analysis';
import {errorMessageKey} from '@/api/messages';
import {ApiError} from '@/api/errors';
import {accountKey,captureAccountStorage,readJson,writeJson,remove} from '@/storage/kv';
import {RecipeEditor} from '@/components/RecipeEditor';
import {Screen} from '@/components/Screen';
import {Header} from '@/components/Header';
import {Button} from '@/components/Button';
import {Notice} from '@/components/Notice';
import {AppText} from '@/components/AppText';
import {NutritionGrid} from '@/components/NutritionGrid';
export default function Recipe(){const {id}=useLocalSearchParams<{id:string}>();const {user}=useAuth();return <RecipeDetail key={(user?.id??'')+id} id={id}/>;}
function RecipeDetail({id}:{id:string}){
 const {api,user,journal}=useAuth(),{newKey}=useDraft(),{t}=useI18n();
 const [entry,setEntry]=useState<LibraryEntry|null>(null),[ready,setReady]=useState(false),[writable,setWritable]=useState(false),[error,setError]=useState<unknown>(null),[attempt,setAttempt]=useState(0),[history,setHistory]=useState<LibraryEntry[]>([]),[busy,setBusy]=useState(false);
 const guard=useRef(false),active=useRef(true);
 useEffect(()=>{active.current=true;const assertSession=api.captureSession();
  Promise.all([api.capabilities(),id==='new'?Promise.resolve(null):api.recipe(id)]).then(([caps,result])=>{assertSession();if(active.current){setEntry(result);setWritable(!!caps.recipe_writes);setReady(true);}}).catch(e=>{if(active.current)setError(e);});return()=>{active.current=false;};
 },[id,api,attempt]);
 const changed=()=>{journal?.recipes.invalidate();journal?.library.invalidate();};
 const perform=async(fn:()=>Promise<void>)=>{if(guard.current||!user)return;guard.current=true;setBusy(true);setError(null);const assertSession=api.captureSession();try{assertSession();await fn();assertSession();}catch(e){if(active.current)setError(e);}finally{guard.current=false;if(active.current)setBusy(false);}};
 const duplicate=()=>perform(async()=>{if(!entry||!user)return;const assertStorage=captureAccountStorage(user.id),cache=accountKey(user.id,`recipe-duplicate:${entry.id}:${entry.version}`);
  const saved=await readJson<{key:string}>(cache,true);if(saved&&!/^[A-Za-z0-9_-]{16,64}$/.test(saved.key))throw new ApiError('draftFormat');
  const key=saved?.key??newKey();await writeJson(cache,{key},true);assertStorage();
  const result=await api.duplicateRecipe(entry.id,entry.version,t('recipes.copyName',{name:entry.name}).slice(0,120),key);assertStorage();await remove(cache,true);changed();if(active.current)router.replace({pathname:'/recipes/[id]',params:{id:result.id}});
 });
 const destroy=()=>Alert.alert(t('recipes.delete'),t('recipes.deleteHint'),[{text:t('common.cancel'),style:'cancel'},{text:t('recipes.delete'),style:'destructive',onPress:()=>perform(async()=>{if(!entry)return;await api.deleteRecipe(entry.id,entry.version);changed();if(active.current)router.replace('/recipes');})}]);
 return <Screen header={<Header title={t('recipes.title')} leading="back"/>}>
  {error?<Notice tone="error" message={t(errorMessageKey(error))}/>:null}
  {!ready?<><Notice message={t('common.loading')}/><Button label={t('common.retry')} onPress={()=>{setReady(false);setError(null);setHistory([]);setAttempt(x=>x+1);}}/></>:null}
  {ready&&user?<RecipeEditor key={id+':'+attempt} owner={user.id} initial={entry} api={api} newKey={newKey} writable={writable&&!busy} onSaved={result=>{setEntry(result);changed();if(id==='new')router.replace({pathname:'/recipes/[id]',params:{id:result.id}});}}/>:null}
  {ready&&entry?<><Button label={t('recipes.duplicate')} disabled={busy||!writable} onPress={duplicate}/><Button kind="danger" label={t('recipes.delete')} disabled={busy||!writable} onPress={destroy}/><Button kind="secondary" label={t('recipes.history')} disabled={busy} onPress={()=>perform(async()=>{const result=await api.recipeVersions(entry.id);if(active.current)setHistory(result);})}/>
   {history.map(version=><AppText key={version.version}>{version.version}. {version.name} · {t('recipes.yield')}: {version.servings}</AppText>)}
   {history.map(version=><NutritionGrid key={'nutrition'+version.version} values={mealTotals(draftFromCanonical(version.draft,'history-preview-key','recipe').analysis!.foods)}/>)}</>:null}
 </Screen>;
}
