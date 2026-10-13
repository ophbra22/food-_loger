import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useDraft } from '@/data/DraftProvider';
import { catalogFood, useCatalog } from '@/data/catalog';
import { toUnifiedReview } from '@/domain/unified-review';
import { MealAnalysisReview } from '@/components/MealAnalysisReview';
import { LegacyMealReview } from '@/components/LegacyMealReview';
import { Screen } from '@/components/Screen';
import { Notice } from '@/components/Notice';
import { Button } from '@/components/Button';
import { useI18n } from '@/i18n/I18nProvider';

/** One shared item-list editor after the server's migration/rollout gate. */
export default function Review() {
  const {api}=useAuth(), {draft,update,saving}=useDraft(), {foods,error,reload}=useCatalog();
  const {t}=useI18n();
  const [enabled,setEnabled]=useState<boolean|null>(null), [failed,setFailed]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    api.capabilities().then(c=>{if(active)setEnabled(c.canonical_writes && c.partial_core_writes && c.tiny_portion_writes);})
      .catch(()=>{if(active)setFailed(true);});
    return ()=>{active=false;};
  },[api,attempt]);
  useEffect(()=>{
    if(draft===null && !saving) router.dismissTo('/');
    if(!draft || !enabled || saving || draft.attempted || draft.analysis?.version===2) return;
    const food=catalogFood(foods,draft.foodId);
    if(draft.foodId && !food) return;
    update({analysis:toUnifiedReview(draft,food || undefined).analysis});
  },[draft,enabled,foods,update,saving]);
  if(draft?.analysis?.version===2) return <MealAnalysisReview/>;
  if(enabled===false || draft?.attempted) return <LegacyMealReview/>;
  return <Screen><Notice message={t(failed || error ? 'errors.network' : 'common.loading')}/>
    {failed || error ? <Button label={t('common.retry')} onPress={()=>{setFailed(false);setAttempt(n=>n+1);reload();}}/> : null}
    <Button kind="ghost" label={t('common.close')} onPress={()=>router.dismissTo('/')}/>
  </Screen>;
}
