import {NotificationSession,type NotificationPort} from '../notifications-session';
const preferences={version:1,timezone_id:'UTC',language:'en',muted:false,breakfast:null,lunch:'12:00',dinner:null,water:null,evening:null,quiet_start:'22:00',quiet_end:'07:00'};
function fixture(){
 const port:NotificationPort={installation:jest.fn(async()=>({secret:'a'.repeat(32),generation:1})),permission:jest.fn(async()=>true),token:jest.fn(async()=> 'ExpoPushToken[fixture]'),clear:jest.fn(async()=>{}),platform:'ios'};
 const api={captureSession:()=>()=>{},capabilities:jest.fn(async()=>({habits:true})),habits:jest.fn(async()=>({preferences,streak:{current:2,longest:2,logged_days:2}})),registerReminderDevice:jest.fn(async()=>{}),pauseReminderDevice:jest.fn(async()=>{}),removeReminderDevice:jest.fn(async()=>{})};
 const session=new NotificationSession(api as never,port,async()=>true,()=> 'UTC');return {port,api,session};
}
test('denial revokes without token lookup and is harmless',async()=>{const {port,api,session}=fixture();(port.permission as jest.Mock).mockResolvedValue(false);expect(await session.sync(true)).toBe('denied');expect(api.removeReminderDevice).toHaveBeenCalled();expect(port.token).not.toHaveBeenCalled();});
test('registers only opt-in and rotates refreshed token',async()=>{const {port,api,session}=fixture();expect(await session.sync()).toBe('ready');(port.token as jest.Mock).mockResolvedValue('ExpoPushToken[rotated]');await session.sync();expect(api.registerReminderDevice).toHaveBeenLastCalledWith('ExpoPushToken[rotated]','ios',true,{secret:'a'.repeat(32),generation:1});});
test('close during permission wait prevents late registration',async()=>{const {port,api,session}=fixture();let done!:(v:boolean)=>void;(port.permission as jest.Mock).mockReturnValue(new Promise(r=>{done=r;}));const pending=session.sync();await Promise.resolve();await Promise.resolve();await Promise.resolve();session.close();done(true);await pending;expect(api.registerReminderDevice).not.toHaveBeenCalled();});
test('offline is a safe unavailable state and clears owned notifications',async()=>{const {port,api,session}=fixture();api.habits.mockRejectedValue(new Error('offline'));expect(await session.sync()).toBe('unavailable');expect(port.clear).toHaveBeenCalled();});
test('mute and timezone mismatch revoke registration',async()=>{const {api,session}=fixture();api.habits.mockResolvedValue({preferences:{...preferences,muted:true},streak:{current:0,longest:0,logged_days:0}});expect(await session.sync()).toBe('paused');expect(api.registerReminderDevice).not.toHaveBeenCalled();});
test('pending drafts or measurement receipts pause rather than advertising a ready device',async()=>{
 const {port,api}=fixture();const session=new NotificationSession(api as never,port,async()=>false,()=> 'UTC');
 expect(await session.sync()).toBe('paused');expect(api.pauseReminderDevice).toHaveBeenCalled();expect(port.token).not.toHaveBeenCalled();
});
test('travel pauses until the owner saves the new timezone',async()=>{
 const {port,api}=fixture();const session=new NotificationSession(api as never,port,async()=>true,()=> 'Asia/Jerusalem');
 expect(await session.sync()).toBe('paused');expect(api.registerReminderDevice).not.toHaveBeenCalled();
});
