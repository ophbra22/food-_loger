import {useCallback,useEffect,useSyncExternalStore} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState} from 'react-native';
import {useAuth} from '@/auth/AuthProvider';
import type {TrackingKind} from '@/domain/tracking';
import {EMPTY_TRACKING} from './tracking-store';
import {EMPTY_TRENDS} from './trends-store';
const noop=()=>()=>{};
export function useTracking(kind:TrackingKind,day:string){
 const {journal}=useAuth(),store=journal?.tracking;
 const state=useSyncExternalStore(store?.subscribe??noop,()=>store?.get(kind,day)??EMPTY_TRACKING);
 const refresh=useCallback(async()=>{await store?.load(kind,day);},[store,kind,day]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>sub.remove();},[refresh]);
 return {...state,store,refresh};
}
export function useTrends(from:string,to:string){
 const {journal}=useAuth(),store=journal?.trends;
 const state=useSyncExternalStore(store?.subscribe??noop,()=>store?.get(from,to)??EMPTY_TRENDS);
 const refresh=useCallback(async()=>{await store?.load(from,to);},[store,from,to]);
 useFocusEffect(useCallback(()=>{void refresh();},[refresh]));
 useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});return()=>sub.remove();},[refresh]);
 return {...state,refresh};
}
