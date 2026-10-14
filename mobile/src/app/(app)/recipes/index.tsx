import {router,useFocusEffect} from 'expo-router';
import {useCallback} from 'react';
import {useAuth} from '@/auth/AuthProvider';
import {useDraft} from '@/data/DraftProvider';
import {getAddIntent} from '@/data/add-intent';
import {libraryDraft} from '@/domain/library';
import {useI18n} from '@/i18n/I18nProvider';
import {LibraryPanel} from '@/components/LibraryPanel';
import {Screen} from '@/components/Screen';
import {Header} from '@/components/Header';
import {Button} from '@/components/Button';
export default function Recipes(){
 const {journal}=useAuth(),{start,newKey}=useDraft(),{t}=useI18n();
 useFocusEffect(useCallback(()=>{void journal?.recipes.refresh();},[journal]));
 return <Screen header={<Header title={t('recipes.title')} leading="back"/>}>
  <Button label={t('recipes.create')} onPress={()=>router.push({pathname:'/recipes/[id]',params:{id:'new'}})}/>
  {journal?<LibraryPanel recipes store={journal.recipes} onEdit={entry=>router.push({pathname:'/recipes/[id]',params:{id:entry.id}})} onSelect={async(entry,servings)=>{await start(libraryDraft(entry,newKey(),getAddIntent(),servings));router.push('/add/review');}}/>:null}
 </Screen>;
}
