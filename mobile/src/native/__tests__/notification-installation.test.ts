import {nextNotificationInstallation} from '../notification-installation';
import * as SecureStore from 'expo-secure-store';
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn(),AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}));
beforeEach(()=>{jest.clearAllMocks();});
test('persists a private installation identity and increases generation across account lifecycles',async()=>{
 let value:string|null=null;
 (SecureStore.getItemAsync as jest.Mock).mockImplementation(async()=>value);
 (SecureStore.setItemAsync as jest.Mock).mockImplementation(async(_k,v)=>{value=v;});
 const [a,b]=await Promise.all([nextNotificationInstallation(),nextNotificationInstallation()]);
 expect(a.secret).toHaveLength(32);expect(b.secret).toBe(a.secret);expect(b.generation).toBe(a.generation+1);
 expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
});
test('failed secure persistence fails closed; corrupt identity is not silently replaced',async()=>{
 (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('{"secret":"invalid"}');
 await expect(nextNotificationInstallation()).rejects.toThrow();expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
 (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);(SecureStore.setItemAsync as jest.Mock).mockRejectedValue(new Error('locked'));
 await expect(nextNotificationInstallation()).rejects.toThrow('locked');
});
