import {useEffect,useState,useSyncExternalStore} from 'react';
import {StyleSheet,View} from 'react-native';
import {router} from 'expo-router';
import * as Crypto from 'expo-crypto';
import {TrackingStore} from '@/data/tracking-store';
import {displayValue,normalizeValue,localStamp,measurementContext,stampInZone,type DisplayUnit,type TrackingKind,type Measurement} from '@/domain/tracking';
import {todayIso,parseIsoDay} from '@/domain/dates';
import {useI18n} from '@/i18n/I18nProvider';
import {formatNumber} from '@/i18n/format';
import {errorMessageKey} from '@/api/messages';
import {colors,spacing,radius} from '@/theme/tokens';
import {AppText} from './AppText';
import {Button} from './Button';
import {TextField} from './TextField';
import {Notice} from './Notice';

export function TrackingPanel({kind,day,store,target,compact=false}:{kind:TrackingKind;day:string;store:TrackingStore;target:number|null;compact?:boolean}){
 const {t,language}=useI18n(),state=useSyncExternalStore(store.subscribe,()=>store.get(kind,day));
 const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 const [unit,setUnit]=useState<DisplayUnit>(kind==='water'?'ml':'kg');
 const [amount,setAmount]=useState(''),[stamp,setStamp]=useState(localStamp(day===todayIso()?new Date():parseIsoDay(day))),[timezone,setTimezone]=useState(zone);
 const [editing,setEditing]=useState<Measurement|null>(null),[error,setError]=useState<string|null>(null);
 useEffect(()=>{void store.load(kind,day);},[store,kind,day]);
 const value=(n:number|null)=>n===null?'—':`${formatNumber(language,displayValue(n,unit),1)} ${unit}`;
 const signed=(n:number|null)=>n===null?'—':`${n>0?'+':n<0?'−':''}${value(Math.abs(n))}`;
 const blocked=!state.writable||!state.fresh||state.saving||state.pending;
 async function save(quick?:number){
  setError(null);
  try{const context=quick!==undefined?measurementContext(localStamp(day===todayIso()?new Date():parseIsoDay(day)),zone):measurementContext(stamp,timezone);
   const measured=quick??normalizeValue(Number(amount.replace(',','.')),unit);
   await store.save(kind,{value:measured,...context},Crypto.randomUUID(),quick!==undefined?null:editing);
   setEditing(null);setAmount('');
  }catch(e){setError(t(errorMessageKey(e)));}
 }
 async function erase(entry:Measurement){setError(null);try{await store.save(kind,{value:entry.value,...measurementContext(stampInZone(entry.occurred_at,entry.timezone_id),entry.timezone_id)},Crypto.randomUUID(),entry,true);}catch(e){setError(t(errorMessageKey(e)));}}
 if(state.enabled===false)return compact?null:<Notice message={t('tracking.disabled')}/>;
 const total=state.data?.total??null,latest=state.data?.latest;
 const percent=total!==null&&target?total/target*100:null;
 return <View style={styles.panel}>
  <AppText variant="heading">{t(`tracking.${kind}`)}</AppText>
  {kind==='water'?<>
   <AppText testID="water-total" variant="title">{value(total)}</AppText>
   <AppText>{t('tracking.target',{value:value(target)})}</AppText>
   {percent!==null?<View accessible accessibilityRole="progressbar" accessibilityLabel={t('tracking.water')} accessibilityValue={{min:0,max:100,now:Math.min(100,percent),text:`${formatNumber(language,percent,1)}%`}}><AppText>{formatNumber(language,percent,1)}%</AppText></View>:null}
   <View style={styles.row}>{[150,250,500].map(ml=><Button key={ml} testID={`water-add-${ml}`} compact label={`+${value(ml)}`} disabled={blocked} onPress={()=>{void save(ml);}}/>)}</View>
  </>:<>
   <AppText>{t('tracking.latest',{value:value(latest?.value??null)})}</AppText>
   {latest?<AppText variant="caption">{latest.local_date} · {t(`tracking.sources.${latest.source}`)}</AppText>:null}
   <AppText>{t('tracking.delta',{value:signed(state.data?.delta??null)})}</AppText>
   <AppText>{t('tracking.target',{value:value(target)})}</AppText>
  </>}
  <Button testID="tracking-unit" kind="ghost" label={t('tracking.units',{unit})} disabled={!!editing} onPress={()=>setUnit(unit==='kg'?'lb':unit==='lb'?'kg':unit==='ml'?'fl oz':'ml')}/>
  {state.saving?<Notice message={t('tracking.pending')}/>:null}
  {!state.fresh&&!state.loading&&state.data?<Notice tone="warning" message={t('tracking.stale')}/>:null}
  {error||state.error?<Notice tone="error" message={error??t(errorMessageKey(state.error))}/>:null}
  {state.error?<Notice tone="warning" message={t('tracking.rollback')}/>:null}
  {state.pending&&!state.saving?<>
   <Notice message={t('tracking.retryHint')}/>
   <Button label={t('tracking.retry')} onPress={()=>{void store.retry().catch(e=>setError(t(errorMessageKey(e))));}}/>
   {state.error&&['validation','conflict','notFound','forbidden'].includes(state.error.kind)?<Button kind="secondary" label={t('tracking.clearRejected')} onPress={()=>{void store.clearRejected().then(()=>store.load(kind,day)).catch(e=>setError(t(errorMessageKey(e))));}}/>:null}
  </>:null}
  <Button kind="ghost" label={t('common.retry')} disabled={state.saving} onPress={()=>{void store.load(kind,day);}}/>
  {compact?<Button kind="secondary" label={t('tracking.history')} onPress={()=>router.push({pathname:'/water',params:{day}})}/>:<>
   <TextField label={t('tracking.amount',{unit})} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" ltr editable={!state.saving&&!state.pending}/>
   <TextField label={t('tracking.timestamp')} hint={t('tracking.timeHint')} value={stamp} onChangeText={setStamp} ltr editable={!state.saving&&!state.pending}/>
   <TextField label={t('tracking.zone')} value={timezone} onChangeText={setTimezone} ltr editable={!state.saving&&!state.pending}/>
   <Button label={t(editing?'tracking.saveEdit':'tracking.add')} disabled={blocked} onPress={()=>{void save();}}/>
   {editing?<Button kind="ghost" label={t('common.cancel')} onPress={()=>{setEditing(null);setAmount('');}}/>:null}
   <AppText variant="heading">{t('tracking.history')} · {day}</AppText>
   {!state.data?.items.length?<AppText>{t('tracking.empty')}</AppText>:null}
   {state.data?.items.map(entry=><View key={entry.id} style={styles.entry}>
    <AppText>{value(entry.value)}</AppText><AppText variant="caption">{stampInZone(entry.occurred_at,entry.timezone_id)} · {entry.timezone_id} · {t(`tracking.sources.${entry.source}`)}</AppText>
    <View style={styles.row}>
     <Button compact kind="secondary" label={t('tracking.edit')} disabled={blocked||entry.source!=='manual'} onPress={()=>{setEditing(entry);setAmount(String(displayValue(entry.value,unit)));setStamp(stampInZone(entry.occurred_at,entry.timezone_id));setTimezone(entry.timezone_id);}}/>
     <Button compact testID={`delete-${entry.id}`} kind="danger" label={t('tracking.delete')} disabled={blocked} onPress={()=>{void erase(entry);}}/>
    </View>
   </View>)}
   {state.data?.has_more?<Button label={t('tracking.more')} onPress={()=>{void store.load(kind,day,true);}}/>:null}
   <Button kind="secondary" label={t('tracking.trends')} onPress={()=>router.push({pathname:'/trends',params:{day}})}/>
   <Button kind="ghost" label={t('goals.edit')} onPress={()=>router.push('/goals')}/>
  </>}
 </View>;
}
const styles=StyleSheet.create({panel:{gap:spacing.md},row:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm},entry:{backgroundColor:colors.surface,padding:spacing.md,borderRadius:radius.md,gap:spacing.sm}});
