/** Explicit, user-initiated exports. No credentials or ambient cross-account reads. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {ApiError} from '@/api/errors';
import {capturePrivateExport} from './export-session';
import {accountPrefix,captureAccountStorage} from './kv';

const portable=(name:string)=>['draft','draft:v2','tracking-pending','widget-enabled'].includes(name)||name.startsWith('recipe-draft:v1:');
// Compiled stop switch: retain cleanup/session guards and legacy CSV in rollback builds.
export function accountExportDisabled(){return process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED==='1';}
export async function buildAccountArchive(owner:string,load:()=>Promise<unknown>):Promise<string>{
 if(accountExportDisabled())throw new ApiError('server');
 const check=captureAccountStorage(owner);check();
 const server=await load();check();
 if(!server||typeof server!=='object'||!('schema_version' in server)||server.schema_version!==1||!('account' in server)||!server.account||typeof server.account!=='object'||!('id' in server.account)||server.account.id!==owner||!('data' in server)||!server.data||typeof server.data!=='object')throw new ApiError('server');
 const prefix=accountPrefix(owner),keys=(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith(prefix)&&portable(k.slice(prefix.length)));check();
 const entries=await AsyncStorage.multiGet(keys);check();
 const records=Object.fromEntries(entries.filter(([,v])=>v!==null).map(([k,v])=>[k.slice(prefix.length),v]));
 // Preserve malformed/older draft text as text; an export is not an import or migration.
 const result=JSON.stringify({schema_version:1,server,device:{captured_at:new Date().toISOString(),records,exclusions:[
  'Server and device are independent snapshots; in-flight edits and other devices are not captured.',
  'Derived day/goal/trend/library caches duplicate server records and are omitted.',
  'Authentication, notification installation secrets, native sync cursors/receipts and OS Health libraries are not portable exports.',
  'Temporary images/audio and unsaved in-memory form input are not included.',
 ]}});
 if(result.length>12*1024*1024)throw new ApiError('storage');
 return result;
}

export async function sharePrivateExport({name,mime,load,check:checkOwner}:{name:string;mime:string;load:()=>Promise<string>;check:()=>void}):Promise<void>{
 const session=capturePrivateExport(),check=()=>{session();checkOwner();};
 check();
 if(!(await Sharing.isAvailableAsync()))throw new Error('Sharing unavailable');
 check();const text=await load();check();
 const file=new File(Paths.cache,name);
 try{
  if(file.exists)file.delete();
  file.create();file.write(text);check();
  // Once the OS share sheet opens, copied files belong to the chosen recipient app.
  await Sharing.shareAsync(file.uri,{mimeType:mime});
 }finally{if(file.exists)file.delete();}
}
