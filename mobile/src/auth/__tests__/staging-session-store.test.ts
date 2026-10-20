import * as SecureStore from 'expo-secure-store';
import {sessionStore} from '../session-store';
jest.mock('@/config/env',()=>({STAGING_BUILD:true}));
jest.mock('expo-secure-store',()=>({getItemAsync:jest.fn(),setItemAsync:jest.fn(),deleteItemAsync:jest.fn(),AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1}));
test('the staging login cannot overwrite or erase the existing production credential',async()=>{
 const session={token:'synthetic',serverUrl:'https://staging.onrender.com',user:{id:'test',username:'test'},expiresAt:1};
 await sessionStore.read();await sessionStore.write(session);await sessionStore.clear();
 expect(SecureStore.getItemAsync).toHaveBeenCalledWith('foodlogger.session.staging',expect.any(Object));
 expect(SecureStore.setItemAsync).toHaveBeenCalledWith('foodlogger.session.staging',JSON.stringify(session),expect.any(Object));
 expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('foodlogger.session.staging',expect.any(Object));
});
