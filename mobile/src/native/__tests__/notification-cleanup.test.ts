import {clearOwnedNotifications} from '../notifications';
import * as Notifications from 'expo-notifications';
jest.mock('expo-notifications',()=>({setNotificationHandler:jest.fn(),getAllScheduledNotificationsAsync:jest.fn(async()=>[{identifier:'owned',content:{data:{kind:'biteflow-reminder'}}},{identifier:'other',content:{data:{}}}]),getPresentedNotificationsAsync:jest.fn(async()=>[{request:{identifier:'shown',content:{data:{kind:'biteflow-reminder'}}}}]),cancelScheduledNotificationAsync:jest.fn(async()=>{}),dismissNotificationAsync:jest.fn(async()=>{})}));
test('cancels and dismisses only BiteFlow-owned reminders',async()=>{
 await clearOwnedNotifications();expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('owned');expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('shown');
});
