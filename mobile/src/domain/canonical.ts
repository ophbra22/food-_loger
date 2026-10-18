import { fraction, multiply, sum } from './exact';
/** Canonical v2 preview contract. Existing saved totals are never recomputed. */
import type { Draft } from './drafts';
import { inputsToNutrition, parseDecimal } from './validation';
import { foodAmount, per100 } from './meal-analysis';

export const NUTRIENT_FIELDS = ['energy_kcal','protein_g','carbs_g','fat_g','fiber_g','sugars_g','saturated_fat_g','sodium_mg'] as const;
export type Values = Record<string, number | null>;
export type CanonicalItem = {
  id: string; display_name: string;
  portion: {quantity:number; unit:string; normalized_g?:number; normalized_ml?:number; food_specific_conversion_id?:string|null; estimated:boolean};
  nutrition_per_100: Record<string,number|string|null> & {basis:'g'|'ml'};
  source: {provider:string; reference_id?:string; version?:string; verified_status:string; brand?:string|null; barcode?:string|null};
  basis_correction?: {original_nutrition_per_100: CanonicalItem['nutrition_per_100']; original_source: CanonicalItem['source']};
  confidence?:'high'|'medium'|'low';
  label_metadata?: import('./drafts').ProductInfo;
  warnings:string[]; manual_override:boolean;
};
export type MealDraft = {
  schema_version:'2'; calculation_version:'exact-v1'; input_method:string; status:'draft';
  local_date:string; occurred_at:string|null; timezone_id:string|null; meal_category:string;
  items:CanonicalItem[]; warnings:string[];
};

export function scaleNutrientsExact(per100:Record<string,unknown>,amount:number):Values {
  fraction(amount);
  return Object.fromEntries(NUTRIENT_FIELDS.map(key=> {
    const value=per100[key];
    if(value!=null && typeof value!=='number') throw new Error('Invalid nutrient');
    return [key,value==null?null:multiply(value,amount,100)];
  }));
}
export function aggregateNutrients(rows:Values[]) {
  const known_totals:Values={},values:Values={},partial:Record<string,boolean>={};
  for(const key of NUTRIENT_FIELDS) {
    partial[key]=rows.length===0 || rows.some(row=>row[key]==null);
    known_totals[key]=sum(rows.flatMap(row=>row[key]==null?[]:[row[key]!]));
    values[key]=partial[key]?null:known_totals[key];
  }
  return {values,known_totals,partial};
}
export function normalizePortion(quantity:number,unit:string,basis:string,density?:number) {
  fraction(quantity);
  if(quantity===0) throw new Error('Quantity required');
  if(unit===basis && ['g','ml'].includes(unit)) return quantity;
  if(!['g','ml'].includes(unit) || !['g','ml'].includes(basis) || !density) throw new Error('Food-specific conversion required');
  return unit==='ml'?multiply(quantity,density):multiply(quantity,1,density);
}
export const energyKcal=(kcal:number|null,kj:number|null)=>kcal==null?(kj==null?null:multiply(kj,1,4.184)):multiply(kcal,1);
export const sodiumMg=(sodium:number|null,salt:number|null)=>sodium==null?(salt==null?null:multiply(salt,1000,2.5)):multiply(sodium,1000);
export function parseQuantity(text:string) {
  const value=parseDecimal(text); return value==null || !Number.isFinite(value)?null:value;
}
const legacyKeys=['calories','protein','carbs','fat','fiber','sugars','saturated_fat','sodium'];
function adaptNutrition(raw:Record<string,number|null>,basis:'g'|'ml') {
  return {basis,...Object.fromEntries(NUTRIENT_FIELDS.map((key,i)=>[key,
    raw[legacyKeys[i]]==null?null:(key==='sodium_mg'?multiply(raw.sodium!,1000):raw[legacyKeys[i]])]))};
}
export function adaptLegacyDraft(draft:Draft):MealDraft {
  const foods=draft.analysis?draft.analysis.foods.map(food=>({id:food.id,name:food.name,
    amount:food.amount,parsedAmount:foodAmount(food),basis:'g' as const,values:per100(food),manual:food.manual!==null})):
    [{id:draft.key,name:draft.name || draft.foodId || '',amount:draft.amount,parsedAmount:parseQuantity(draft.amount),basis:draft.basisUnit,
      values:inputsToNutrition(draft.nutrition),manual:draft.origin==='manual'}];
  return {schema_version:'2',calculation_version:'exact-v1',input_method:draft.origin==='photo'?'image':draft.origin,
    status:'draft',local_date:draft.day,occurred_at:null,timezone_id:null,meal_category:draft.mealType,
    warnings:['legacy_time_unknown'],items:foods.map(food=> {
      const quantity=food.parsedAmount;
      if(quantity==null || quantity<=0) throw new Error('Resolve quantity before adapting');
      return {id:food.id,display_name:food.name,portion:{quantity,unit:food.basis,
        [food.basis==='g'?'normalized_g':'normalized_ml']:quantity,estimated:false},
        nutrition_per_100:adaptNutrition(food.values,food.basis),source:{provider:'legacy',verified_status:'legacy_unknown'},
        warnings:['Review source before using the canonical writer'],manual_override:food.manual};
    })};
}

/** An offset-bearing timestamp must round-trip to the selected IANA zone/date. */
export function validateTimeContext(localDate:string,occurredAt:string|null,zone:string|null) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return false;
  const day=new Date(localDate+'T12:00:00Z');
  if(!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10)!==localDate) return false;
  if(occurredAt===null || zone===null) return occurredAt===null && zone===null;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt)) return false;
  try {
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(occurredAt));
    const p=Object.fromEntries(parts.map(part=>[part.type,part.value]));
    const wall=`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
    return wall===occurredAt.slice(0,19) && wall.slice(0,10)===localDate;
  } catch { return false; }
}
