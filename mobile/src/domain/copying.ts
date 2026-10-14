import type {MealDraft} from './canonical';
import {validateTimeContext} from './canonical';
import {object,validateCanonicalDraft,draftFromCanonical} from './library';
import type {Draft} from './drafts';
import {reviewPayload} from './unified-review';
import {ApiError} from '@/api/errors';
export type CopySelection={source_day:string;destination_date:string;timezone_id:string;sources:{id:string;version:number}[];times:Record<string,{wall_time:string;fold?:0|1}>};
export type CopyPreview={preview_token:string;destination_populated:boolean;time_issues:{id:string;reason:'unknown_time'|'nonexistent_time'|'ambiguous_time'}[];drafts:MealDraft[]};
export type CopyState={selection:CopySelection;previewToken:string;destinationPopulated:boolean;confirmPopulated:boolean;meals:Draft[]};
const id=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
export function validCopySelection(v:unknown):v is CopySelection {
 if(!object(v)||!validateTimeContext(String(v.source_day),null,null)||!validateTimeContext(String(v.destination_date),null,null)||typeof v.timezone_id!=='string'||v.timezone_id.length>80||!Array.isArray(v.sources)||v.sources.length<1||v.sources.length>20||!object(v.times))return false;
 try{new Intl.DateTimeFormat('en',{timeZone:v.timezone_id});}catch{return false;}
 if(!v.sources.every(s=>object(s)&&id(s.id)&&Number.isSafeInteger(s.version)&&Number(s.version)>=1)||new Set(v.sources.map(s=>s.id)).size!==v.sources.length)return false;
 const ids=v.sources.map(s=>s.id);return Object.entries(v.times).every(([key,time])=>ids.includes(key)&&object(time)&&typeof time.wall_time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time.wall_time)&&(time.fold===undefined||time.fold===0||time.fold===1));
}
export function validCopyState(v:unknown,validMeal:(v:unknown)=>boolean):v is CopyState {
 return object(v)&&validCopySelection(v.selection)&&typeof v.previewToken==='string'&&/^[a-f0-9]{64}$/.test(v.previewToken)&&typeof v.destinationPopulated==='boolean'&&typeof v.confirmPopulated==='boolean'&&Array.isArray(v.meals)&&v.meals.length===v.selection.sources.length&&v.meals.every(m=>object(m)&&m.copy===undefined&&m.origin==='copy'&&m.day===(v.selection as CopySelection).destination_date&&validMeal(m));
}
export function validateCopyPreview(v:unknown):CopyPreview {
 if(!object(v)||typeof v.preview_token!=='string'||!/^[a-f0-9]{64}$/.test(v.preview_token)||typeof v.destination_populated!=='boolean'||!Array.isArray(v.drafts)||v.drafts.length>20||!Array.isArray(v.time_issues)||v.time_issues.length>20||!v.time_issues.every(i=>object(i)&&id(i.id)&&['unknown_time','nonexistent_time','ambiguous_time'].includes(String(i.reason))))throw new ApiError('server');
 return {...v,drafts:v.drafts.map(validateCanonicalDraft)} as CopyPreview;
}
export function copyDraft(selection:CopySelection,preview:CopyPreview,key:string):Draft {
 if(!validCopySelection(selection)||preview.time_issues.length||preview.drafts.length!==selection.sources.length||preview.drafts.some(d=>d.local_date!==selection.destination_date||d.timezone_id!==selection.timezone_id||!d.occurred_at))throw new ApiError('validation');
 const meals=preview.drafts.map((d,i)=>draftFromCanonical(d,key+'-'+i,'copy'));
 return {...meals[0],key,copy:{selection,previewToken:preview.preview_token,destinationPopulated:preview.destination_populated,confirmPopulated:false,meals}};
}
export function copyPayload(draft:Draft){
 const c=draft.copy;if(!c||!validCopySelection(c.selection)||(c.destinationPopulated&&!c.confirmPopulated)||c.meals.length!==c.selection.sources.length)throw new ApiError('validation');
 return {...c.selection,action:'confirm' as const,confirmed:true,confirm_populated:c.confirmPopulated,preview_token:c.previewToken,drafts:c.meals.map(reviewPayload)};
}
