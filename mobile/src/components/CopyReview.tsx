import {useState} from 'react';
import {Alert} from 'react-native';
import {router} from 'expo-router';
import {useDraft} from '@/data/DraftProvider';
import {useAuth} from '@/auth/AuthProvider';
import {isDraftValid} from '@/domain/drafts';
import {mealTotals} from '@/domain/meal-analysis';
import {useI18n} from '@/i18n/I18nProvider';
import {errorMessageKey} from '@/api/messages';
import {ApiError} from '@/api/errors';
import {Screen} from './Screen';
import {Header} from './Header';
import {AppText} from './AppText';
import {Button} from './Button';
import {MealFoodEditor} from './MealFoodEditor';
import {NutritionGrid} from './NutritionGrid';
import {Notice} from './Notice';
import {DraftPersistenceNotice} from './DraftPersistenceNotice';
export function CopyReview(){
 const {draft,update,save,discard,saving}=useDraft(),{api}=useAuth(),{t}=useI18n();const [error,setError]=useState<unknown>(null),[index,setIndex]=useState(0);
 if(!draft?.copy)return null;const copy=draft.copy,meal=copy.meals[index],foods=meal.analysis!.foods;
 const confirm=async()=>{setError(null);try{await save();router.dismissTo('/');}catch(e){setError(e);}};
 return <Screen header={<Header title={t('copy.preview')} leading="back"/>} footer={<Button testID="confirm-copy" label={t('copy.save')} busy={saving} disabled={!isDraftValid(draft)} onPress={confirm}/>}>
  <DraftPersistenceNotice/>
  <AppText>{t('copy.destination')}: {copy.selection.destination_date} · {copy.selection.timezone_id}</AppText>
  <NutritionGrid values={mealTotals(copy.meals.flatMap(m=>m.analysis!.foods))}/>
  {error?<Notice tone="error" message={t(error instanceof ApiError&&error.kind==='conflict'?'copy.changed':errorMessageKey(error))}/>:null}
  {copy.destinationPopulated?<><Notice tone="warning" message={t('copy.populated')}/><Button testID="confirm-populated-copy" label={t(copy.confirmPopulated?'copy.populatedConfirmed':'copy.confirmPopulated')} kind="secondary" disabled={saving} onPress={()=>update({copy:{...copy,confirmPopulated:!copy.confirmPopulated}})}/></>:null}
  {copy.meals.map((m,i)=><Button key={i} label={`${i+1}. ${m.name} · ${m.occurredAt}`} kind={i===index?'primary':'secondary'} disabled={saving} onPress={()=>setIndex(i)}/>)}
  {foods.map(food=><MealFoodEditor key={index+food.id} food={food} partial disabled={saving} search={api.nutritionReferences} onChange={next=>update({copy:{...copy,meals:copy.meals.map((m,i)=>i!==index?m:{...m,analysis:{...m.analysis!,foods:foods.map(f=>f.id===next.id?next:f)}})}})} onRemove={()=>update({copy:{...copy,meals:copy.meals.map((m,i)=>i!==index?m:{...m,analysis:{...m.analysis!,foods:foods.filter(f=>f.id!==food.id)}})}})}/>)}
  <Button label={t('copy.newPreview')} kind="secondary" disabled={saving} onPress={()=>router.push({pathname:'/copy',params:{source:copy.selection.source_day,destination:copy.selection.destination_date}})}/>
  <Button label={t('review.discard')} kind="ghost" disabled={saving} onPress={()=>Alert.alert(t('review.discardTitle'),t('review.discardBody'),[{text:t('common.cancel'),style:'cancel'},{text:t('review.discard'),style:'destructive',onPress:()=>{void discard();}}])}/>
 </Screen>;
}
