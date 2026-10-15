import {useState} from 'react';
import {View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {useTrends} from '@/data/useTracking';
import {periodDates,METRICS,type Metric} from '@/domain/trends';
import {addDays,isIsoDay,todayIso,parseIsoDay,toIsoDay} from '@/domain/dates';
import {displayValue,type DisplayUnit} from '@/domain/tracking';
import {useI18n} from '@/i18n/I18nProvider';
import {formatNumber} from '@/i18n/format';
import {Screen} from '@/components/Screen';
import {Header} from '@/components/Header';
import {AppText} from '@/components/AppText';
import {Button} from '@/components/Button';
import {Notice} from '@/components/Notice';
import {TrendsChart} from '@/components/TrendsChart';
import {errorMessageKey} from '@/api/messages';
export default function Trends(){
 const {day}=useLocalSearchParams<{day?:string}>(),{t,language}=useI18n();
 const [anchor,setAnchor]=useState(isIsoDay(day)?day:todayIso()),[mode,setMode]=useState<'week'|'month'>('week'),[metric,setMetric]=useState<Metric>('calories');
 const [weightUnit,setWeightUnit]=useState<DisplayUnit>('kg'),[waterUnit,setWaterUnit]=useState<DisplayUnit>('ml');
 const {from,to}=periodDates(anchor,mode),state=useTrends(from,to),data=state.data;
 const unit=metric==='weight'?weightUnit:metric==='water'?waterUnit:metric==='calories'?'kcal':'g';
 const formatted=(n:number|null)=>n===null?t('tracking.unknown'):`${n<0?'−':''}${formatNumber(language,metric==='weight'||metric==='water'?displayValue(Math.abs(n),unit as DisplayUnit):Math.abs(n),1)} ${unit}`;
 const move=(direction:number)=>{if(mode==='week')setAnchor(addDays(from,direction*7));else{const d=parseIsoDay(from);setAnchor(toIsoDay(new Date(d.getFullYear(),d.getMonth()+direction,1,12)));}};
 return <Screen header={<Header title={t('tracking.trends')}/>}>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['week','month'] as const).map(m=><Button key={m} compact kind={m===mode?'primary':'secondary'} label={t(`tracking.${m}`)} onPress={()=>setMode(m)}/>)}</View>
  <AppText variant="heading" ltr>{from} – {to}</AppText>
  <Button kind="secondary" label={t('tracking.previous')} onPress={()=>move(-1)}/><Button kind="secondary" label={t('tracking.next')} onPress={()=>move(1)}/>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{METRICS.map(m=><Button compact key={m} kind={m===metric?'primary':'secondary'} label={t(m==='water'||m==='weight'?`tracking.${m}`:`nutrients.${m}`)} onPress={()=>setMetric(m)}/>)}</View>
  <Button kind="ghost" label={t('tracking.units',{unit:weightUnit})} onPress={()=>setWeightUnit(weightUnit==='kg'?'lb':'kg')}/><Button kind="ghost" label={t('tracking.units',{unit:waterUnit})} onPress={()=>setWaterUnit(waterUnit==='ml'?'fl oz':'ml')}/>
  {state.enabled===false?<Notice message={t('tracking.noTrends')}/>:null}
  {state.error?<Notice tone="error" message={t(errorMessageKey(state.error))}/>:null}
  {!state.fresh&&data?<Notice tone="warning" message={t('tracking.stale')}/>:null}
  <Button kind="ghost" label={t('common.retry')} onPress={()=>{void state.refresh();}}/>
  {data?<>
   <Notice message={t('tracking.recorded')}/>
   {data.current.statistics.insufficient_data?<Notice tone="warning" message={t('tracking.sparse')}/>:null}
   <AppText>{t('tracking.denominator',{count:data.current.statistics.logged_days,missing:data.current.statistics.unlogged_days})}</AppText>
   <AppText>{t('tracking.adherence',{met:data.current.statistics.calorie_in_range,logged:data.current.statistics.logged_days,eligible:data.current.statistics.calorie_eligible_days})}</AppText>
   <AppText>{t(metric==='weight'?'tracking.weightAverage':metric==='water'?'tracking.waterAverage':'tracking.averages')}: {formatted(data.current.statistics.average[metric])} ({metric==='weight'?data.current.statistics.measured_days:metric==='water'?data.current.statistics.water_logged_days:data.current.statistics.logged_days})</AppText>
   <AppText>{t('tracking.compare',{from:data.previous.from,to:data.previous.to})}</AppText>
   <AppText>{t('tracking.difference',{value:formatted(data.comparison[metric])})}</AppText>
   <TrendsChart period={data.current} metric={metric} weightUnit={weightUnit} waterUnit={waterUnit}/>
   {data.current.days.map(d=><View key={d.date} style={{gap:8}}>
    <Button kind="secondary" label={t('tracking.dayDetails',{day:d.date})} onPress={()=>router.push({pathname:'/',params:{day:d.date}})}/>
    <AppText>{formatted(d[metric])}</AppText>
    {metric==='calories'||metric==='protein'||metric==='carbs'||metric==='fat'?<>
     <AppText variant="caption">{t('tracking.sourceStatus',{value:d.nutrition_sources.map(s=>t(`tracking.statusLabels.${s as 'verified'|'user_confirmed'|'estimated'|'legacy_unknown'}`)).join(', ')||t('tracking.unknown')})}</AppText>
     {d.estimated?<AppText>{t('tracking.estimated')}</AppText>:null}
    </>:<AppText>{(metric==='weight'?[d.weight_source]:d.water_sources).filter(Boolean).map(s=>t(`tracking.sources.${s as 'manual'|'apple_health'|'health_connect'}`)).join(', ')||t('tracking.unknown')}</AppText>}
   </View>)}
  </>:null}
 </Screen>;
}
