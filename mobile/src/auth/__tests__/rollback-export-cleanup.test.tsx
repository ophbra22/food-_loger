import {useEffect} from 'react';
import {act,render,waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuthProvider,useAuth} from '../AuthProvider';
import {sessionStore} from '../session-store';
import {capturePrivateExport} from '@/storage/export-session';

// Only native storage/remote boundaries are fake; AuthProvider and cleanup are real.
const mockFiles=new Set<string>();
let mockDeleteFailure=false;
jest.mock('expo-file-system',()=>{
 class File {
  name:string;
  constructor(name:string){this.name=name;}
  delete(){if(mockDeleteFailure)throw Error('disk unavailable');mockFiles.delete(this.name);}
 }
 return {File,Directory:class{},Paths:{cache:{list:()=>Array.from(mockFiles,name=>new File(name))}}};
});
jest.mock('@/native/notifications',()=>({stopNotificationSession:jest.fn()}));
jest.mock('@/native/widgets/session',()=>({stopWidgetSession:jest.fn(),allowWidgetSession:jest.fn()}));
jest.mock('@/native/health/session',()=>({stopHealthSession:jest.fn()}));
jest.mock('@/api/endpoints',()=>({createApi:()=>({me:async()=>({}),logout:async()=>{},deleteAccount:async()=>{}})}));
jest.mock('../session-store',()=>({sessionStore:{read:jest.fn(),clear:jest.fn(),write:jest.fn()}}));
jest.mock('../apple-auth',()=>({requestAppleProof:jest.fn()}));
let auth:ReturnType<typeof useAuth>;
function Probe(){const value=useAuth();useEffect(()=>{auth=value;},[value]);return null;}
const archive='biteflow-account-1792308014399.json';
beforeEach(async()=>{
 process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED='1';
 await AsyncStorage.clear();mockFiles.clear();mockDeleteFailure=false;jest.clearAllMocks();
 // A previous P13 process died after writing this archive; the new build must clean it.
 mockFiles.add(archive);mockFiles.add('biteflow-2026-10-18.csv');mockFiles.add('font.ttf');
 jest.mocked(sessionStore.read).mockResolvedValue({token:'fixture',user:{id:'owner',username:'test'},expiresAt:Date.now()+60000});
 await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(auth.status).toBe('signedIn'));
});
afterEach(()=>{delete process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED;});
async function leave(action:string){if(action==='logout')await auth.signOut();else await auth.deleteAccount('fixture-password');}
it.each(['logout','deletion'])('removes a crash-leftover archive on %s even with account exports disabled',async action=>{
 const check=capturePrivateExport();
 await act(async()=>leave(action));
 expect(mockFiles).toEqual(new Set(['font.ttf']));
 expect(auth.status).toBe('signedOut');expect(check).toThrow();
});
it.each(['logout','deletion'])('surfaces failed %s cleanup and permits a compatible cleanup retry',async action=>{
 // Cold start already erased the old archive; this export was created during this session.
 expect(mockFiles.has(archive)).toBe(false);mockFiles.add(archive);
 const check=capturePrivateExport();mockDeleteFailure=true;
 await act(async()=>leave(action));
 expect(auth.status).toBe('signedOut');expect(auth.privateCleanupError).toBe(true);
 expect(mockFiles.has(archive)).toBe(true);expect(check).toThrow();
 mockDeleteFailure=false;
 await act(async()=>auth.retryPrivateCleanup());
 expect(mockFiles).toEqual(new Set(['font.ttf']));expect(auth.status).toBe('signedOut');expect(auth.privateCleanupError).toBe(false);
});
