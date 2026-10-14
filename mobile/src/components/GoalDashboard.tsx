import {StyleSheet,View} from 'react-native';
import type {DaySummary} from '@/api/types';
import {goalProgress,type GoalRevision} from '@/domain/goals';
import {useI18n} from '@/i18n/I18nProvider';
import {formatNumber,formatQuantity} from '@/i18n/format';
import {colors,radius,spacing} from '@/theme/tokens';
import {AppText} from './AppText';
import {Button} from './Button';

export function GoalDashboard({summary,goal,onEdit}:{summary:DaySummary;goal:GoalRevision|null;onEdit:()=>void}) {
 const {t,language}=useI18n();const progress=goalProgress(summary,goal);
 return <View style={styles.wrap}>
  <AppText variant="heading" accessibilityRole="header">{t('goals.title')}</AppText>
  {!goal || !Object.values(progress).some(m=>m.target!==null)?<AppText>{t('goals.noGoal')}</AppText>:null}
  {(['calories','protein','carbs','fat','water'] as const).map(key=>{
   const metric=progress[key],unit=key==='calories'?'kcal':key==='water'?'ml':'g';
   const name=key==='water'?t('goals.water_ml'):t(`nutrients.${key}`);
   const target=formatQuantity(language,metric.target,unit);
   const consumed=metric.consumed===null?t('goals.unknown'):formatQuantity(language,metric.consumed,unit);
   const status=t(`goals.statuses.${metric.status}`);
   const full=metric.percent!==null && metric.status!=='unlogged';
   const description=full?t('goals.progress',{consumed,target,percent:formatNumber(language,metric.percent!,1)}):`${consumed} / ${target}`;
   return <View key={key} style={styles.card}>
    <AppText variant="label">{name}</AppText>
    <AppText>{description}</AppText>
    <AppText testID={`goal-status-${key}`} variant="caption" color={colors.muted}>{status}</AppText>
    {metric.consumed===null && metric.known_total!==null?<AppText variant="caption">{t('goals.known',{value:formatQuantity(language,metric.known_total,unit)})}</AppText>:null}
    {full?<>
     <View testID={`goal-progress-${key}`} accessible accessibilityRole="progressbar" accessibilityLabel={`${name}: ${description}. ${status}`}
      accessibilityValue={{min:0,max:100,now:Math.max(0,Math.min(100,metric.percent!)),text:description}} style={styles.track}>
      <View style={[styles.fill,{width:`${Math.max(0,Math.min(100,metric.percent!))}%`}]}/>
     </View>
     <AppText variant="caption">{t(metric.remaining!<0?'goals.over':'goals.remaining',{value:formatQuantity(language,Math.abs(metric.remaining!),unit)})}</AppText>
    </>:null}
   </View>;
  })}
  <AppText testID="goal-logging-caveat" variant="caption" color={colors.butter}>{t('goals.loggedOnly')}</AppText>
  <AppText variant="caption" color={colors.muted}>{t('goals.rules',{min:goal?.calorie_min_percent??90,max:goal?.calorie_max_percent??110})}</AppText>
  <AppText variant="caption" color={colors.muted}>{t('goals.waterHint')}</AppText>
  <Button kind="secondary" label={t('goals.edit')} onPress={onEdit}/>
 </View>;
}
const styles=StyleSheet.create({
 wrap:{gap:spacing.md},card:{backgroundColor:colors.surface,borderRadius:radius.md,padding:spacing.md,gap:spacing.xs},
 track:{height:8,borderRadius:4,overflow:'hidden',backgroundColor:colors.field},fill:{height:8,backgroundColor:colors.sage},
});
