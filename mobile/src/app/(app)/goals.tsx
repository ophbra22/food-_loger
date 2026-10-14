import {useAuth} from '@/auth/AuthProvider';
import {GoalSettings} from '@/components/GoalSettings';
import {Header} from '@/components/Header';
import {Screen} from '@/components/Screen';
import {useI18n} from '@/i18n/I18nProvider';
export default function Goals() {
 const {journal}=useAuth();const {t}=useI18n();
 return <Screen header={<Header title={t('goals.title')}/>}>{journal?<GoalSettings key={journal.userId} store={journal.goals}/>:null}</Screen>;
}
