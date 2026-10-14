import {router,useLocalSearchParams} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';
import {useDraft} from '@/data/DraftProvider';
import {CopySelection} from '@/components/CopySelection';
import {Screen} from '@/components/Screen';
import {Header} from '@/components/Header';
import {useI18n} from '@/i18n/I18nProvider';
import {isIsoDay,todayIso,addDays} from '@/domain/dates';
export default function Copy(){
 const {api,user}=useAuth(),{start,newKey}=useDraft(),{t}=useI18n(),params=useLocalSearchParams<{source?:string;destination?:string;mealId?:string}>();
 const destination=isIsoDay(params.destination)?params.destination:todayIso(),source=isIsoDay(params.source)?params.source:addDays(destination,-1);
 return <Screen header={<Header title={t('copy.title')} leading="back"/>}><CopySelection key={(user?.id??'')+source+destination+(params.mealId??'')} api={api} sourceDay={source} destinationDay={destination} mealId={params.mealId} newKey={newKey} onReview={async draft=>{await start(draft);router.push('/add/review');}}/></Screen>;
}
