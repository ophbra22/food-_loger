import {useEffect,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,StyleSheet,Switch,View} from 'react-native';
import {GoalsStore} from '@/data/goals-store';
import {effectiveGoal,GOAL_LIMITS,GOAL_MINIMUMS,goalWarnings,parseGoalForm,validGoalDate,type GoalDocument,type GoalKey} from '@/domain/goals';
import {todayIso} from '@/domain/dates';
import {useI18n} from '@/i18n/I18nProvider';
import {colors,spacing} from '@/theme/tokens';
import {AppText} from './AppText';
import {Button} from './Button';
import {Notice} from './Notice';
import {TextField} from './TextField';

function formFor(doc:GoalDocument,date:string) {
 const goal=effectiveGoal(doc,date);
 return Object.fromEntries((Object.keys(GOAL_LIMITS) as GoalKey[]).map(k=>[k,String(goal?.[k]??(k==='calorie_min_percent'?90:k==='calorie_max_percent'?110:''))]));
}
export function GoalSettings({store}:{store:GoalsStore}) {
 const state=useSyncExternalStore(store.subscribe,store.get);const {t}=useI18n();
 useEffect(()=>{void store.load();},[store]);
 if(state.enabled===false)return <Notice message={t('goals.disabled')}/>;
 if(!state.data)return <View style={styles.form}>{state.loading?<ActivityIndicator color={colors.sage}/>:<Notice tone="warning" message={t('goals.unavailable')}/>}
  <Button label={t('common.retry')} onPress={()=>{void store.refresh();}}/></View>;
 return <GoalForm store={store} initial={state.data}/>;
}
function GoalForm({store,initial}:{store:GoalsStore;initial:GoalDocument}) {
 const state=useSyncExternalStore(store.subscribe,store.get);const {t}=useI18n();
 const [date,setDate]=useState(todayIso()),[allowPast,setAllowPast]=useState(false);
 const [form,setForm]=useState(()=>formFor(initial,todayIso())),[version,setVersion]=useState(initial.version);
 const [reloading,setReloading]=useState(false);
 const [saved,setSaved]=useState(false),[failed,setFailed]=useState(false);
 const parsed=parseGoalForm(form),past=validGoalDate(date)&&date<todayIso();
 const invalid=!parsed || !validGoalDate(date);
 const mismatch=parsed && goalWarnings(parsed).length>0;
 const refresh=async()=>{
  setReloading(true);
  try {
   await store.refresh();const current=store.get();
   if(current.fresh && current.data){setForm(formFor(current.data,date));setVersion(current.data.version);setFailed(false);setSaved(false);}
  }finally{setReloading(false);}
 };
 const save=async()=>{
  if(!parsed || invalid || (past && !allowPast))return;
  setSaved(false);setFailed(false);
  try {
   await store.save({...parsed,effective_local_date:date,timezone_id:Intl.DateTimeFormat().resolvedOptions().timeZone,expected_version:version,allow_past:past&&allowPast});
   setVersion(store.get().data?.version??version);setSaved(true);
  }catch{setFailed(true);}
 };
 return <View style={styles.form}>
  <AppText>{t('goals.manualHint')}</AppText>
  <TextField testID="goal-date" label={t('goals.effectiveDate')} value={date} ltr editable={!state.saving && !reloading}
   hint={t('goals.dateHint')} onChangeText={v=>{setDate(v);setAllowPast(false);setSaved(false);}}/>
  {past?<View style={styles.confirm}>
    <AppText style={{flex:1}}>{t('goals.pastHint')}</AppText>
    <Switch testID="goal-allow-past" accessibilityLabel={t('goals.pastHint')} value={allowPast} disabled={state.saving || reloading} onValueChange={setAllowPast}/>
   </View>:null}
  {(Object.keys(GOAL_LIMITS) as GoalKey[]).map(k=><TextField key={k} testID={`goal-${k}`} label={t(`goals.${k}`)} ltr keyboardType="decimal-pad"
   value={form[k]} editable={!state.saving && !reloading} onChangeText={v=>{setForm({...form,[k]:v});setSaved(false);}}
   hint={k==='calorie_min_percent'?t('goals.bandMinHint'):k==='calorie_max_percent'?t('goals.bandMaxHint'):t('goals.rangeHint',{min:GOAL_MINIMUMS[k],max:GOAL_LIMITS[k]})}/>) }
  <AppText variant="caption" color={colors.muted}>{t('goals.waterHint')}</AppText>
  {invalid?<Notice tone="warning" message={t('goals.invalid')}/>:null}
  {mismatch?<Notice tone="warning" message={t('goals.mismatch')}/>:null}
  {failed?<Notice tone="error" message={t('goals.rollback')}/>:null}
  {!state.fresh?<Notice tone="warning" message={t('goals.stale')}/>:null}
  {version!==(state.data?.version??version) && !state.saving?<Notice tone="warning" message={t('goals.conflict')}/>:null}
  {saved?<Notice tone="info" message={t('goals.saved')}/>:null}
  <Button testID="save-goals" label={t('goals.save')} busy={state.saving || reloading}
   disabled={!state.fresh || invalid || (past&&!allowPast) || version!==state.data?.version} onPress={()=>{void save();}}/>
  <Button kind="secondary" label={t('goals.reload')} disabled={state.saving || reloading || !validGoalDate(date)} onPress={()=>{void refresh();}}/>
  <AppText variant="caption" color={colors.muted}>{t('goals.historyHint',{count:state.data?.version??0})}</AppText>
 </View>;
}
const styles=StyleSheet.create({form:{gap:spacing.md},confirm:{flexDirection:'row',gap:spacing.md,alignItems:'center'}});
