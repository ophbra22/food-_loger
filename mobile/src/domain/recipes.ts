import type {CanonicalItem} from './canonical';
import type {Draft} from './drafts';
import {manualDraft} from './drafts';
import {draftFromCanonical,type LibraryEntry} from './library';
import {reviewPayload} from './unified-review';
import {parseDecimal} from './validation';
import {ApiError} from '@/api/errors';
export type RecipeBody={name:string;servings:number;items:CanonicalItem[];expected_version?:number};
export type RecipeForm={key:string;attempted:boolean;expectedVersion:number;name:string;servings:string;draft:Draft};
export function recipeForm(initial:LibraryEntry|null,key:string):RecipeForm {
 const draft=initial?draftFromCanonical(initial.draft,key,'recipe'):{...manualDraft(key),origin:'recipe' as const,analysis:{version:2 as const,analysisId:key,mealName:'',foods:[],warnings:[],provider:'recipe',model:''}};
 return {key,attempted:false,expectedVersion:initial?.version??0,name:initial?.name??'',servings:String(initial?.servings??1),draft};
}
export function recipeBody(form:RecipeForm):RecipeBody {
 const servings=parseDecimal(form.servings);
 if(!form.name.trim()||form.name.trim().length>120||servings===null||servings<0.01||servings>1000||!Number.isFinite(servings))throw new ApiError('validation');
 return {name:form.name.trim(),servings,items:reviewPayload(form.draft).items,...(form.expectedVersion?{expected_version:form.expectedVersion}:{})};
}
