import {Platform} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {NotificationSession,type NotificationPort} from './notifications-session';
export const notificationsEnabled=process.env.EXPO_PUBLIC_REMINDERS_ENABLED==='1'&&(Platform.OS==='ios'||Platform.OS==='android');
let active:NotificationSession|null=null;
export const setNotificationSession=(session:NotificationSession|null)=>{active?.close();active=session;};
export const syncNotifications=(ask=false)=>active?.sync(ask)??Promise.resolve('unavailable' as const);
export const stopNotificationSession=()=>setNotificationSession(null);
const owned=(n:Notifications.NotificationRequest)=>n.content.data?.kind==='biteflow-reminder';
export async function clearOwnedNotifications(){
 if(Platform.OS==='web')return;
 const scheduled=await Notifications.getAllScheduledNotificationsAsync();
 for(const n of scheduled)if(owned(n))await Notifications.cancelScheduledNotificationAsync(n.identifier);
 const shown=await Notifications.getPresentedNotificationsAsync();
 for(const n of shown)if(owned(n.request))await Notifications.dismissNotificationAsync(n.request.identifier);
}
export function notificationPort():NotificationPort{
 return {platform:Platform.OS==='android'?'android':'ios',clear:clearOwnedNotifications,
  permission:async ask=>{
   if(!notificationsEnabled)return false;
   if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('biteflow-reminders',{name:'BiteFlow',importance:Notifications.AndroidImportance.DEFAULT});
   let p=await Notifications.getPermissionsAsync();
   if(!p.granted&&ask&&p.canAskAgain)p=await Notifications.requestPermissionsAsync();
   return p.granted; // provisional/unknown is conservatively suppressed
  },
  token:async()=>{
   if(!notificationsEnabled)throw new Error('Disabled');
   const projectId=Constants.expoConfig?.extra?.eas?.projectId;
   if(typeof projectId!=='string')throw new Error('Missing push project');
   return (await Notifications.getExpoPushTokenAsync({projectId})).data;
  }};
}
// Foreground never displays a possibly stale alert; the diary is already accessible.
if(Platform.OS!=='web')Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:false})});
