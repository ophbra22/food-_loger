import {validMealEdit} from '@/domain/meal-edit';
import {validCopyState} from '@/domain/copying';
/** Validate untrusted persisted JSON before it can become an editable draft or journal. */
import {validPortion,validSource,validBasisCorrection} from '@/domain/library';
import type { Draft } from '@/domain/drafts';
import { NUTRIENTS } from '@/domain/nutrition';
import { validateTimeContext } from '@/domain/canonical';
import type { DayResponse } from '@/api/types';

const record=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v);
const text=(v:unknown)=>typeof v==='string' && v.length<=10000;
const strings=(v:unknown)=>Array.isArray(v) && v.length<=256 && v.every(text);
const finite=(v:unknown)=>typeof v==='number' && Number.isFinite(v) && v>=0;
const category=(v:unknown)=>['breakfast','lunch','dinner','snack'].includes(String(v));
const core=['calories','protein','carbs','fat'];
export function validReference(v:unknown):boolean {
  return record(v) && ['id','name','source','source_url','data_type'].every(k=>text(v[k]))
    && /^https?:\/\//.test(String(v.source_url)) && v.basis_unit==='g' && record(v.nutrition) && core.every(k=>(v.nutrition as Record<string,unknown>)[k]==null || finite((v.nutrition as Record<string,unknown>)[k]));
}
function productInfo(p:unknown):boolean {
  return record(p) && text(p.barcode) && text(p.sourceUrl) && strings(p.notes)
    && strings(p.missingAtLookup) && record(p.rawNutriments)
    && Object.values(p.rawNutriments).every(v=>v===null || text(v) || (typeof v==='number' && Number.isFinite(v) && Math.abs(v)<=1e12))
    && (p.brand===null || text(p.brand)) && (p.quantity===null || text(p.quantity))
    && (p.servingQuantity===null || finite(p.servingQuantity));
}
export function storedDraft(v:unknown):v is Draft {
  if(!record(v) || !['catalog','photo','barcode','manual','repeat','recipe','copy','text','voice','label'].includes(String(v.origin))
     || !['key','name','brand','amount','day'].every(k=>text(v[k]))
     || !(v.foodId===null || text(v.foodId)) || !['g','ml'].includes(String(v.basisUnit))
     || typeof v.attempted!=='boolean' || !finite(v.updatedAt) || !category(v.mealType)
     || !validateTimeContext(String(v.day),null,null) || !record(v.nutrition)
     || !NUTRIENTS.every(k=>text((v.nutrition as Record<string,unknown>)[k]))) return false;
  if(v.edit!==undefined&&(!validMealEdit(v.edit)||v.copy!==undefined))return false;
  if(v.inputText!==undefined && (typeof v.inputText!=='string' || v.inputText.length>(v.origin==='label'?8000:2000)))return false;
  if(v.copy!==undefined && !validCopyState(v.copy,storedDraft))return false;
  if(v.product!==null && !productInfo(v.product)) return false;
  if(v.occurredAt!==undefined && !text(v.occurredAt)) return false;
  if(v.timezoneId!==undefined && !text(v.timezoneId)) return false;
  if(v.analysis!==undefined) {
    const a=v.analysis;
    if(record(a) && a.version!==undefined && a.version!==2) return false;
    if(!record(a) || !['analysisId','mealName','provider','model'].every(k=>text(a[k]))
       || !strings(a.warnings) || !Array.isArray(a.foods) || a.foods.length>15) return false;
    for(const f of a.foods) {
      if(record(f) && f.basisCorrection!==undefined && (!validBasisCorrection(f.basisCorrection)||f.manualOverride!==true))return false;
      if(record(f) && f.originalPortion!==undefined && !validPortion(f.originalPortion))return false;
      if(record(f) && ((f.originSource!==undefined && !validSource(f.originSource)) || (f.originalWarnings!==undefined && !strings(f.originalWarnings))))return false;
      if(record(f) && ((f.source!==undefined && !text(f.source)) || (f.manualOverride!==undefined && typeof f.manualOverride!=='boolean') || (f.product!=null && !productInfo(f.product)))) return false;
      if(record(f) && f.basis!==undefined && !['g','ml'].includes(String(f.basis))) return false;
      if(!record(f) || !['id','name','region','amount'].every(k=>text(f[k])) || typeof f.confirmed!=='boolean'
         || !['high','medium','low'].includes(String(f.confidence)) || !strings(f.alternatives)
         || !(f.question===null || text(f.question)) || !(f.reference===null || validReference(f.reference))
         || !Array.isArray(f.references) || !f.references.every(validReference)
         || !(f.manual===null || (record(f.manual) && core.every(k=>text((f.manual as Record<string,unknown>)[k])) && NUTRIENTS.every(k=>(f.manual as Record<string,unknown>)[k]===undefined || text((f.manual as Record<string,unknown>)[k]))))
         || !(f.range===null || (Array.isArray(f.range) && f.range.length===2 && f.range.every(finite)))) return false;
    }
  }
  return true;
}
export function storedDay(v:unknown,day:string):v is DayResponse {
  if(!record(v) || v.day!==day || !Array.isArray(v.meals) || v.meals.length>10000 || !record(v.summary)
     || !finite(v.summary.count) || !core.every(k=>(v.summary as Record<string,unknown>)[k]===null || finite((v.summary as Record<string,unknown>)[k]))) return false;
  return v.meals.every(m=>record(m) && ['id','name','emoji','food_id','created_at'].every(k=>text(m[k]))
    && m.day===day && category(m.meal_type) && finite(m.grams) && core.every(k=>m[k]===null || finite(m[k])) && record(m.details));
}
