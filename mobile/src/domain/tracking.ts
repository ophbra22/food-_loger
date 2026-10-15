import {ApiError} from '@/api/errors';
import {object} from './library';
import {isIsoDay} from './dates';
import {multiply} from './exact';
export type TrackingKind='water'|'weight';
export type DisplayUnit='kg'|'lb'|'ml'|'fl oz';
export type MeasurementBody={value:number;occurred_at:string;local_date:string;timezone_id:string;source?:'manual'|'apple_health'|'health_connect';external_id?:string|null};
export type Measurement=MeasurementBody & {id:string;kind:TrackingKind;source:'manual'|'apple_health'|'health_connect';external_id:string|null;version:number;created_at:string;updated_at:string};
export type TrackingPage={from:string;to:string;items:Measurement[];has_more:boolean;total:number|null;latest:Measurement|null;previous:Measurement|null;delta:number|null};
const factor=(unit:DisplayUnit)=>unit==='lb'?0.45359237:unit==='fl oz'?29.5735295625:1;
export const displayValue=(value:number,unit:DisplayUnit)=>multiply(value,1,factor(unit));
export function normalizeValue(value:number,unit:DisplayUnit){
 const result=multiply(value,factor(unit));
 if(!Number.isFinite(result)||result<(unit==='kg'||unit==='lb'?1:0.1)||result>(unit==='kg'||unit==='lb'?500:15000))throw new ApiError('validation');
 return result;
}
/** Explicit offsets disambiguate repeated local times; verify against the IANA zone. */
export function measurementContext(stamp:string,zone:string){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)||!isIsoDay(stamp.slice(0,10)))throw new ApiError('validation');
 const date=new Date(stamp);if(!Number.isFinite(date.getTime()))throw new ApiError('validation');
 let parts: Intl.DateTimeFormatPart[];
 try{parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);}catch{throw new ApiError('validation');}
 const get=(key:string)=>parts.find(p=>p.type===key)?.value;
 const wall=`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
 if(stamp.slice(0,19)!==wall)throw new ApiError('validation');
 return {occurred_at:stamp,timezone_id:zone,local_date:stamp.slice(0,10)};
}
export function localStamp(now=new Date()) {
 const offset=-now.getTimezoneOffset(),sign=offset>=0?'+':'-',pad=(v:number)=>String(v).padStart(2,'0');
 return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${pad(Math.floor(Math.abs(offset)/60))}:${pad(Math.abs(offset)%60)}`;
}
export function validateMeasurement(value:unknown,kind:TrackingKind):Measurement {
 if(!object(value)||value.kind!==kind||typeof value.id!=='string'||!/^[a-f0-9]{32}$/.test(value.id)||!Number.isSafeInteger(value.version)||Number(value.version)<1||typeof value.value!=='number'||!Number.isFinite(value.value)||value.value<(kind==='weight'?1:0.1)||value.value>(kind==='weight'?500:15000)||!isIsoDay(value.local_date)||typeof value.timezone_id!=='string'||typeof value.occurred_at!=='string'||!Number.isFinite(Date.parse(value.occurred_at))||!['manual','apple_health','health_connect'].includes(String(value.source))||!(value.external_id===null||typeof value.external_id==='string')||typeof value.created_at!=='string'||typeof value.updated_at!=='string')throw new ApiError('server');
 try{const day=new Intl.DateTimeFormat('en-CA',{timeZone:value.timezone_id,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value.occurred_at));if(day!==value.local_date)throw new Error();}catch{throw new ApiError('server');}
 return value as Measurement;
}
export function validateTrackingPage(value:unknown,kind:TrackingKind,from:string,to:string):TrackingPage {
 if(!object(value)||value.from!==from||value.to!==to||!Array.isArray(value.items)||value.items.length>100||typeof value.has_more!=='boolean'||!(value.total===null||typeof value.total==='number'&&Number.isFinite(value.total)&&value.total>=0)||!(value.delta===null||typeof value.delta==='number'&&Number.isFinite(value.delta)))throw new ApiError('server');
 const items=value.items.map(v=>validateMeasurement(v,kind));
 if(items.some(i=>i.local_date<from||i.local_date>to)||new Set(items.map(i=>i.id)).size!==items.length||(kind==='water'&&value.total===null))throw new ApiError('server');
 return {...value,items,latest:value.latest===null?null:validateMeasurement(value.latest,kind),previous:value.previous===null?null:validateMeasurement(value.previous,kind)} as TrackingPage;
}
export function stampInZone(stamp:string,zone:string){
 const instant=new Date(stamp),parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;
 const wall=`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
 const minutes=Math.round((Date.parse(wall+'Z')-Math.floor(instant.getTime()/1000)*1000)/60000),pad=(n:number)=>String(n).padStart(2,'0');
 return `${wall}${minutes>=0?'+':'-'}${pad(Math.floor(Math.abs(minutes)/60))}:${pad(Math.abs(minutes)%60)}`;
}
