import {router} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';
import {useDraft} from '@/data/DraftProvider';
import {getAddIntent} from '@/data/add-intent';
import {libraryDraft} from '@/domain/library';
import {useI18n} from '@/i18n/I18nProvider';
import {LibraryPanel} from '@/components/LibraryPanel';
import {Screen} from '@/components/Screen';
import {Header} from '@/components/Header';
export default function Library(){
 const {journal}=useAuth(),{start,newKey}=useDraft(),{t}=useI18n();
 return <Screen header={<Header title={t('library.title')} leading="back"/>}>{journal?<LibraryPanel store={journal.library} onSelect={async(entry,servings)=>{await start(libraryDraft(entry,newKey(),getAddIntent(),servings));router.push('/add/review');}}/>:null}</Screen>;
}
