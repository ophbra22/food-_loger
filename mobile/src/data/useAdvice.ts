import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState} from 'react-native';
import {useAuth} from '@/auth/AuthProvider';
import {useI18n} from '@/i18n/I18nProvider';
import type {Feature} from '@/domain/advice';
import {EMPTY_ADVICE} from './advice-store';
const noop=()=>()=>{};
export function useAdvice(feature:Feature,date:string){
 const {journal}=useAuth(),{language}=useI18n(),store=journal?.advice;
 const state=useSyncExternalStore(store?.subscribe??noop,()=>store?.get(feature,date,language)??EMPTY_ADVICE);
 const refresh=useCallback(async()=>{await store?.load(feature,date,language);},[store,feature,date,language]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>sub.remove();},[refresh]);
 return {...state,refresh,enhance:(key:string)=>store?.enhance(feature,date,language,key)};
}
