import {useEffect,useRef} from 'react';
import {AppState} from 'react-native';
import * as Notifications from 'expo-notifications';
import {useAuth} from '@/auth/AuthProvider';
import {useDraft} from '@/data/DraftProvider';
import {NotificationSession} from '@/native/notifications-session';
import {notificationsEnabled,notificationPort,setNotificationSession,syncNotifications} from '@/native/notifications';
export function NotificationLifecycle(){
 const {api,journal}=useAuth();const {draft,saving,persistenceError}=useDraft();
 const settled=useRef(false);
 useEffect(()=>{
  if(!notificationsEnabled||!journal)return;
  const session=new NotificationSession(api,notificationPort(),async()=>settled.current&&await journal.tracking.settledForReminders(),()=>Intl.DateTimeFormat().resolvedOptions().timeZone);
  setNotificationSession(session);const sync=()=>{void session.sync();};sync();
  const state=AppState.addEventListener('change',s=>{if(s==='active')sync();});
  const token=Notifications.addPushTokenListener(sync);
  const log=journal.subscribeChanges(sync),water=journal.tracking.subscribe(sync),goals=journal.goals.subscribe(sync);
  const timer=setInterval(()=>{if(AppState.currentState==='active')sync();},300000);
  return()=>{clearInterval(timer);state.remove();token.remove();log();water();goals();setNotificationSession(null);};
 },[api,journal]);
 useEffect(()=>{settled.current=draft===null&&!saving&&!persistenceError;if(notificationsEnabled)void syncNotifications();},[draft,saving,persistenceError]);
 return null;
}
