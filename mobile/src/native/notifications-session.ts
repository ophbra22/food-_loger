import type {NotificationInstallation} from './notification-installation';
import type {Api} from '@/api/endpoints';
import {REMINDERS} from '@/domain/habits';
export type NotificationStatus='ready'|'denied'|'paused'|'unavailable';
export type NotificationPort={installation:()=>Promise<NotificationInstallation>;permission:(ask:boolean)=>Promise<boolean>;token:()=>Promise<string>;clear:()=>Promise<void>;platform:'ios'|'android'};
/** Serialized refreshes plus generation/session guards; never keeps health content or tokens on disk. */
export class NotificationSession{
 private closed=false;private serial=0;private queue:Promise<unknown>=Promise.resolve();
 constructor(private api:Pick<Api,'captureSession'|'capabilities'|'habits'|'registerReminderDevice'|'removeReminderDevice'|'pauseReminderDevice'>,private port:NotificationPort,private settled:()=>Promise<boolean>,private zone:()=>string){}
 close(){this.closed=true;this.serial++;void this.port.clear().catch(()=>{});}
 sync(ask=false):Promise<NotificationStatus>{
  const serial=++this.serial;
  const run=async():Promise<NotificationStatus>=>{
   const assertSession=this.api.captureSession();
   const check=()=>{assertSession();if(this.closed||serial!==this.serial)throw new Error('Stale notification session');};
   try{
    check();await this.port.clear();check();
    const caps=await this.api.capabilities();check();
    if(!caps.habits){await this.api.removeReminderDevice();return 'unavailable';}
    const data=await this.api.habits(this.zone());check();
    const p=data.preferences;
    if(p.muted||!REMINDERS.some(k=>p[k])||p.timezone_id!==this.zone()||!await this.settled()){
     check();await this.api.pauseReminderDevice();return 'paused';
    }
    check();const allowed=await this.port.permission(ask);check();
    if(!allowed){await this.api.removeReminderDevice();return 'denied';}
    const installation=await this.port.installation();check();
    const token=await this.port.token();check();
    // Recheck pending drafts/writes after permission/token awaits.
    const ready=await this.settled();check();
    if(!ready){await this.api.pauseReminderDevice();return 'paused';}
    await this.api.registerReminderDevice(token,this.port.platform,true,installation);check();return 'ready';
   }catch{try{check();await this.api.pauseReminderDevice();}catch{/* lease expires if unreachable */}return 'unavailable';}
  };
  const next=this.queue.then(run,run);this.queue=next;return next;
 }
}
