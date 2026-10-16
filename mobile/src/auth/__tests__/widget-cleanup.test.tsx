import {useEffect} from 'react';
import {act,render,waitFor} from '@testing-library/react-native';
import {AuthProvider,useAuth} from '../AuthProvider';
import {sessionStore} from '../session-store';
import {stopWidgetSession} from '@/native/widgets/session';
jest.mock('@/native/widgets/session',()=>({stopWidgetSession:jest.fn()}));
jest.mock('@/storage/private-files',()=>({clearPrivateFiles:jest.fn()}));
const mockDelete=jest.fn(async()=>{});
const mockLogout=jest.fn(async()=>{});
jest.mock('@/api/endpoints',()=>({createApi:()=>({me:async()=>({}),logout:()=>mockLogout(),deleteAccount:()=>mockDelete()})}));
jest.mock('../session-store',()=>({sessionStore:{read:jest.fn(),clear:jest.fn(),write:jest.fn()}}));
jest.mock('../apple-auth',()=>({requestAppleProof:jest.fn()}));
let auth:ReturnType<typeof useAuth>;
function Probe(){const value=useAuth();useEffect(()=>{auth=value;},[value]);return null;}
beforeEach(()=>{jest.clearAllMocks();jest.mocked(stopWidgetSession).mockReset();jest.mocked(sessionStore.read).mockResolvedValue({token:'fixture',user:{id:'owner',username:'test'},expiresAt:Date.now()+100000});});
it('clears native snapshots before restoring authentication and before server logout',async()=>{await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(auth.status).toBe('signedIn'));expect(stopWidgetSession).toHaveBeenCalled();const before=jest.mocked(stopWidgetSession).mock.calls.length;mockLogout.mockImplementationOnce(async()=>{expect(jest.mocked(stopWidgetSession).mock.calls.length).toBeGreaterThan(before);});await act(async()=>auth.signOut());expect(auth.status).toBe('signedOut');});
it('failed initial cleanup blocks account restoration and surfaces retry',async()=>{jest.mocked(stopWidgetSession).mockImplementationOnce(()=>{throw Error('disk');});await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(auth.widgetCleanupError).toBe(true));expect(auth.status).not.toBe('signedIn');await act(async()=>auth.retryWidgetCleanup());await waitFor(()=>expect(auth.status).toBe('signedIn'));expect(auth.widgetCleanupError).toBe(false);});
it('failed logout cleanup still ends auth but preserves a visible privacy gate',async()=>{await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(auth.status).toBe('signedIn'));jest.mocked(stopWidgetSession).mockImplementation(()=>{throw Error('disk');});await act(async()=>auth.signOut());expect(auth.status).toBe('signedOut');expect(auth.widgetCleanupError).toBe(true);expect(sessionStore.clear).toHaveBeenCalled();});

it('clears widgets immediately after confirmed deletion even if local erasure fails',async()=>{await render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(auth.status).toBe('signedIn'));jest.mocked(stopWidgetSession).mockClear();mockDelete.mockResolvedValueOnce(undefined);jest.spyOn(require('@/storage/kv'),'clearAccount').mockRejectedValueOnce(Error('disk'));await act(async()=>{await expect(auth.deleteAccount('fixture')).rejects.toThrow('disk');});expect(stopWidgetSession).toHaveBeenCalled();});
