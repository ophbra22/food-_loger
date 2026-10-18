import type {Api} from '@/api/endpoints';
import {ApiError} from '@/api/errors';
import {dayResponse} from '@/api/response-validation';
import type {Meal} from '@/api/types';
import {NUTRIENT_FIELDS,type MealDraft,type CanonicalItem} from './canonical';
import type {Draft} from './drafts';
import {draftFromCanonical,object,validateCanonicalDraft} from './library';
import {multiply} from './exact';

export type MealGroup={id:string;version:number;local_date:string;occurred_at:string|null;timezone_id:string|null;snapshot:{meals:Meal[];draft?:MealDraft}};
export type MealEdit={groupId:string;expectedVersion:number;originalDate:string;entryIds:string[];rejected?:boolean};
const identity=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v);
export function validMealEdit(v:unknown):v is MealEdit {
 return object(v)&&identity(v.groupId)&&Number.isSafeInteger(v.expectedVersion)&&Number(v.expectedVersion)>0&&typeof v.originalDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.originalDate)&&Array.isArray(v.entryIds)&&v.entryIds.length>0&&v.entryIds.length<=15&&v.entryIds.every(identity)&&(v.rejected===undefined||typeof v.rejected==='boolean');
}
export function validateMealGroup(v:unknown):MealGroup {
 if(!object(v)||!identity(v.id)||!Number.isSafeInteger(v.version)||Number(v.version)<1||typeof v.local_date!=='string'||!object(v.snapshot)||!Array.isArray(v.snapshot.meals)||!v.snapshot.meals.length||v.snapshot.meals.length>15)throw new ApiError('server');
 const meals=dayResponse({day:v.local_date,meals:v.snapshot.meals,summary:{count:v.snapshot.meals.length,calories:0,protein:0,carbs:0,fat:0}},v.local_date).meals;
 const group={...v,snapshot:{...v.snapshot,meals}} as MealGroup;
 canonicalGroupDraft(group);return group;
}
function canonicalGroupDraft(group:MealGroup):MealDraft {
 const keys=['calories','protein','carbs','fat','fiber','sugars','saturated_fat','sodium'] as const;
 // Reconstruct from current components, also after one component was deleted.
 const items=group.snapshot.meals.map(row=>{
  const raw=row.details.canonical_item as CanonicalItem|undefined;
  if(raw)return {...raw,source:{...raw.source,verified_status:raw.source.verified_status==='verified'?'user_confirmed':raw.source.verified_status}};
  const basis=row.details.basis_unit??'g',values={...row.details.nutrition_total,calories:row.calories,protein:row.protein,carbs:row.carbs,fat:row.fat};
  return {id:row.id,display_name:row.name,portion:{quantity:row.grams,unit:basis,[basis==='g'?'normalized_g':'normalized_ml']:row.grams,estimated:false},
   nutrition_per_100:{basis,...Object.fromEntries(NUTRIENT_FIELDS.map((key,i)=>[key,values[keys[i]]==null?null:multiply(values[keys[i]]!,key==='sodium_mg'?100000:100,row.grams)]))},
   source:{provider:'historical_snapshot',reference_id:row.id,verified_status:'legacy_unknown'},warnings:['historical_snapshot_scaling'],manual_override:false} as CanonicalItem;
 });
 return validateCanonicalDraft({schema_version:'2',calculation_version:'exact-v1',input_method:'manual',status:'draft',local_date:group.local_date,occurred_at:group.occurred_at??null,timezone_id:group.timezone_id??null,meal_category:group.snapshot.meals[0].meal_type,items,warnings:group.snapshot.draft?.warnings??['legacy_time_unknown','historical_snapshot_scaling']});
}
export function mealEditDraft(raw:unknown,key:string):Draft {
 const group=validateMealGroup(raw);
 return {...draftFromCanonical(canonicalGroupDraft(group),key,'manual'),edit:{groupId:group.id,expectedVersion:group.version,originalDate:group.local_date,entryIds:group.snapshot.meals.map(m=>m.id)}};
}
export async function loadMealForEdit(api:Pick<Api,'mealLogs'|'mealLog'>,entryId:string,day:string):Promise<MealGroup> {
 const groups=await api.mealLogs(day);
 const group=groups.find(g=>g.id===entryId||g.snapshot.meals.some(m=>m.id===entryId));
 if(!group)throw new ApiError('notFound');
 return api.mealLog(group.id);
}
