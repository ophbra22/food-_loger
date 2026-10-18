import { ApiError } from '@/api/errors';
import type { DaySummary } from '@/api/types';
import { fraction, multiply } from './exact';
const difference=(a:number,b:number)=>{const [an,ad]=fraction(a),[bn,bd]=fraction(b);return Number(an*bd-bn*ad)/Number(ad*bd);};

export const GOAL_LIMITS = {
  calorie_target: 10000, protein_g: 500, carbs_g: 1500, fat_g: 500,
  water_ml: 15000, target_weight_kg: 500, calorie_min_percent: 100, calorie_max_percent: 150,
} as const;
export const GOAL_MINIMUMS={calorie_target:1,protein_g:0.1,carbs_g:0.1,fat_g:0.1,water_ml:1,target_weight_kg:1,calorie_min_percent:50,calorie_max_percent:100} as const;
export type GoalKey = keyof typeof GOAL_LIMITS;
export type GoalValues = Record<GoalKey, number | null> & {calorie_min_percent:number;calorie_max_percent:number};
export type GoalRevision = GoalValues & {id:string;version:number;effective_local_date:string;created_at:string;warnings:string[]};
export type GoalDocument = {version:number;revisions:GoalRevision[]};
export type GoalUpdate = GoalValues & {effective_local_date:string;timezone_id:string;expected_version:number;allow_past:boolean};
export type ProgressStatus = 'no_goal'|'untracked'|'unlogged'|'partial'|'below_range'|'above_range'|'in_range'|'met'|'below_target'|'above_target'|'at_target';
export type GoalMetric = {consumed:number|null;known_total:number|null;target:number|null;remaining:number|null;percent:number|null;status:ProgressStatus};
export type GoalProgress = Record<'calories'|'protein'|'carbs'|'fat'|'water',GoalMetric>;
const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
export const validGoalDate=(v:unknown):v is string=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
function validValues(v:Record<string,unknown>) {
 return (Object.keys(GOAL_LIMITS) as GoalKey[]).every(k=> {
  const n=v[k]; const minimum=GOAL_MINIMUMS[k];
  return (n===null && !k.startsWith('calorie_m')) || (typeof n==='number' && Number.isFinite(n) && (minimum ? n>=minimum : n>0) && n<=GOAL_LIMITS[k]);
 });
}
export function validateGoalDocument(v:unknown):GoalDocument {
 if(!record(v) || !Number.isSafeInteger(v.version) || (v.version as number)<0 || !Array.isArray(v.revisions)
  || v.revisions.length!==v.version || !v.revisions.every((r,i)=>record(r) && r.version===i+1 && typeof r.id==='string' && /^[a-f0-9]{32}$/.test(r.id)
   && validGoalDate(r.effective_local_date) && typeof r.created_at==='string' && Number.isFinite(Date.parse(r.created_at))
   && Array.isArray(r.warnings) && r.warnings.every(w=>w==='energy_macro_mismatch') && validValues(r))) throw new ApiError('server');
 return v as GoalDocument;
}
export function parseGoalForm(form:Record<string,string>):GoalValues|null {
 const value:Record<string,unknown>={};
 for(const k of Object.keys(GOAL_LIMITS)) {
  const input=(form[k]??'').trim().replace(',','.');
  if(input==='')value[k]=null;
  else if(/^\d+(?:\.\d+)?$/.test(input))value[k]=Number(input);
  else return null;
 }
 return validValues(value)?value as GoalValues:null;
}
export function effectiveGoal(doc:GoalDocument|null,day:string):GoalRevision|null {
 let effective:GoalRevision|null=null;
 for(const revision of doc?.revisions??[]) if(revision.effective_local_date<=day && (!effective || revision.effective_local_date>=effective.effective_local_date)) effective=revision;
 return effective;
}
export function goalWarnings(goal:GoalValues):string[] {
 const {calorie_target:k,protein_g:p,carbs_g:c,fat_g:f}=goal;
 if(k===null||p===null||c===null||f===null)return [];
 // Compare decimal rationals before any conversion to Number: exactly 10% is allowed.
 const parts=[k,p,c,f].map(fraction),denominator=parts.reduce((d,[,next])=>next>d?next:d,1n);
 const [target,protein,carbs,fat]=parts.map(([n,d])=>n*(denominator/d));
 const difference=protein*4n+carbs*4n+fat*9n-target;
 return (difference<0n?-difference:difference)*10n>target?['energy_macro_mismatch']:[];
}
export function goalProgress(summary:DaySummary,goal:GoalValues|null):GoalProgress {
 const targets={calories:'calorie_target',protein:'protein_g',carbs:'carbs_g',fat:'fat_g',water:'water_ml'} as const;
 return Object.fromEntries((Object.keys(targets) as (keyof GoalProgress)[]).map(key=>{
  const target=goal?.[targets[key]]??null,consumed=key==='water'?null:summary[key];
  const known_total=key==='water'?null:summary.known_totals?.[key]??consumed;
  const percent=consumed===null || target===null?null:multiply(consumed,100,target);
  const remaining=consumed===null || target===null?null:difference(target,consumed);
  let status:ProgressStatus;
  if(target===null)status='no_goal';
  else if(key==='water')status='untracked';
  else if(!summary.count)status='unlogged';
  else if(consumed===null)status='partial';
  else if(key==='calories')status=percent!<goal!.calorie_min_percent?'below_range':percent!>goal!.calorie_max_percent?'above_range':'in_range';
  else if(key==='protein')status=percent!>=100?'met':'below_target';
  else status=percent!>100?'above_target':percent===100?'at_target':'below_target';
  return [key,{consumed,known_total,target,remaining,percent,status}];
 })) as GoalProgress;
}
