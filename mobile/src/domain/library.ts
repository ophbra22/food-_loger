import {ApiError} from '@/api/errors';
import {NUTRIENT_FIELDS,validateTimeContext,type MealDraft,type CanonicalItem} from './canonical';
import {manualDraft,type Draft,type DraftSeed} from './drafts';
import {multiply} from './exact';
import {newReviewFood} from './meal-analysis';
import {NUTRIENTS,type MealType} from './nutrition';
import {nutritionToInputs} from './validation';
export type LibraryEntry={kind:'meal'|'recipe';id:string;version:number;name:string;servings:number;favorite:boolean;draft:MealDraft};
export type LibraryPage={items:LibraryEntry[];next_offset:number|null};
export const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const text=(v:unknown,max=240)=>typeof v==='string'&&v.length<=max;
const texts=(v:unknown)=>Array.isArray(v)&&v.length<=30&&v.every(x=>text(x));
export function validPortion(v:unknown):v is CanonicalItem['portion'] {
 if(!object(v)||!number(v.quantity,Number.MIN_VALUE,100000)||!text(v.unit,40)||!v.unit||typeof v.estimated!=='boolean'||!(v.food_specific_conversion_id==null||text(v.food_specific_conversion_id,160)))return false;
 return (number(v.normalized_g,0.0001,2000)&&v.normalized_ml==null)||(number(v.normalized_ml,0.0001,2000)&&v.normalized_g==null);
}
export function validSource(v:unknown):v is CanonicalItem['source'] {
 return object(v)&&text(v.provider,80)&&!!v.provider&&['verified','user_confirmed','estimated','legacy_unknown'].includes(String(v.verified_status))&&
 ['reference_id','version','name_he','name_en','brand','barcode'].every(k=>v[k]==null||text(v[k],k==='brand'?300:160));
}
export function validBasisCorrection(v:unknown):v is NonNullable<CanonicalItem['basis_correction']> {
 if(!object(v)||!object(v.original_nutrition_per_100)||!validSource(v.original_source))return false;
 const n=v.original_nutrition_per_100;
 return ['g','ml'].includes(String(n.basis))&&NUTRIENT_FIELDS.every(k=>n[k]==null||number(n[k],0,k==='energy_kcal'?1000:k==='sodium_mg'?100000:100));
}
export function validateCanonicalDraft(v:unknown):MealDraft {
 const fail=()=>{throw new ApiError('server');};
 if(!object(v)||v.schema_version!=='2'||v.calculation_version!=='exact-v1'||v.status!=='draft'||!text(v.input_method,40)||!text(v.local_date,10)||
 !validateTimeContext(String(v.local_date),v.occurred_at as string|null,v.timezone_id as string|null)||!['breakfast','lunch','dinner','snack'].includes(String(v.meal_category))||!texts(v.warnings)||!Array.isArray(v.items)||v.items.length<1||v.items.length>15) return fail();
 const ids=new Set<string>();
 for(const item of v.items) {
  if(!object(item)||!text(item.id,64)||!item.id||ids.has(item.id as string)||!text(item.display_name,120)||!(item.display_name as string).trim()||!object(item.portion)||!object(item.nutrition_per_100)||!validSource(item.source)||!texts(item.warnings)||typeof item.manual_override!=='boolean')return fail();
  if(item.basis_correction!=null&&(!validBasisCorrection(item.basis_correction)||item.manual_override!==true))return fail();
  ids.add(item.id as string);const p=item.portion,n=item.nutrition_per_100;
  if(!['g','ml'].includes(String(n.basis))||!validPortion(p)||!text(p.unit,40)||!number(p[n.basis==='g'?'normalized_g':'normalized_ml'],0.0001,2000)||p[n.basis==='g'?'normalized_ml':'normalized_g']!=null||typeof p.estimated!=='boolean')return fail();
  if(!NUTRIENT_FIELDS.every(k=>n[k]==null||number(n[k],0,k==='energy_kcal'?1000:k==='sodium_mg'?100000:100)))return fail();
  if(item.confidence!=null&&!['high','medium','low'].includes(String(item.confidence)))return fail();
 }
 return v as unknown as MealDraft;
}
export function validateLibraryEntry(v:unknown):LibraryEntry {
 if(!object(v)||!['meal','recipe'].includes(String(v.kind))||typeof v.id!=='string'||!/^[a-f0-9]{32}$/.test(v.id)||!Number.isSafeInteger(v.version)||Number(v.version)<1||!text(v.name,120)||!number(v.servings,0.01,1000)||typeof v.favorite!=='boolean')throw new ApiError('server');
 return {...v,draft:validateCanonicalDraft(v.draft)} as LibraryEntry;
}
export function validateLibraryPage(v:unknown):LibraryPage {
 if(!object(v)||!Array.isArray(v.items)||v.items.length>20||!(v.next_offset===null||(Number.isSafeInteger(v.next_offset)&&Number(v.next_offset)>=0)))throw new ApiError('server');
 return {items:v.items.map(validateLibraryEntry),next_offset:v.next_offset as number|null};
}
const legacyKeys=['calories','protein','carbs','fat','fiber','sugars','saturated_fat','sodium'];
/** Reuse the same editor, preserving source version/label metadata without looking up new nutrition. */
export function draftFromCanonical(body:MealDraft,key:string,origin:Draft['origin']):Draft {
 validateCanonicalDraft(body);
 return {...manualDraft(key,{day:body.local_date,mealType:body.meal_category as MealType}),origin,
  occurredAt:body.occurred_at??'',timezoneId:body.timezone_id??'',name:body.items.map(i=>i.display_name).join(', ').slice(0,120),
  analysis:{version:2,analysisId:key,mealName:body.items.map(i=>i.display_name).join(', ').slice(0,120),provider:origin,model:'',warnings:body.warnings,
   foods:body.items.map(item=>({...newReviewFood(item.id),name:item.display_name,confirmed:true,
    amount:String(item.portion['normalized_'+item.nutrition_per_100.basis as 'normalized_g'|'normalized_ml']),basis:item.nutrition_per_100.basis,source:item.source.provider,
    basisCorrection:item.basis_correction??undefined,originSource:item.source,originalPortion:item.portion,originalWarnings:item.warnings,confidence:item.confidence??'low',manualOverride:item.manual_override,product:item.label_metadata??null,
    manual:nutritionToInputs(Object.fromEntries(NUTRIENTS.map(k=>{const canonical=NUTRIENT_FIELDS[legacyKeys.indexOf(k)],value=item.nutrition_per_100[canonical];
      return [k,typeof value==='number'?(k==='sodium'?multiply(value,1,1000):value):null];})) as Parameters<typeof nutritionToInputs>[0])}))}};
}
export function libraryDraft(entry:LibraryEntry,key:string,seed:DraftSeed={},servings=1):Draft {
 validateLibraryEntry(entry);
 if(!number(servings,0.01,1000))throw new ApiError('validation');
 const original=entry.draft;const divisor=entry.kind==='recipe'?entry.servings:1;
 const base=manualDraft(key,seed);
 const body:MealDraft={...original,input_method:entry.kind==='recipe'?'recipe':'repeat',local_date:seed.day??base.day,meal_category:seed.mealType??original.meal_category,
 occurred_at:null,timezone_id:null,items:original.items.map(item=>({...item,portion:{...item.portion,
 quantity:multiply(item.portion.quantity,servings,divisor),[item.nutrition_per_100.basis==='g'?'normalized_g':'normalized_ml']:multiply(item.portion['normalized_'+item.nutrition_per_100.basis as 'normalized_g'|'normalized_ml']!,servings,divisor)}}))};
 return draftFromCanonical(body,key,entry.kind==='recipe'?'recipe':'repeat');
}
