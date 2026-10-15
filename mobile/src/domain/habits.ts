import {ApiError} from '@/api/errors';
import {object} from './library';
export const REMINDERS=['breakfast','lunch','dinner','water','evening'] as const;
export type Reminder=typeof REMINDERS[number];
export type HabitPreferences={version:number;timezone_id:string;language:'en'|'he';muted:boolean;quiet_start:string|null;quiet_end:string|null}&Record<Reminder,string|null>;
export type Habits={preferences:HabitPreferences;streak:{current:number;longest:number;logged_days:number}};
const clock=(v:unknown)=>v===null||typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validateHabitPreferences(v:unknown):HabitPreferences{
 if(!object(v)||!Number.isSafeInteger(v.version)||Number(v.version)<0||typeof v.timezone_id!=='string'||!['en','he'].includes(String(v.language))||typeof v.muted!=='boolean'||![...REMINDERS,'quiet_start','quiet_end'].every(k=>clock(v[k]))||(v.quiet_start===null)!==(v.quiet_end===null))throw new ApiError('server');
 try{new Intl.DateTimeFormat('en',{timeZone:v.timezone_id});}catch{throw new ApiError('server');}
 return v as HabitPreferences;
}
export function validateHabits(v:unknown):Habits{
 if(!object(v)||!object(v.streak))throw new ApiError('server');
 const streak=v.streak;
 if(!['current','longest','logged_days'].every(k=>Number.isSafeInteger(streak[k])&&Number(streak[k])>=0)||Number(streak.current)>Number(streak.longest)||Number(streak.longest)>Number(streak.logged_days))throw new ApiError('server');
 const preferences=validateHabitPreferences(v.preferences);return {preferences,streak:v.streak as Habits['streak']};
}
