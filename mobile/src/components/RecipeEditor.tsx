import {useEffect,useRef,useState} from 'react';
import {Alert,View} from 'react-native';
import type {Api} from '@/api/endpoints';
import {ApiError} from '@/api/errors';
import {errorMessageKey} from '@/api/messages';
import {type LibraryEntry,object} from '@/domain/library';
import {recipeForm,recipeBody,type RecipeForm} from '@/domain/recipes';
import {mealTotals,newReviewFood} from '@/domain/meal-analysis';
import {multiply} from '@/domain/exact';
import {parseDecimal} from '@/domain/validation';
import {storedDraft} from '@/storage/validation';
import {accountKey,captureAccountStorage,readJson,writeJson,remove} from '@/storage/kv';
import {useI18n} from '@/i18n/I18nProvider';
import {AppText} from './AppText';
import {Button} from './Button';
import {TextField} from './TextField';
import {MealFoodEditor} from './MealFoodEditor';
import {NutritionGrid} from './NutritionGrid';
import {Notice} from './Notice';
type RecipeApi=Partial<Pick<Api,'saveRecipe'|'recipe'|'nutritionReferences'|'captureSession'>>;
export function RecipeEditor({owner,initial,api,newKey,onSaved,onReloaded,writable=true}:{owner:string;initial:LibraryEntry|null;api:RecipeApi;newKey:()=>string;onSaved:(entry:LibraryEntry)=>void;onReloaded?:(entry:LibraryEntry)=>void;writable?:boolean}){
 const {t}=useI18n();const [form,setForm]=useState(()=>recipeForm(initial,newKey())),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[cacheBlocked,setCacheBlocked]=useState(false);
 const identity=initial?.id??'new',cache=accountKey(owner,'recipe-draft:v1:'+identity),busyRef=useRef(false),active=useRef(true);
 useEffect(()=>{active.current=true;const assertStorage=captureAccountStorage(owner);
  readJson<{owner:string;identity:string;form:RecipeForm}>(cache,true).then(saved=>{assertStorage();if(!active.current)return;
   if(saved){const f=saved.form;if(saved.owner!==owner||saved.identity!==identity||!object(f)||typeof f.key!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(f.key)||typeof f.attempted!=='boolean'||!Number.isSafeInteger(f.expectedVersion)||f.expectedVersion<0||typeof f.name!=='string'||f.name.length>120||typeof f.servings!=='string'||f.servings.length>16||!storedDraft(f.draft)||!f.draft.analysis)throw new ApiError('draftFormat');setForm(f);}
  }).catch(e=>{if(active.current){setError(e);setCacheBlocked(true);}}).finally(()=>{if(active.current)setReady(true);});
  return()=>{active.current=false;};
 },[owner,identity,cache]);
 const edit=(change:Partial<RecipeForm>)=>{if(!ready||busyRef.current||cacheBlocked)return;const next={...form,...change,key:form.attempted?newKey():form.key,attempted:false};setForm(next);void writeJson(cache,{owner,identity,form:next},true).catch(e=>{if(active.current)setError(e);});};
 let valid=true;try{recipeBody(form);}catch{valid=false;}
 const save=async()=>{if(busyRef.current||!ready||!valid||cacheBlocked||!writable)return;busyRef.current=true;setBusy(true);setError(null);
  const assertStorage=captureAccountStorage(owner),assertSession=api.captureSession?.();
  try{assertStorage();assertSession?.();if(!api.saveRecipe)throw new ApiError('unavailable');
   const attempted={...form,attempted:true};setForm(attempted);await writeJson(cache,{owner,identity,form:attempted},true);assertStorage();assertSession?.();
   const result=await api.saveRecipe(initial?.id??null,recipeBody(attempted),attempted.key);assertStorage();assertSession?.();
   await remove(cache,true);if(active.current){setForm(recipeForm(result,newKey()));onSaved(result);}
  }catch(e){if(active.current)setError(e);}finally{busyRef.current=false;if(active.current)setBusy(false);}
 };
 const reload=()=>Alert.alert(t('recipes.reload'),t('recipes.reloadHint'),[{text:t('common.cancel'),style:'cancel'},{text:t('recipes.reload'),style:'destructive',onPress:()=>{void (async()=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);const assertStorage=captureAccountStorage(owner);
  try{const latest=initial&&api.recipe?await api.recipe(initial.id):initial;assertStorage();await remove(cache,true);if(active.current){setForm(recipeForm(latest,newKey()));if(latest)onReloaded?.(latest);setError(null);setCacheBlocked(false);}}
  catch(e){if(active.current)setError(e);}finally{busyRef.current=false;if(active.current)setBusy(false);}
 })();}}]);
 const foods=form.draft.analysis?.foods??[],total=mealTotals(foods),yieldAmount=parseDecimal(form.servings);
 const per=Object.fromEntries(Object.entries(total).map(([k,v])=>[k,v===null||yieldAmount===null||!Number.isFinite(yieldAmount)||yieldAmount<0.01||yieldAmount>1000?null:multiply(v,1,yieldAmount)])) as typeof total;
 const updateFoods=(next:typeof foods)=>edit({draft:{...form.draft,analysis:{...form.draft.analysis!,foods:next}}});
 if(!ready)return <Notice message={t('common.loading')}/>;
 return <>
  {error?<Notice tone="error" message={error instanceof ApiError&&error.kind==='conflict'?t('recipes.conflict'):t(errorMessageKey(error))}/>:null}
  {!writable?<Notice message={t('recipes.disabled')}/>:null}
  <TextField testID="recipe-name" label={t('recipes.name')} value={form.name} onChangeText={name=>edit({name})} editable={!busy&&writable&&!cacheBlocked} maxLength={120}/>
  <TextField testID="recipe-yield" label={t('recipes.yield')} value={form.servings} onChangeText={servings=>edit({servings})} editable={!busy&&writable&&!cacheBlocked} keyboardType="decimal-pad" ltr maxLength={16}/>
  <AppText variant="label">{t('recipes.total')}</AppText><NutritionGrid testID="recipe-total" values={total}/>
  <AppText variant="label">{t('recipes.perServing')}</AppText><NutritionGrid testID="recipe-serving" values={per}/>
  {foods.length===0?<Notice message={t('recipes.empty')}/>:null}
  {foods.map(food=><View key={food.id}><MealFoodEditor food={food} partial disabled={busy||!writable||cacheBlocked} search={api.nutritionReferences??(async()=>({foods:[]}))} onChange={next=>updateFoods(foods.map(f=>f.id===next.id?next:f))} onRemove={()=>updateFoods(foods.filter(f=>f.id!==food.id))}/></View>)}
  <Button label={t('analysis.addFood')} kind="secondary" disabled={busy||!writable||cacheBlocked||foods.length>=15} onPress={()=>updateFoods([...foods,{...newReviewFood(newKey()),manual:{calories:'',protein:'',carbs:'',fat:''}}])}/>
  <Button testID="save-recipe" label={t('recipes.save')} onPress={save} busy={busy} disabled={!valid||cacheBlocked||!writable}/>
  <Button kind="ghost" label={t('recipes.reload')} onPress={reload} disabled={busy}/>
 </>;
}
