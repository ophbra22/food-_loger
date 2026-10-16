import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import {validateImportPage,type Choices,type HealthPort,type HealthStatus,type ImportPage} from './types';
type Bridge={bind:(session:string,scope:string)=>void;stop:(session:string)=>void;status:()=>Promise<HealthStatus>;authorize:(choices:Choices)=>Promise<void>;manage:()=>Promise<void>;applyBatch:(session:string,scope:string,json:string)=>Promise<{applied:string[];failed:string[]}>;readPage:(session:string,scope:string,kind:string,cursor:string|null,from:string,to:string)=>Promise<ImportPage>};
export const connectEnabled=Platform.OS==='android'&&process.env.EXPO_PUBLIC_HEALTH_CONNECT_ENABLED==='1';
export function createConnectPort(native:Bridge|null,enabled:boolean):HealthPort{
 const require=()=>{if(!enabled||!native)throw Error('Health Connect is unavailable in this build.');return native;};
 return {status:async()=>enabled&&native?native.status():{available:false,availability:'unavailable',read:'unknown',write:{},readGranted:{weight:false,steps:false}},authorize:async choices=>require().authorize(choices),manage:async()=>require().manage(),bind:(session,scope)=>require().bind(session,scope),stop:session=>native?.stop(session),applyBatch:async(session,scope,items)=>require().applyBatch(session,scope,JSON.stringify(items)),read:async()=>{throw Error('Use paginated Health Connect reads');},readPage:async(session,scope,kind,cursor,from,to)=>validateImportPage(await require().readPage(session,scope,kind,cursor,from,to),kind)};
}
export const connectPort=createConnectPort(Platform.OS==='android'?requireOptionalNativeModule<Bridge>('BiteflowHealth'):null,connectEnabled);
