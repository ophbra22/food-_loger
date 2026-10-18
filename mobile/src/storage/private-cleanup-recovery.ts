import AsyncStorage from '@react-native-async-storage/async-storage';
import {ApiError} from '@/api/errors';
import {clearPrivateFiles} from './private-files';

// No owner, token, filenames or content. This marker is diagnostic, never authority to skip a sweep.
const MARKER='foodlogger:private-cleanup-pending';
let recovery:Promise<void>|null=null,ready=false,failed=false;
const listeners=new Set<(failed:boolean)=>void>();
function failure(value:boolean){failed=value;listeners.forEach(listener=>listener(value));}
export function privateCleanupFailed(){return failed;}
export function subscribePrivateCleanup(listener:(failed:boolean)=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
export function recoverPrivateFiles():Promise<void>{
 if(recovery)return recovery;
 ready=false;
 recovery=(async()=>{
  let markerFailure=false;
  try{await AsyncStorage.setItem(MARKER,'1');}catch{markerFailure=true;}
  // Always sweep, including absent/corrupt marker and death before marker persistence.
  try{
   clearPrivateFiles();
   await AsyncStorage.removeItem(MARKER);
   if(markerFailure)throw new ApiError('storage');
   ready=true;failure(false);
  }catch{failure(true);throw new ApiError('storage');}
 })().finally(()=>{recovery=null;});
 return recovery;
}
export async function preparePrivateExport(){
 if(!ready||recovery)await (recovery??recoverPrivateFiles());
 try{await AsyncStorage.setItem(MARKER,'1');}
 catch{ready=false;failure(true);throw new ApiError('storage');}
}
export function reportPrivateCleanupFailure(){ready=false;failure(true);}
