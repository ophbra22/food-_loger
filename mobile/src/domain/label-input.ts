import {ApiError} from '@/api/errors';
import {productResponse} from '@/api/response-validation';
import type {Product} from '@/api/types';
import {productDraft,manualDraft,type Draft,type DraftSeed} from './drafts';
import {toUnifiedReview} from './unified-review';
import {object,validateCanonicalDraft,draftFromCanonical} from './library';
import type {CanonicalItem,MealDraft} from './canonical';
export type LabelResult={product:Product;warnings:string[];confirmed:false;observations:Record<string,unknown>;cached?:boolean};
export type PrivateProduct={id:string;version:number;item:CanonicalItem;created_at:string};
export function validateLabelResult(v:unknown):LabelResult {
 if(!object(v)||v.confirmed!==false||!object(v.observations)||!Array.isArray(v.warnings)||v.warnings.length>30||!v.warnings.every(w=>typeof w==='string'&&w.length<=240))throw new ApiError('server');
 return {...v,product:productResponse(v.product)} as LabelResult;
}
export function labelDraft(key:string,result:LabelResult,seed:DraftSeed={}):Draft {
 const draft=toUnifiedReview({...productDraft(key,result.product,seed),origin:'label'});
 draft.analysis!.warnings=result.warnings;
 return draft;
}
const canonical=(item:CanonicalItem):MealDraft=>({schema_version:'2',calculation_version:'exact-v1',input_method:'label',status:'draft',local_date:'2026-01-01',meal_category:'snack',occurred_at:null,timezone_id:null,items:[item],warnings:[]});
export function validatePrivateProduct(v:unknown):PrivateProduct {
 if(!object(v)||typeof v.id!=='string'||!/^[a-f0-9]{32}$/.test(v.id)||!Number.isSafeInteger(v.version)||Number(v.version)<1||typeof v.created_at!=='string')throw new ApiError('server');
 validateCanonicalDraft(canonical(v.item as CanonicalItem));return v as PrivateProduct;
}
export function validatePrivateProducts(v:unknown):{products:PrivateProduct[]} {
 if(!object(v)||!Array.isArray(v.products)||v.products.length>100)throw new ApiError('server');
 return {products:v.products.map(validatePrivateProduct)};
}
export function privateProductDraft(value:PrivateProduct,key:string,seed:DraftSeed={}):Draft {
 const product=validatePrivateProduct(value),base=manualDraft(key,seed);
 const body={...canonical(product.item),local_date:base.day,meal_category:base.mealType};
 const draft=draftFromCanonical(body,key,'label');
 draft.analysis!.foods=draft.analysis!.foods.map(f=>({...f,amount:'',confirmed:false,originalPortion:undefined,
  source:'private_product',originSource:{provider:'private_product',reference_id:product.id,version:String(product.version),verified_status:'user_confirmed'}}));
 return draft;
}
