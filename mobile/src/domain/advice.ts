import {ApiError} from '@/api/errors';
import {object,validateLibraryEntry,validateCanonicalDraft,draftFromCanonical,type LibraryEntry} from './library';
import {NUTRIENT_FIELDS,type MealDraft} from './canonical';
import {validateTrends,type TrendResponse} from './trends';
import {addDays} from './dates';
export type Feature='insight'|'recommendation';
export type AdviceLanguage='en'|'he';
export const ALLERGENS=['milk','eggs','peanuts','tree_nuts','sesame','soy','wheat','gluten','fish','shellfish','celery','mustard','lupin','sulphites','other'] as const;
export const DIETS=['vegetarian','vegan','gluten_free'] as const;
export type Preferences={version:number;allergy_status:'unknown'|'none'|'declared';allergens:string[];diets:string[]};
export type SourceReview={version:number;ingredients_reviewed:boolean;allergens:string[];suitable_diets:string[]};
export type ReviewSource={entry:LibraryEntry;source_revision:string;review:SourceReview};
type Common={schema_version:1;language:AdviceLanguage;revision:string;ai_status:string;sentences?:{id:string;text:string}[]};
export type Insight=Common&{week_start:string;trends:TrendResponse;protein_achievement:{met:number;eligible:number;logged:number};meal_distribution:{category:'breakfast'|'lunch'|'dinner'|'snack';entry_count:number;logged_days:number;calories_average:number|null;protein_average:number|null}[]};
export type RecommendationChoice={entry:LibraryEntry;draft:MealDraft;servings:number;nutrition:{values:Record<string,number|null>;known_totals:Record<string,number>;partial:Record<string,boolean>};safety_status:'unknown'|'user_reviewed';rationale:'remaining_targets'|'familiar_portion';warnings:string[]};
export type Recommendation=Common&{day:string;preferences:Preferences;remaining:Record<'calories'|'protein'|'carbs'|'fat',number|null>;choices:RecommendationChoice[];warnings:string[];pool_limit:60};
export type Advice=Insight|Recommendation;
const fail=():never=>{throw new ApiError('server');};
const count=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const nullable=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const list=(v:unknown,allowed:readonly string[])=>Array.isArray(v)&&v.length<=allowed.length&&new Set(v).size===v.length&&v.every(x=>typeof x==='string'&&allowed.includes(x));
const texts=(v:unknown)=>Array.isArray(v)&&v.length<=20&&v.every(x=>typeof x==='string'&&x.length<=240);
export function validatePreferences(v:unknown):Preferences {
 if(!object(v)||!count(v.version)||!['unknown','none','declared'].includes(String(v.allergy_status))||!list(v.allergens,ALLERGENS)||!list(v.diets,DIETS)||((v.allergy_status==='declared')!==((v.allergens as string[]).length>0)))return fail();
 return v as Preferences;
}
export function validateSourceReview(v:unknown):SourceReview {
 if(!object(v)||!count(v.version)||typeof v.ingredients_reviewed!=='boolean'||!list(v.allergens,ALLERGENS)||!list(v.suitable_diets,DIETS))return fail();
 return v as SourceReview;
}
export function validateSources(v:unknown):ReviewSource[] {
 if(!object(v)||v.pool_limit!==60||!Array.isArray(v.items)||v.items.length>60)return fail();
 return v.items.map(x=>{if(!object(x)||!hash(x.source_revision))return fail();return {entry:validateLibraryEntry(x.entry),source_revision:x.source_revision as string,review:validateSourceReview(x.review)};});
}
export function validateAdvice(v:unknown,feature:Feature,date:string,language:AdviceLanguage):Advice {
 if(!object(v)||v.schema_version!==1||!hash(v.revision)||v.language!==language||!['not_requested','used','disabled','quota','unavailable'].includes(String(v.ai_status)))return fail();
 if(v.sentences!==undefined&&(!Array.isArray(v.sentences)||v.sentences.length>12||!v.sentences.every(s=>object(s)&&typeof s.id==='string'&&s.id.length<=80&&typeof s.text==='string'&&s.text.length<=2000)))return fail();
 if(feature==='insight'){
  if(v.week_start!==date||!Array.isArray(v.sentences)||!object(v.protein_achievement)||!Array.isArray(v.meal_distribution)||v.meal_distribution.length!==4)return fail();
  const p=v.protein_achievement;
  if(!['met','eligible','logged'].every(k=>count(p[k])&&Number(p[k])<=7)||Number(p.met)>Number(p.eligible)||Number(p.eligible)>Number(p.logged))return fail();
  if(!v.meal_distribution.every((d,i)=>object(d)&&d.category===['breakfast','lunch','dinner','snack'][i]&&count(d.entry_count)&&count(d.logged_days)&&Number(d.logged_days)<=7&&nullable(d.calories_average)&&nullable(d.protein_average)))return fail();
  return {...v,trends:validateTrends(v.trends,date,addDays(date,6))} as Insight;
 }
 if(v.day!==date||v.pool_limit!==60||!object(v.remaining)||!['calories','protein','carbs','fat'].every(k=>nullable((v.remaining as Record<string,unknown>)[k]))||!texts(v.warnings)||!Array.isArray(v.choices)||v.choices.length>4)return fail();
 const choices=v.choices.map(c=>{
  if(!object(c)||typeof c.servings!=='number'||![.5,1,1.5,2].includes(c.servings)||!object(c.nutrition)||!['unknown','user_reviewed'].includes(String(c.safety_status))||!['remaining_targets','familiar_portion'].includes(String(c.rationale))||!texts(c.warnings))return fail();
  const n=c.nutrition;if(!object(n.values)||!object(n.known_totals)||!object(n.partial)||!NUTRIENT_FIELDS.every(k=>nullable((n.values as Record<string,unknown>)[k])&&typeof (n.known_totals as Record<string,unknown>)[k]==='number'&&nullable((n.known_totals as Record<string,unknown>)[k])&&typeof (n.partial as Record<string,unknown>)[k]==='boolean'))return fail();
  const draft=validateCanonicalDraft(c.draft);if(draft.local_date!==date)return fail();
  return {...c,entry:validateLibraryEntry(c.entry),draft} as RecommendationChoice;
 });
 return {...v,preferences:validatePreferences(v.preferences),choices} as Recommendation;
}
export const recommendationDraft=(choice:RecommendationChoice,key:string)=>draftFromCanonical(choice.draft,key,choice.entry.kind==='recipe'?'recipe':'repeat');
