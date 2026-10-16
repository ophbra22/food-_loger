import type {DayState} from '@/data/journal-store';
import type {GoalsState} from '@/data/goals-store';
import type {TrackingState} from '@/data/tracking-store';
import {effectiveGoal,goalProgress} from '@/domain/goals';
import {todayIso} from '@/domain/dates';
export const WIDGET_TTL=15*60*1000;
export type WidgetSnapshot={version:1;date:string;timezone:string;updated_at:number;expires_at:number;language:'en'|'he';state:'ready'|'unavailable';calories:number|null;calorie_known:number|null;calorie_target:number|null;calorie_remaining:number|null;calorie_status:string;protein:number|null;protein_known:number|null;protein_target:number|null;protein_status:string;water:number|null;water_target:number|null;partial:boolean;logged:boolean};
const numbers=['calories','calorie_known','calorie_target','calorie_remaining','protein','protein_known','protein_target','water','water_target'] as const;
export const WIDGET_KEYS=['version','date','timezone','updated_at','expires_at','language','state',...numbers,'calorie_status','protein_status','partial','logged'];
const statuses=['unknown','no_goal','unlogged','partial','below_range','above_range','in_range','met','below_target'];
export function validateSnapshot(value:unknown,now=Date.now()):WidgetSnapshot{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid widget snapshot');
 const v=value as WidgetSnapshot;
 if(Object.keys(v).length!==WIDGET_KEYS.length||Object.keys(v).some(k=>!WIDGET_KEYS.includes(k))||v.version!==1||!['en','he'].includes(v.language)||!['ready','unavailable'].includes(v.state)||typeof v.partial!=='boolean'||typeof v.logged!=='boolean'||!statuses.includes(v.calorie_status)||!statuses.includes(v.protein_status))throw Error('Invalid widget schema');
 if(!Number.isSafeInteger(v.updated_at)||!Number.isSafeInteger(v.expires_at)||v.updated_at>now+1000||v.expires_at<=now||v.expires_at<=v.updated_at||v.expires_at>v.updated_at+WIDGET_TTL)throw Error('Expired widget snapshot');
 if(typeof v.timezone!=='string'||v.timezone.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(v.date))throw Error('Invalid widget date');
 const date=(t:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:v.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
 if(date(now)!==v.date||date(v.updated_at)!==v.date)throw Error('Widget day changed');
 for(const k of numbers){const n=v[k];if(n!==null&&(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>100000000||(k!=='calorie_remaining'&&n<0)))throw Error('Invalid widget quantity');if(v.state==='unavailable'&&n!==null)throw Error('Unavailable widget contains data');}
 if(v.state==='ready'&&(v.calorie_known===null||v.protein_known===null))throw Error('Missing known totals');
 if((v.calories===null||v.calorie_target===null)&&v.calorie_remaining!==null)throw Error('Unknown remaining calories');
 return v;
}
export function buildSnapshot({day,goals,water,language,now=Date.now()}:{day:DayState;goals:GoalsState;water:TrackingState;language:'en'|'he';now?:number}):WidgetSnapshot{
 const date=todayIso(new Date(now)),end=new Date(now);end.setHours(24,0,0,0);
 const base:WidgetSnapshot={version:1,date,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,updated_at:now,expires_at:Math.min(now+WIDGET_TTL,end.getTime()),language,state:'unavailable',calories:null,calorie_known:null,calorie_target:null,calorie_remaining:null,calorie_status:'unknown',protein:null,protein_known:null,protein_target:null,protein_status:'unknown',water:null,water_target:null,partial:false,logged:false};
 if(!day.data||day.data.day!==date||!day.fresh||day.loading||day.error||day.savedAt===null||day.savedAt>now+1000||day.savedAt+WIDGET_TTL<=now)return base;
 const knownGoals=goals.fresh&&!goals.saving&&!goals.loading&&!goals.error;
 const effective=knownGoals?effectiveGoal(goals.data,date):null;
 const summary=day.data.summary,progress=goalProgress(summary,effective);
 const knownWater=water.fresh&&!water.loading&&!water.saving&&!water.pending&&!water.error&&water.savedAt!=null&&water.savedAt<=now+1000&&water.savedAt+WIDGET_TTL>now;
 const updated=Math.min(day.savedAt,knownGoals&&goals.savedAt!==null?goals.savedAt:day.savedAt,knownWater?water.savedAt!:day.savedAt);
 if(updated+WIDGET_TTL<=now)return base;
 const value:WidgetSnapshot={...base,state:'ready',updated_at:updated,expires_at:Math.min(updated+WIDGET_TTL,end.getTime()),calories:progress.calories.consumed,calorie_known:progress.calories.known_total,calorie_target:progress.calories.target,calorie_remaining:progress.calories.remaining,calorie_status:knownGoals?progress.calories.status:'unknown',protein:progress.protein.consumed,protein_known:progress.protein.known_total,protein_target:progress.protein.target,protein_status:knownGoals?progress.protein.status:'unknown',water:knownWater?water.data?.total??null:null,water_target:effective?.water_ml??null,partial:summary.calories===null||summary.protein===null,logged:summary.count>0};
 return validateSnapshot(value,now);
}
