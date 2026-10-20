import { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../AuthProvider';
import { sessionStore } from '../session-store';
import { globalKey, accountKey } from '@/storage/kv';
jest.mock('@/config/env', () => ({
 DEFAULT_API_URL: 'https://biteflow-staging.onrender.com', STAGING_BUILD:true,
 ALLOW_SERVER_OVERRIDE:false, normalizeServerUrl:(v:string)=>v,
}));
jest.mock('../session-store', () => ({sessionStore:{read:jest.fn(),write:jest.fn(),clear:jest.fn()}}));
jest.mock('../apple-auth', () => ({requestAppleProof:jest.fn()}));
const mockMe=jest.fn(async()=>({}));
jest.mock('@/api/endpoints',()=>({createApi:()=>({me:()=>mockMe()})}));
let current:ReturnType<typeof useAuth>;
function Probe(){const auth=useAuth();useEffect(()=>{current=auth;},[auth]);return null;}
beforeEach(async()=>{await AsyncStorage.clear();jest.clearAllMocks();});
test('a beta upgrade ignores a saved production override and never resumes an unbound session',async()=>{
 await AsyncStorage.setItem(globalKey('server-url'),JSON.stringify('https://foodlogger-yfn4.onrender.com'));
 await AsyncStorage.setItem(accountKey('old-owner','draft:v2'),'pending-draft');
 jest.mocked(sessionStore.read).mockResolvedValue({token:'old-secret',user:{id:'old-owner',username:'old'},expiresAt:Date.now()+60_000});
 await render(<AuthProvider><Probe/></AuthProvider>);
 await waitFor(()=>expect(current.status).toBe('signedOut'));
 expect(current.serverUrl).toBe('https://biteflow-staging.onrender.com');
 expect(mockMe).not.toHaveBeenCalled();
 expect(await AsyncStorage.getItem(accountKey('old-owner','draft:v2'))).toBe('pending-draft');
 let changed:boolean|undefined;
 await act(async()=>{changed=await current.setServerUrl('https://foodlogger-yfn4.onrender.com');});
 expect(changed).toBe(false);
});
test.each(['https://biteflow-staging.onrender.com','https://different-staging.onrender.com'])('resumes only a session belonging to the built API: %s',async serverUrl=>{
 jest.mocked(sessionStore.read).mockResolvedValue({token:'test-secret',serverUrl,user:{id:'test-owner',username:'tester'},expiresAt:Date.now()+60_000});
 await render(<AuthProvider><Probe/></AuthProvider>);
 await waitFor(()=>expect(current.status).toBe(serverUrl==='https://biteflow-staging.onrender.com'?'signedIn':'signedOut'));
 expect(mockMe).toHaveBeenCalledTimes(serverUrl==='https://biteflow-staging.onrender.com'?1:0);
});
