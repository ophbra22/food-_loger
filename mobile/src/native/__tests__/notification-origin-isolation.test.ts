import * as SecureStore from 'expo-secure-store';
import {nextNotificationInstallation,type NotificationInstallation} from '../notification-installation';
import {NotificationSession} from '../notifications-session';
let mockStaging=false;
let mockOrigin='https://foodlogger-yfn4.onrender.com';
jest.mock('@/config/env',()=>({
 get STAGING_BUILD(){return mockStaging;},
 get DEFAULT_API_URL(){return mockOrigin;},
}));
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn(),AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1}));
jest.mock('expo-crypto',()=>({
 randomUUID:()=>jest.requireActual('node:crypto').randomUUID(),
 CryptoDigestAlgorithm:{SHA256:'SHA-256'},
 digestStringAsync:async(_algorithm:string,value:string)=>jest.requireActual('node:crypto').createHash('sha256').update(value).digest('hex'),
}));
test('registration preserves production identity and isolates each staging origin across upgrades and returns',async()=>{
 const stored=new Map<string,string>();
 const productionKey='foodlogger.notification-installation.v1';
 stored.set(productionKey,JSON.stringify({secret:'a'.repeat(32),generation:5}));
 jest.mocked(SecureStore.getItemAsync).mockImplementation(async key=>stored.get(key)??null);
 jest.mocked(SecureStore.setItemAsync).mockImplementation(async(key,value)=>{stored.set(key,value);});
 const registered:NotificationInstallation[]=[];
 const register=async(staging:boolean,origin:string)=>{
  mockStaging=staging;mockOrigin=origin;
  const api={captureSession:()=>()=>{},capabilities:async()=>({habits:true}),
   habits:async()=>({preferences:{muted:false,lunch:'12:00',timezone_id:'UTC'}}),
   registerReminderDevice:async(_token:string,_platform:string,_ready:boolean,proof:NotificationInstallation)=>{registered.push(proof);},
   pauseReminderDevice:async()=>{},removeReminderDevice:async()=>{}};
  const session=new NotificationSession(api as never,{installation:nextNotificationInstallation,permission:async()=>true,
   token:async()=>'ExpoPushToken[synthetic]',clear:async()=>{},platform:'ios'},async()=>true,()=> 'UTC');
  expect(await session.sync()).toBe('ready');session.close();
 };
 await register(false,'https://foodlogger-yfn4.onrender.com');
 await register(true,'https://stage-a.example.com');
 await register(true,'https://stage-b.example.com');
 await register(false,'https://foodlogger-yfn4.onrender.com');
 await register(true,'https://stage-a.example.com');
 expect(registered[0]).toEqual({secret:'a'.repeat(32),generation:6});
 expect(new Set(registered.slice(0,3).map(p=>p.secret)).size).toBe(3);
 expect(registered[3]).toEqual({secret:registered[0].secret,generation:7});
 expect(registered[4]).toEqual({secret:registered[1].secret,generation:2});
 expect(JSON.parse(stored.get(productionKey)!)).toEqual(registered[3]);
});
