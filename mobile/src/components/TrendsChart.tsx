import {useState} from 'react';
import {View,StyleSheet} from 'react-native';
import Svg,{Rect,Line,Circle,Text as SvgText} from 'react-native-svg';
import type {TrendPeriod,Metric} from '@/domain/trends';
import {displayValue,type DisplayUnit} from '@/domain/tracking';
import {useI18n} from '@/i18n/I18nProvider';
import {formatNumber} from '@/i18n/format';
import {colors,spacing} from '@/theme/tokens';
import {AppText} from './AppText';
import {Button} from './Button';
export function TrendsChart({period,metric,weightUnit='kg',waterUnit='ml'}:{period:TrendPeriod;metric:Metric;weightUnit?:DisplayUnit;waterUnit?:DisplayUnit}){
 const {t,language}=useI18n(),[primary,setPrimary]=useState(true),[overlay,setOverlay]=useState(true);
 const unit=metric==='weight'?weightUnit:metric==='water'?waterUnit:metric==='calories'?'kcal':'g';
 const convert=(n:number)=>metric==='weight'||metric==='water'?displayValue(n,unit as DisplayUnit):n;
 const targetKey=({calories:'calorie_target',protein:'protein_g',carbs:'carbs_g',fat:'fat_g',water:'water_ml',weight:'target_weight_kg'} as const)[metric];
 const max=Math.max(1,...period.days.flatMap(d=>[d[metric]===null?0:convert(d[metric]!),d.targets?.[targetKey]?convert(d.targets[targetKey]!):0]))*1.1;
 const weightMax=Math.max(1,...period.days.map(d=>d.weight===null?0:displayValue(d.weight,weightUnit)))*1.1;
 const width=400,height=230,left=48,right=352,top=18,bottom=190,step=(right-left)/period.days.length;
 const y=(n:number,scale=max)=>bottom-n/scale*(bottom-top),x=(i:number)=>left+step*(i+0.5);
 return <View style={styles.wrap}>
  <View style={styles.row}><Button compact testID="chart-primary" kind={primary?'secondary':'ghost'} label={t('tracking.primaryLayer')} onPress={()=>setPrimary(v=>!v)}/>{metric==='calories'?<Button compact testID="chart-weight" kind={overlay?'secondary':'ghost'} label={t('tracking.weightLayer')} onPress={()=>setOverlay(v=>!v)}/>:null}</View>
  <AppText testID="chart-left-axis">{metric==='calories'?t('tracking.calorieAxis'):`${t(metric==='water'||metric==='weight'?`tracking.${metric}`:`nutrients.${metric}`)} · ${unit}`}</AppText>
  {metric==='calories'&&overlay?<AppText testID="chart-right-axis">{t('tracking.weightAxis',{unit:weightUnit})}</AppText>:null}
  <View accessible accessibilityRole="image" accessibilityLabel={`${period.from} – ${period.to}. ${unit}${metric==='calories'&&overlay?`, ${weightUnit}`:''}. ${t('tracking.sparse')}`}>
   <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
    <Line x1={left} y1={top} x2={left} y2={bottom} stroke={colors.muted}/><Line x1={left} y1={bottom} x2={right} y2={bottom} stroke={colors.muted}/>
    {[0,0.5,1].map(f=><SvgText key={f} x={left-5} y={y(f*max)+4} fill={colors.sand} textAnchor="end" fontSize={11}>{formatNumber(language,f*max,0)}</SvgText>)}
    {metric==='calories'&&overlay?<>{[0,0.5,1].map(f=><SvgText key={f} x={right+5} y={y(f*weightMax,weightMax)+4} fill={colors.rose} fontSize={11}>{formatNumber(language,f*weightMax,0)}</SvgText>)}</>:null}
    {period.days.map((d,i)=><ViewlessPoint key={d.date} day={d} i={i}/>)}
    <SvgText x={left} y={214} fill={colors.sand} fontSize={10}>{period.from}</SvgText><SvgText x={right} y={214} fill={colors.sand} textAnchor="end" fontSize={10}>{period.to}</SvgText>
   </Svg>
  </View>
  <AppText variant="caption">{t('tracking.goalLegend')}</AppText>
 </View>;
 function ViewlessPoint({day:d,i}:{day:TrendPeriod['days'][number];i:number}){
  const v=d[metric],target=d.targets?.[targetKey];
  return <>{primary&&v!==null?<Rect testID={`point-${d.date}`} x={x(i)-step*0.3} y={y(convert(v))} width={step*0.6} height={bottom-y(convert(v))} fill={colors.sage}/>:null}
   {primary&&target!==null&&target!==undefined?<Line x1={x(i)-step*0.45} x2={x(i)+step*0.45} y1={y(convert(target))} y2={y(convert(target))} stroke={colors.butter} strokeWidth={2}/>:null}
   {metric==='calories'&&overlay&&d.weight!==null?<Circle testID={`weight-point-${d.date}`} cx={x(i)} cy={y(displayValue(d.weight,weightUnit),weightMax)} r={4} fill={colors.rose}/>:null}
  </>;
 }
}
const styles=StyleSheet.create({wrap:{gap:spacing.sm},row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm}});
