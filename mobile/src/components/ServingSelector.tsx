import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import type {ReviewFood} from '@/domain/meal-analysis';
import {applyServing,type ServingConversion} from '@/domain/servings';
import {useI18n} from '@/i18n/I18nProvider';
import {Button} from './Button';
import {TextField} from './TextField';
import {AppText} from './AppText';
import {Notice} from './Notice';
export type ServingLoader=(id:string,version:string)=>Promise<{conversions:ServingConversion[]}>;
export function ServingSelector({food,onChange,disabled,load}:{food:ReviewFood;onChange:(f:ReviewFood)=>void;disabled:boolean;load:ServingLoader}) {
 const {t}=useI18n(),[rows,setRows]=useState<ServingConversion[]|null>(null),[selected,setSelected]=useState<ServingConversion|null>(null),[quantity,setQuantity]=useState('1'),[busy,setBusy]=useState(false),[error,setError]=useState(false),generation=useRef(0);
 const id=food.reference?.id,version=food.reference?.source_version;
 useEffect(()=>{generation.current++;setRows(null);setSelected(null);setBusy(false);setError(false);return()=>{generation.current++;};},[id,version,food.basis]);
 if(!id||!version) return null;
 const find=async()=>{const n=++generation.current;setBusy(true);setError(false);try{const r=await load(id,version);if(n===generation.current)setRows(r.conversions.filter(c=>c.food_id===id&&c.source_version===version&&c.basis===(food.basis??'g')));}catch{if(n===generation.current)setError(true);}finally{if(n===generation.current)setBusy(false);}};
 const original=food.originalPortion;
 return <View>
  <Button label={t('servings.title')} kind="ghost" disabled={disabled||busy} onPress={find}/>
  {rows?.length===0||error?<Notice message={t('servings.missing')}/>:null}
  {rows?.map(r=><Button key={r.id} label={`${r.label} · ${r.amount} ${r.basis}`} kind="ghost" disabled={disabled} onPress={()=>{setSelected(r);setError(false);}}/>)}
  {selected?<><AppText variant="caption">{selected.label} · {selected.confidence}</AppText><TextField label={t('servings.count')} value={quantity} onChangeText={setQuantity} editable={!disabled} maxLength={12} keyboardType="decimal-pad"/>
   <Button label={t('servings.apply')} disabled={disabled} onPress={()=>{try{onChange(applyServing(food,selected,quantity));setError(false);}catch{setError(true);}}}/></>:null}
  {original?.food_specific_conversion_id?<AppText variant="caption">{`${original.quantity} × ${original.unit} → ${food.amount} ${food.basis??'g'}`}</AppText>:null}
 </View>;
}
