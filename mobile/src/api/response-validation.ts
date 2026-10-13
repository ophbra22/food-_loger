import { ApiError } from './errors';
import type { DayResponse, FoodsResponse, Product } from './types';
import type { MealAnalysis, NutritionReference } from './meal-analysis-types';
import { storedDay, validReference } from '@/storage/validation';
import { NUTRIENTS } from '@/domain/nutrition';
const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
const number=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>=0;
const text=(v:unknown)=>typeof v==='string' && v.length<=10000;
export function checked<T>(v:unknown,ok:boolean):T { if(!ok) throw new ApiError('server'); return v as T; }
export const dayResponse=(v:unknown,day:string)=>checked<DayResponse>(v,storedDay(v,day));
export function referencesResponse(v:unknown) {
  return checked<{foods:NutritionReference[]}>(v,record(v) && Array.isArray(v.foods) && v.foods.length<=100 && v.foods.every(validReference));
}
export function foodsResponse(v:unknown) {
 return checked<FoodsResponse>(v,record(v) && text(v.source) && Array.isArray(v.foods) && v.foods.length<=10000 && v.foods.every(f=>record(f) && ['id','name','emoji','category'].every(k=>text(f[k])) && ['calories','protein','carbs','fat'].every(k=>number(f[k]))));
}
export function productResponse(v:unknown) {
 return checked<Product>(v,record(v) && ['barcode','name','source','source_url'].every(k=>text(v[k])) && ['g','ml'].includes(String(v.basis_unit))
  && (v.brand===null || text(v.brand)) && (v.quantity===null || text(v.quantity)) && (v.serving_quantity===null || number(v.serving_quantity))
  && record(v.nutrition) && NUTRIENTS.every(k=>(v.nutrition as Record<string,unknown>)[k]===null || number((v.nutrition as Record<string,unknown>)[k]))
  && record(v.raw_nutriments) && record(v.nutriment_units) && Array.isArray(v.notes) && v.notes.every(text) && Array.isArray(v.missing_nutrients) && v.missing_nutrients.every(text));
}
export function analysisResponse(v:unknown) {
 return checked<MealAnalysis>(v,record(v) && ['analysis_id','meal_name','provider','model'].every(k=>text(v[k]))
  && ['food','uncertain','no_food'].includes(String(v.status))
  && Array.isArray(v.warnings) && v.warnings.length<=30 && v.warnings.every(text)
  && Array.isArray(v.foods) && v.foods.length<=15 && v.foods.every(f=>record(f) && ['id','name','region'].every(k=>text(f[k]))
    && ['estimated_weight_g','weight_min_g','weight_max_g'].every(k=>number(f[k]))
    && ['high','medium','low'].includes(String(f.confidence)) && (f.question===null || text(f.question))
    && (f.reference===null || validReference(f.reference)) && Array.isArray(f.reference_alternatives) && f.reference_alternatives.every(validReference)
    && Array.isArray(f.alternatives) && f.alternatives.every(text)));
}
