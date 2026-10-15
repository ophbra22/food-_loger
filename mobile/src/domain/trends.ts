import {ApiError} from '@/api/errors';
import {object} from './library';
import {addDays,dayOffset,isIsoDay,parseIsoDay,toIsoDay} from './dates';
export type Metric='calories'|'protein'|'carbs'|'fat'|'water'|'weight';
export const METRICS:Metric[]=['calories','protein','carbs','fat','water','weight'];
export type TrendDay=Record<Metric,number|null>&{date:string;logged:boolean;logging_status:string;known_totals:Record<string,number|null>;partial:Record<string,boolean>;targets:Record<string,number|null>|null;calorie_status:string;nutrition_status:string;nutrition_sources:string[];estimated:boolean;weight_source:string|null;water_sources:string[]};
export type TrendStats={logged_days:number;unlogged_days:number;measured_days:number;water_logged_days:number;average:Record<Metric,number|null>;partial_days:Record<string,number>;calorie_in_range:number;calorie_eligible_days:number;insufficient_data:boolean;logging_complete:false};
export type TrendPeriod={from:string;to:string;days:TrendDay[];statistics:TrendStats};
export type TrendResponse={current:TrendPeriod;previous:TrendPeriod;comparison:Record<Metric,number|null>;comparison_basis:'preceding_equal_length';schema_version:1};
export function periodDates(anchor:string,mode:'week'|'month') {
 const d=parseIsoDay(anchor);
 if(mode==='week'){const from=addDays(anchor,-d.getDay());return {from,to:addDays(from,6)};}
 return {from:toIsoDay(new Date(d.getFullYear(),d.getMonth(),1,12)),to:toIsoDay(new Date(d.getFullYear(),d.getMonth()+1,0,12))};
}
const nullable=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const NUTRIENTS=['calories','protein','carbs','fat'];
const TARGETS=['calorie_target','protein_g','carbs_g','fat_g','water_ml','target_weight_kg'];
const SOURCES=['manual','apple_health','health_connect'];
const NUTRITION_SOURCES=['verified','user_confirmed','estimated','legacy_unknown'];
const stringsIn=(v:unknown,allowed:string[])=>Array.isArray(v)&&v.every(x=>typeof x==='string'&&allowed.includes(x));
const fields=(v:unknown,keys:string[],valid:(value:unknown)=>boolean)=>object(v)&&keys.every(k=>valid(v[k]));
function validDay(d:unknown,date:string){
 if(!object(d)||d.date!==date||typeof d.logged!=='boolean'||!METRICS.every(k=>nullable(d[k])))return false;
 return d.logging_status===(d.logged?'logged_incomplete':'unlogged')&&
  fields(d.known_totals,NUTRIENTS,nullable)&&fields(d.partial,NUTRIENTS,v=>typeof v==='boolean')&&
  (d.targets===null||fields(d.targets,TARGETS,nullable))&&
  typeof d.calorie_status==='string'&&['no_goal','untracked','unlogged','partial','below_range','above_range','in_range'].includes(d.calorie_status)&&
  d.nutrition_status===(d.logged?'recorded_snapshot':'missing')&&stringsIn(d.nutrition_sources,NUTRITION_SOURCES)&&
  typeof d.estimated==='boolean'&&stringsIn(d.water_sources,SOURCES)&&
  (d.weight_source===null||typeof d.weight_source==='string'&&SOURCES.includes(d.weight_source))&&
  (d.logged||NUTRIENTS.every(k=>d[k]===null));
}
function validPeriod(v:unknown):v is TrendPeriod {
 if(!object(v)||!isIsoDay(v.from)||!isIsoDay(v.to)||!Array.isArray(v.days)||v.days.length!==dayOffset(v.to,v.from)+1||v.days.length<1||v.days.length>31||!object(v.statistics))return false;
 const start=v.from,s=v.statistics,count=v.days.length;
 return v.days.every((d,i)=>validDay(d,addDays(start,i)))&&
 ['logged_days','unlogged_days','measured_days','water_logged_days','calorie_in_range','calorie_eligible_days'].every(k=>integer(s[k])&&Number(s[k])<=count)&&
 Number(s.logged_days)+Number(s.unlogged_days)===count&&Number(s.calorie_in_range)<=Number(s.calorie_eligible_days)&&Number(s.calorie_eligible_days)<=Number(s.logged_days)&&
 fields(s.average,METRICS,nullable)&&typeof s.insufficient_data==='boolean'&&
 fields(s.partial_days,NUTRIENTS,n=>integer(n)&&Number(n)<=Number(s.logged_days))&&s.logging_complete===false;
}
export function validateTrends(v:unknown,from:string,to:string):TrendResponse {
 if(!object(v)||v.schema_version!==1||v.comparison_basis!=='preceding_equal_length'||!validPeriod(v.current)||!validPeriod(v.previous)||v.current.from!==from||v.current.to!==to||v.previous.to!==addDays(from,-1)||v.previous.days.length!==v.current.days.length||!object(v.comparison)||!METRICS.every(k=>v.comparison && ((v.comparison as Record<string,unknown>)[k]===null||typeof (v.comparison as Record<string,unknown>)[k]==='number'&&Number.isFinite((v.comparison as Record<string,unknown>)[k]))))throw new ApiError('server');
 return v as TrendResponse;
}
