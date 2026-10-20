/** Installation proof survives account logout; contains no account or health data.
 * A new lifecycle gets a monotonic generation so an old in-flight registration
 * cannot take the token back after an offline account switch.
 */
import * as SecureStore from 'expo-secure-store';
import {randomUUID,digestStringAsync,CryptoDigestAlgorithm} from 'expo-crypto';
import {STAGING_BUILD,DEFAULT_API_URL} from '@/config/env';
export type NotificationInstallation={secret:string;generation:number};
const KEY='foodlogger.notification-installation.v1';
const OPTIONS={keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
let queue:Promise<unknown>=Promise.resolve();
export function nextNotificationInstallation():Promise<NotificationInstallation>{
 const create=async()=>{
  // Retain production generations; each beta backend receives a different proof.
  const key=STAGING_BUILD?`${KEY}.staging.${await digestStringAsync(CryptoDigestAlgorithm.SHA256,DEFAULT_API_URL)}`:KEY;
  const raw=await SecureStore.getItemAsync(key,OPTIONS);
  const old:unknown=raw?JSON.parse(raw):null;
  if(old!==null&&(typeof old!=='object'||!('secret' in old)||!('generation' in old)||typeof old.secret!=='string'||!/^[a-f0-9]{32}$/.test(old.secret)||!Number.isSafeInteger(old.generation)||Number(old.generation)<1))throw new Error('Invalid notification installation');
  const previous=old as NotificationInstallation|null;
  const next={secret:previous?.secret??randomUUID().replaceAll('-',''),generation:(previous?.generation??0)+1};
  if(!Number.isSafeInteger(next.generation))throw new Error('Notification generation exhausted');
  await SecureStore.setItemAsync(key,JSON.stringify(next),OPTIONS);
  return next;
 };
 const result=queue.then(create,create);queue=result;return result;
}
