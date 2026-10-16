import {useEffect} from 'react';
import {act,render,waitFor} from '@testing-library/react-native';
import {WidgetProvider,useWidgets} from '../WidgetProvider';
import {readJson,writeJson} from '@/storage/kv';
import {stopWidgetSession,startWidgetSession,releaseWidgetSession} from '@/native/widgets/session';
let mockAuth:any={user:{id:'a'},journal:{},pendingRecoveryCode:null};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>mockAuth}));
jest.mock('@/i18n/I18nProvider',()=>({useI18n:()=>({language:'en'})}));
jest.mock('@/storage/kv',()=>({accountKey:(id:string,key:string)=>id+key,readJson:jest.fn(),writeJson:jest.fn(),captureAccountStorage:()=>()=>{}}));
jest.mock('@/native/widgets/native',()=>({widgetPort:{available:()=>true}}));
jest.mock('@/native/widgets/session',()=>({stopWidgetSession:jest.fn(),startWidgetSession:jest.fn(fn=>fn()),releaseWidgetSession:jest.fn()}));
jest.mock('@/native/widgets/lifecycle',()=>({WidgetLifecycle:jest.fn().mockImplementation(()=>({start:async()=>{},refresh:async()=>{},close:()=>{}}))}));
let state:ReturnType<typeof useWidgets>;function Probe(){const value=useWidgets();useEffect(()=>{state=value;},[value]);return null;}
beforeEach(()=>{jest.clearAllMocks();mockAuth={user:{id:'a'},journal:{},pendingRecoveryCode:null};jest.mocked(readJson).mockResolvedValue(false);jest.mocked(writeJson).mockResolvedValue(undefined);});
it('requires account opt-in and clears before disabling',async()=>{await render(<WidgetProvider><Probe/></WidgetProvider>);await waitFor(()=>expect(readJson).toHaveBeenCalled());expect(startWidgetSession).not.toHaveBeenCalled();await act(async()=>state.setEnabled(true));expect(startWidgetSession).toHaveBeenCalledTimes(1);expect(state.enabled).toBe(true);jest.mocked(writeJson).mockImplementationOnce(async()=>{expect(stopWidgetSession).toHaveBeenCalled();});await act(async()=>state.setEnabled(false));expect(state.enabled).toBe(false);});
it('ignores late preference load from prior account',async()=>{let resolve!:(v:boolean)=>void;jest.mocked(readJson).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const view=await render(<WidgetProvider><Probe/></WidgetProvider>);mockAuth={user:{id:'b'},journal:{},pendingRecoveryCode:null};await view.rerender(<WidgetProvider><Probe/></WidgetProvider>);await act(async()=>resolve(true));expect(startWidgetSession).not.toHaveBeenCalled();expect(state.enabled).toBe(false);});
it('surfaces preference failure without enabling publication',async()=>{await render(<WidgetProvider><Probe/></WidgetProvider>);await waitFor(()=>expect(readJson).toHaveBeenCalled());jest.mocked(writeJson).mockRejectedValueOnce(Error('disk'));await act(async()=>state.setEnabled(true));expect(state.error).toBe(true);expect(state.enabled).toBe(false);expect(startWidgetSession).not.toHaveBeenCalled();});

it('cleans up the latest publisher after disabling and reenabling',async()=>{jest.mocked(readJson).mockResolvedValue(true);const view=await render(<WidgetProvider><Probe/></WidgetProvider>);await waitFor(()=>expect(state.enabled).toBe(true));await act(async()=>state.setEnabled(false));await act(async()=>state.setEnabled(true));const latest=jest.mocked(startWidgetSession).mock.results.at(-1)!.value;await view.unmount();expect(releaseWidgetSession).toHaveBeenLastCalledWith(latest);});
