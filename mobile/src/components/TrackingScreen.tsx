import {useEffect,useState} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {useAuth} from '@/auth/AuthProvider';
import {useGoals} from '@/data/useGoals';
import {effectiveGoal} from '@/domain/goals';
import {isIsoDay,todayIso} from '@/domain/dates';
import type {TrackingKind} from '@/domain/tracking';
import {useI18n} from '@/i18n/I18nProvider';
import {Screen} from './Screen';
import {Header} from './Header';
import {DayNav} from './DayNav';
import {TrackingPanel} from './TrackingPanel';
export function TrackingScreen({kind}:{kind:TrackingKind}){
 const {day:parameter}=useLocalSearchParams<{day?:string}>(),{journal}=useAuth(),{t}=useI18n();
 const [day,setDay]=useState(isIsoDay(parameter)?parameter:todayIso()),goals=useGoals(),goal=effectiveGoal(goals.data,day);
 useEffect(()=>{void journal?.goals.load();},[journal]);
 return <Screen header={<Header title={t(`tracking.${kind}`)}/>}><DayNav day={day} onChange={setDay}/>{journal?<TrackingPanel key={journal.userId+':'+day} kind={kind} day={day} store={journal.tracking} target={(kind==='water'?goal?.water_ml:goal?.target_weight_kg)??null}/>:null}</Screen>;
}
