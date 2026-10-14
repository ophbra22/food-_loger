import {ApiError} from '@/api/errors';
import type {NutritionReference} from '@/api/meal-analysis-types';
import {validReference} from '@/storage/validation';
import {manualDraft,type Draft,type DraftSeed} from './drafts';
import {newReviewFood} from './meal-analysis';
import {emptyNutritionInputs} from './validation';

type TextFood={id:string;name:string;amount:string;quantity:number|null;unit:string|null;reference:NutritionReference|null;references:NutritionReference[];question:string;confirmed:false;warnings:string[]};
export type TextResult={schema_version:2;foods:TextFood[];ai_status:'not_needed'|'disabled'|'used'|'unavailable'|'quota';warnings:string[]};
export type TextRequest={text:string;language:'en'|'he';local_date:string;meal_category:Draft['mealType'];input_method:'text'|'voice';allow_ai:boolean};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=240):v is string=>typeof v==='string'&&v.length<=max;
const strings=(v:unknown)=>Array.isArray(v)&&v.length<=30&&v.every(s=>text(s));
export function validateTextResult(v:unknown):TextResult {
 if(!record(v)||v.schema_version!==2||!['not_needed','disabled','used','unavailable','quota'].includes(String(v.ai_status))||!strings(v.warnings)||!Array.isArray(v.foods)||v.foods.length<1||v.foods.length>15||!v.foods.every(f=>record(f)&&text(f.id,64)&&!!f.id&&text(f.name,120)&&!!f.name.trim()&&text(f.amount,32)&&(f.amount===''||(/^\d+(?:\.\d+)?$/.test(f.amount)&&Number(f.amount)>=0.0001&&Number(f.amount)<=2000))&&(f.quantity===null||(typeof f.quantity==='number'&&Number.isFinite(f.quantity)&&f.quantity>0&&f.quantity<=100000))&&(f.unit===null||text(f.unit,40))&&f.confirmed===false&&text(f.question,500)&&strings(f.warnings)&&(f.reference===null||validReference(f.reference))&&Array.isArray(f.references)&&f.references.length<=5&&f.references.every(validReference)))throw new ApiError('server');
 const result=v as unknown as TextResult;
 if(new Set(result.foods.map(f=>f.id)).size!==result.foods.length)throw new ApiError('server');
 return result;
}
export function textDraft(result:TextResult,key:string,mode:'text'|'voice',inputText:string,seed:DraftSeed={}):Draft {
 return {...manualDraft(key,seed),origin:mode,inputText,analysis:{version:2,analysisId:key,mealName:inputText.slice(0,120),provider:'text-parser',model:'',warnings:[...result.warnings,...(['disabled','unavailable','quota'].includes(result.ai_status)?['text_ai_'+result.ai_status]:[])],foods:result.foods.map(f=>({...newReviewFood(f.id),name:f.name,amount:f.amount,reference:f.reference,references:f.references,question:f.question,basis:'g',source:f.reference?.source??'user_text',manual:f.reference?null:emptyNutritionInputs(),manualOverride:false,originalWarnings:f.warnings}))}};
}
