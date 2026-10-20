import {DEFAULT_API_URL} from '@/config/env';
import {useEffect} from 'react';
import {render,waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuthProvider,useAuth} from '../AuthProvider';
import {accountKey,openAccountStorage} from '@/storage/kv';
import {sessionStore} from '../session-store';
import {clearPrivateFiles} from '@/storage/private-files';
jest.mock('@/storage/private-files',()=>({clearPrivateFiles:jest.fn()}));
jest.mock('@/api/endpoints',()=>({createApi:()=>({me:async()=>({})})}));
jest.mock('../session-store',()=>({sessionStore:{read:jest.fn(),clear:jest.fn(),write:jest.fn()}}));
jest.mock('../apple-auth',()=>({requestAppleProof:jest.fn()}));
let status='loading';
function Probe(){const current=useAuth().status;useEffect(()=>{status=current;},[current]);return null;}
test('an expired stored session erases only its owner caches and draft',async()=>{
  await AsyncStorage.clear();openAccountStorage('expired');openAccountStorage('other');
  await AsyncStorage.setItem(accountKey('expired','draft:v2'),'private');
  await AsyncStorage.setItem(accountKey('other','draft:v2'),'other');
  jest.mocked(sessionStore.read).mockResolvedValue({serverUrl:DEFAULT_API_URL,token:'expired-token',user:{id:'expired',username:'expired'},expiresAt:0});
  await render(<AuthProvider><Probe/></AuthProvider>);
  await waitFor(()=>expect(status).toBe('signedOut'));
  await waitFor(async()=>expect(await AsyncStorage.getItem(accountKey('expired','draft:v2'))).toBeNull());
  expect(await AsyncStorage.getItem(accountKey('other','draft:v2'))).toBe('other');
  expect(clearPrivateFiles).toHaveBeenCalled();
});
