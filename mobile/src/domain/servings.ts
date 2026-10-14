import {multiply} from './exact';
import type {ReviewFood} from './meal-analysis';
import {parseDecimal} from './validation';
export type ServingConversion={id:string;food_id:string;source_version:string;unit:string;label:string;basis:'g'|'ml';amount:number;confidence:string;evidence:Record<string,unknown>};
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function validServings(value:unknown):value is {conversions:ServingConversion[]} {
 return obj(value)&&Array.isArray(value.conversions)&&value.conversions.length<=50&&value.conversions.every(r=>obj(r)&&
 ['id','food_id','source_version','unit','confidence'].every(k=>typeof r[k]==='string'&&r[k].length>0&&r[k].length<=160)&&
 typeof r.label==='string'&&r.label.length>0&&r.label.length<=40&&['g','ml'].includes(String(r.basis))&&
 typeof r.amount==='number'&&Number.isFinite(r.amount)&&r.amount>0&&r.amount<=100000&&obj(r.evidence));
}
export function applyServing(food:ReviewFood,row:ServingConversion,text:string):ReviewFood {
 const quantity=parseDecimal(text), reference=food.reference;
 if(!validServings({conversions:[row]})||!reference||reference.id!==row.food_id||reference.source_version!==row.source_version||row.basis!==(food.basis??'g')||quantity===null||quantity<=0||quantity>100000) throw new Error('Food-specific conversion required');
 const amount=multiply(quantity,row.amount);
 if(amount<0.0001||amount>2000) throw new Error('Invalid amount');
 return {...food,amount:String(amount),confirmed:false,originalPortion:{quantity,unit:row.label,
 [row.basis==='g'?'normalized_g':'normalized_ml']:amount,food_specific_conversion_id:row.id,estimated:true}};
}
