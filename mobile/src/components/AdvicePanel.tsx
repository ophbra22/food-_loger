import {View} from 'react-native';
import type {Advice,RecommendationChoice} from '@/domain/advice';
import {useI18n} from '@/i18n/I18nProvider';
import {adviceText} from '@/i18n/advice';
import {formatNumber} from '@/i18n/format';
import {AppText} from './AppText';
import {Button} from './Button';
import {Notice} from './Notice';
export function AdvicePanel({data,selectable=false,onSelect}:{data:Advice;selectable?:boolean;onSelect?:(choice:RecommendationChoice)=>void}){
 const {language}=useI18n(),a=(k:string)=>adviceText(language,k),n=(v:number|null)=>v===null?'—':formatNumber(language,v,1);
 return <>
  {data.sentences?.map(s=><AppText key={s.id}>{s.text}</AppText>)}
  {'trends' in data?<>
   {data.trends.current.statistics.insufficient_data?<Notice tone="warning" message={a('sparse')}/>:null}
   <AppText variant="heading">{a('distribution')}</AppText>
   {data.meal_distribution.map(d=><View key={d.category} style={{gap:8}}><AppText variant="label">{a(d.category)}</AppText><AppText>{d.entry_count} {a('componentCount')} · {d.logged_days} {a('loggedDays')}</AppText><AppText>{a('categoryAverage')}: {n(d.calories_average)} kcal · {n(d.protein_average)} g</AppText></View>)}
  </>:<>
   <AppText variant="heading">{a('remaining')}</AppText>
   {(['calories','protein','carbs','fat'] as const).map(k=><AppText key={k}>{a(k)}: {n(data.remaining[k])}</AppText>)}
   {data.warnings.map(w=><Notice key={w} tone="warning" message={a(w)}/>)}
   {data.choices.map((choice,i)=><View key={`${choice.entry.kind}:${choice.entry.id}`} style={{gap:8}}>
    <AppText variant="heading">{choice.entry.name}</AppText><AppText>{n(choice.servings)} {a('portion')}</AppText>
    {(['calories','protein','carbs','fat'] as const).map((k,j)=><AppText key={k}>{a(k)}: {n(choice.nutrition.values[['energy_kcal','protein_g','carbs_g','fat_g'][j]]??null)}</AppText>)}
    <AppText>{a(choice.rationale)}</AppText><AppText>{a(choice.safety_status==='user_reviewed'?'userReviewed':'allergies_unknown')}</AppText>
    <Notice message={a('approximate')}/>
    {choice.warnings.map(w=><AppText key={w}>{a(w)}</AppText>)}
    {choice.draft.items.map(item=><AppText variant="caption" key={item.id}>{item.display_name} · {a('source')}: {item.source.provider} · {a(item.source.verified_status)} · {item.source.reference_id??'—'} / {item.source.version??'—'}</AppText>)}
    <Button testID={`advice-choice-${i}`} disabled={!selectable} label={a('review')} onPress={()=>onSelect?.(choice)}/>
   </View>)}
  </>}
 </>;
}
