import {object} from '@/domain/library';
import {isIsoDay} from '@/domain/dates';
export const UNITS={calories:'kcal',protein:'g',carbs:'g',fat:'g',water:'ml'} as const;
export type HealthKind=keyof typeof UNITS;
export type Choices={nutrition:boolean;water:boolean;weight:boolean;steps:boolean};
export type HealthRecord={id:string;record_key:string;revision:number;kind:HealthKind;unit:string;value:number|null;start:string;end:string;local_date:string;timezone_id:string;provenance:'user_confirmed_unverified'|'user_entered';deleted:boolean};
export type HealthSnapshot={scope:string;items:HealthRecord[];withheld:number};
export type HealthSample={external_id:string;kind:'weight'|'steps';value:number;start:string;end:string;source_bundle:string;timezone_id:string};
export type HealthStatus={available:boolean;read:'unknown';availability?:'available'|'install_required'|'unavailable';readGranted?:Record<ReadKind,boolean>;write:Partial<Record<HealthKind,'authorized'|'denied'|'notDetermined'>>};
export type HealthPort={manage?:()=>Promise<void>;readPage?:(session:string,scope:string,kind:ReadKind,cursor:string|null,from:string,to:string)=>Promise<ImportPage>;bind:(session:string,scope:string)=>void;stop:(session:string)=>void;status:()=>Promise<HealthStatus>;authorize:(choices:Choices)=>Promise<void>;applyBatch:(session:string,scope:string,items:HealthRecord[])=>Promise<void|{applied:string[];failed:string[]}>;read:(session:string,scope:string,choices:Choices,from:string,to:string)=>Promise<HealthSample[]>};
export const emptyChoices=():Choices=>({nutrition:false,water:false,weight:false,steps:false});
export function validateChoices(v:unknown):Choices{if(!object(v)||Object.keys(v).length!==4||!Object.keys(emptyChoices()).every(k=>typeof v[k]==='boolean'))throw Error('Invalid Health choices');return v as Choices;}
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
export function validateSnapshot(v:unknown):HealthSnapshot{
 if(!object(v)||!hex(v.scope)||!Array.isArray(v.items)||v.items.length>10000||!Number.isSafeInteger(v.withheld)||Number(v.withheld)<0)throw Error('Invalid Health snapshot');
 const ids=new Set<string>();
 for(const r of v.items){
  if(!object(r)||!hex(r.id)||ids.has(r.id as string)||!Number.isSafeInteger(r.revision)||Number(r.revision)<1||typeof r.record_key!=='string'||!/^((meal:[a-f0-9]{32}:(calories|protein|carbs|fat))|(water:[a-f0-9]{32}))$/.test(r.record_key)||!(String(r.kind) in UNITS)||r.unit!==UNITS[r.kind as HealthKind]||typeof r.deleted!=='boolean'||(r.deleted?r.value!==null:typeof r.value!=='number'||!Number.isFinite(r.value)||r.value<0)||typeof r.start!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(r.start)||!Number.isFinite(Date.parse(r.start))||r.end!==r.start||!isIsoDay(r.local_date)||typeof r.timezone_id!=='string'||!['user_confirmed_unverified','user_entered'].includes(String(r.provenance)))throw Error('Invalid Health record');
  if(new Intl.DateTimeFormat('en-CA',{timeZone:r.timezone_id,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.start))!==r.local_date)throw Error('Invalid Health date');
  ids.add(r.id as string);
 }
 return v as HealthSnapshot;
}

export function validateImportResult(v:unknown):{accepted:number;weight_dates:string[]}{
 if(!object(v)||!Number.isSafeInteger(v.accepted)||Number(v.accepted)<0||!Array.isArray(v.weight_dates)||v.weight_dates.length>200||!v.weight_dates.every(d=>typeof d==='string'&&isIsoDay(d)))throw Error('Invalid Health import result');
 return v as {accepted:number;weight_dates:string[]};
}

export type ReadKind='weight'|'steps';
export type ConnectEvent=({operation:'upsert';modified_at:string;start_offset_seconds:number|null;end_offset_seconds:number|null}&HealthSample)|{operation:'delete';external_id:string};
export type ImportPage={events:ConnectEvent[];nextCursor:string;hasMore:boolean;recovered:boolean};
const aware=(s:unknown)=>typeof s==='string'&&/(Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s));
export function validateImportPage(v:unknown,kind:ReadKind):ImportPage{
 if(!object(v)||!Array.isArray(v.events)||v.events.length>1000||typeof v.nextCursor!=='string'||!v.nextCursor||v.nextCursor.length>32768||typeof v.hasMore!=='boolean'||typeof v.recovered!=='boolean')throw Error('Invalid Health Connect page');
 for(const e of v.events){
  if(!object(e)||typeof e.external_id!=='string'||!/^[-a-fA-F0-9]{36}$/.test(e.external_id))throw Error('Invalid Health Connect identity');
  if(e.operation==='delete'){if(Object.keys(e).length!==2)throw Error('Invalid Health deletion');continue;}
  if(e.operation!=='upsert'||e.kind!==kind||typeof e.value!=='number'||!Number.isFinite(e.value)||e.value<0||e.value>1000000||!aware(e.start)||!aware(e.end)||Date.parse(e.end as string)<Date.parse(e.start as string)||!aware(e.modified_at)||typeof e.source_bundle!=='string'||!/^[A-Za-z0-9_.-]{1,200}$/.test(e.source_bundle)||e.source_bundle==='io.github.ophbra22.foodlogger'||typeof e.timezone_id!=='string')throw Error('Invalid Health Connect sample');
  if(kind==='weight'?(e.value<1||e.value>500):!Number.isInteger(e.value))throw Error('Invalid Health measurement');
  new Intl.DateTimeFormat('en',{timeZone:e.timezone_id});
  for(const offset of [e.start_offset_seconds,e.end_offset_seconds])if(offset!==null&&(!Number.isInteger(offset)||Math.abs(Number(offset))>64800))throw Error('Invalid source offset');
 }
 return v as ImportPage;
}
