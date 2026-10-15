import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import type {Choices,HealthPort,HealthStatus,HealthSample} from './types';
type Bridge={bind:(session:string,scope:string)=>void;stop:(session:string)=>void;status:()=>Promise<HealthStatus>;authorize:(choices:Choices)=>Promise<void>;applyBatch:(session:string,scope:string,json:string)=>Promise<void>;read:(session:string,scope:string,choices:Choices,from:string,to:string)=>Promise<HealthSample[]>};
export const healthEnabled=Platform.OS==='ios'&&process.env.EXPO_PUBLIC_HEALTH_ENABLED==='1';
export function createHealthPort(native:Bridge|null,enabled:boolean):HealthPort{
 const require=()=>{if(!enabled||!native)throw Error('Apple Health is unavailable in this build.');return native;};
 return {status:async()=>enabled&&native?native.status():{available:false,read:'unknown',write:{}},authorize:async choices=>require().authorize(choices),bind:(session,scope)=>require().bind(session,scope),stop:session=>native?.stop(session),applyBatch:async(session,scope,items)=>require().applyBatch(session,scope,JSON.stringify(items)),read:async(session,scope,choices,from,to)=>require().read(session,scope,choices,from,to)};
}
export const healthPort=createHealthPort(Platform.OS==='ios'?requireOptionalNativeModule<Bridge>('BiteflowHealth'):null,healthEnabled);
