import {render,act} from '@testing-library/react-native';
import {AppState,type AppStateStatus} from 'react-native';
import {HealthProvider,useHealth} from '../HealthProvider';
import type {HealthSync} from '@/native/health/sync';
const mockPort={stop:jest.fn(),bind:jest.fn(),authorize:jest.fn(async()=>{}),status:async()=>({available:true,read:'unknown',write:{}}),applyBatch:jest.fn(),read:async()=>[]};
const mockUser={id:'health-owner'};
const mockApi={captureSession:()=>()=>{},healthSnapshot:async()=>({scope:'c'.repeat(32),items:[],withheld:0}),healthImport:jest.fn()};
const mockJournal={subscribeChanges:()=>()=>{},tracking:{subscribe:()=>()=>{},externalChanged:jest.fn()}};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:mockUser,api:mockApi,journal:mockJournal})}));
jest.mock('@/native/health/ios',()=>({healthEnabled:true,get healthPort(){return mockPort;}}));
jest.mock('@/storage/kv',()=>({accountKey:()=> 'health',readJson:async()=>null,writeJson:async()=>{},captureAccountStorage:()=>()=>{}}));
test('inactive permission sheet does not cancel connect, while background stops the session',async()=>{
 let listener!:(state:AppStateStatus)=>void,service!:HealthSync;
 jest.spyOn(AppState,'addEventListener').mockImplementation((_event,fn)=>{listener=fn;return {remove:()=>{}};});
 function Probe(){service=useHealth()!;return null;}
 const view=await render(<HealthProvider><Probe/></HealthProvider>);
 let release!:()=>void;mockPort.authorize.mockImplementationOnce(()=>new Promise<void>(r=>{release=r;}));
 let connecting!:Promise<void>;
 await act(async()=>{connecting=service.connect({nutrition:true,water:false,weight:false,steps:false});await new Promise(r=>setTimeout(r,0));});
 await act(async()=>{listener('inactive');release();await connecting;});
 expect(service.state.connected).toBe(true);
 await act(async()=>{listener('background');});expect(mockPort.stop).toHaveBeenCalled();
 await view.unmount();jest.restoreAllMocks();
});
