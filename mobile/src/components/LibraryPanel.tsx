import {useEffect,useState,useSyncExternalStore} from 'react';
import {View} from 'react-native';
import type {LibraryStore} from '@/data/library-store';
import type {LibraryEntry} from '@/domain/library';
import {parseDecimal} from '@/domain/validation';
import {useI18n} from '@/i18n/I18nProvider';
import {errorMessageKey} from '@/api/messages';
import {AppText} from './AppText';
import {Button} from './Button';
import {Notice} from './Notice';
import {Segmented} from './Segmented';
import {TextField} from './TextField';
import {colors,spacing,radius} from '@/theme/tokens';
export function LibraryPanel({store,onSelect}:{store:LibraryStore;onSelect:(entry:LibraryEntry,servings:number)=>void|Promise<void>}){
 const {t}=useI18n();const [tab,setTab]=useState<'recent'|'favorites'>('recent'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[offset,setOffset]=useState(0),[amount,setAmount]=useState('1'),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null);
 const favorites=tab==='favorites';const state=useSyncExternalStore(store.subscribe,()=>store.get(favorites,search,offset));
 useEffect(()=>{void store.load(favorites,search,offset);},[store,favorites,search,offset]);
 const servings=parseDecimal(amount);const valid=servings!==null&&Number.isFinite(servings)&&servings>=0.01&&servings<=1000;
 const perform=async(action:()=>void|Promise<void>)=>{if(busy)return;setBusy(true);setError(null);try{await action();}catch(e){setError(e);}finally{setBusy(false);}};
 return <>
  <Segmented label={t('library.title')} value={tab} onChange={value=>{setTab(value);setOffset(0);}} disabled={busy} options={[{value:'recent',label:t('library.recents')},{value:'favorites',label:t('library.favorites')}]}/>
  <TextField label={t('library.search')} value={query} onChangeText={setQuery} maxLength={120} editable={!busy} onSubmitEditing={()=>{setSearch(query.trim());setOffset(0);}}/>
  <Button kind="secondary" label={t('library.search')} disabled={busy} onPress={()=>{setSearch(query.trim());setOffset(0);}}/>
  {state.enabled===false?<Notice message={t('library.disabled')}/>:null}
  {state.loading?<AppText>{t('common.loading')}</AppText>:null}
  {state.data&&!state.fresh?<Notice tone="warning" message={t('library.stale')}/>:null}
  {state.error||error?<Notice tone="error" message={t(errorMessageKey(error??state.error))}/>:null}
  <Button kind="ghost" label={t('common.retry')} disabled={busy||state.loading} onPress={()=>store.refresh(favorites,search,offset)}/>
  <TextField testID="library-servings" label={t('library.servings')} hint={t('library.servingsHint')} value={amount} onChangeText={setAmount} editable={!busy} keyboardType="decimal-pad" ltr maxLength={12} error={!valid?t('library.invalidAmount'):null}/>
  {state.data?.items.length===0?<Notice message={t('library.empty')}/>:null}
  {state.data?.items.map(entry=><View key={entry.kind+entry.id} style={{backgroundColor:colors.surface,padding:spacing.md,borderRadius:radius.lg,gap:spacing.sm}}>
   <AppText variant="bodyStrong">{entry.name}</AppText>
   <AppText variant="caption">{t(entry.kind==='recipe'?'library.recipe':'library.snapshot')}</AppText>
   <Button testID={'repeat-'+entry.id} label={t('library.repeat')} disabled={!valid||busy} onPress={()=>perform(()=>onSelect(entry,servings!))}/>
   <Button kind="ghost" label={t(entry.favorite?'library.unfavorite':'library.favorite')} disabled={busy||!state.fresh} onPress={()=>perform(()=>store.favorite(entry,!entry.favorite))}/>
  </View>)}
  {offset>0?<Button label={t('library.previous')} disabled={busy} onPress={()=>setOffset(Math.max(0,offset-20))}/>:null}
  {state.data?.next_offset!=null?<Button label={t('library.more')} disabled={busy} onPress={()=>setOffset(state.data!.next_offset!)}/>:null}
 </>;
}
