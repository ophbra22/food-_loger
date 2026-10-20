import {useEffect} from 'react';
import {render,waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuthProvider,useAuth} from '../AuthProvider';
import {sessionStore} from '../session-store';
import {accountKey,globalKey} from '@/storage/kv';
const production='https://foodlogger-yfn4.onrender.com';
const preview='https://test.example.com';
jest.mock('@/config/env',()=>({
 DEFAULT_API_URL:'https://foodlogger-yfn4.onrender.com',STAGING_BUILD:false,ALLOW_SERVER_OVERRIDE:false,
 normalizeServerUrl:(v:string)=>/^https:\/\/[a-z0-9.-]+$/.test(v)?v:null,
}));
jest.mock('../session-store',()=>({sessionStore:{read:jest.fn(),write:jest.fn(),clear:jest.fn()}}));
jest.mock('../apple-auth',()=>({requestAppleProof:jest.fn()}));
const mockMe=jest.fn(async()=>({}));
jest.mock('@/api/endpoints',()=>({createApi:()=>({me:()=>mockMe()})}));
let current:ReturnType<typeof useAuth>;
function Probe(){const auth=useAuth();useEffect(()=>{current=auth;},[auth]);return null;}
beforeEach(async()=>{await AsyncStorage.clear();jest.clearAllMocks();});
test.each([
 ['bound preview',preview,JSON.stringify(preview)],
 ['legacy preview',undefined,JSON.stringify(preview)],
 ['ambiguous legacy',undefined,null],
 ['invalid legacy origin',undefined,JSON.stringify(42)],
 ['unreadable legacy origin',undefined,'{broken'],
] as const)('production requires a new login and retains pending data for %s',async(_name,serverUrl,saved)=>{
 if(saved!==null)await AsyncStorage.setItem(globalKey('server-url'),saved);
 await AsyncStorage.setItem(accountKey('owner','draft:v2'),'pending-draft');
 jest.mocked(sessionStore.read).mockResolvedValue({token:'preview-secret',serverUrl,user:{id:'owner',username:'test'},expiresAt:Date.now()+60_000});
 await render(<AuthProvider><Probe/></AuthProvider>);
 await waitFor(()=>expect(current.status).toBe('signedOut'));
 expect(current.serverUrl).toBe(production);
 expect(mockMe).not.toHaveBeenCalled();
 expect(sessionStore.clear).not.toHaveBeenCalled();
 expect(await AsyncStorage.getItem(accountKey('owner','draft:v2'))).toBe('pending-draft');
});
test.each([true,false])('resumes a verified matching origin (explicit binding=%s)',async bound=>{
 await AsyncStorage.setItem(globalKey('server-url'),JSON.stringify(bound?preview:production));
 jest.mocked(sessionStore.read).mockResolvedValue({token:'production-secret',...(bound?{serverUrl:production}:{}),user:{id:'owner',username:'test'},expiresAt:Date.now()+60_000});
 await render(<AuthProvider><Probe/></AuthProvider>);
 await waitFor(()=>expect(current.status).toBe('signedIn'));
 expect(mockMe).toHaveBeenCalledTimes(1);
});
