import {validateAdvice,validatePreferences,validateSources,validateSourceReview,type Feature,type AdviceLanguage,type Preferences,type ReviewSource} from '@/domain/advice';
import {validateMeasurement,validateTrackingPage,type MeasurementBody,type Measurement,type TrackingKind} from '@/domain/tracking';
import {validateTrends} from '@/domain/trends';
import {validateLabelResult,validatePrivateProduct,validatePrivateProducts} from '@/domain/label-input';
import {validServings,type ServingConversion} from '@/domain/servings';
import {validateTextResult,type TextRequest} from '@/domain/text-input';
import {validateCopyPreview,type CopySelection,copyPayload} from '@/domain/copying';
import {ApiError} from './errors';
import type {RecipeBody} from '@/domain/recipes';
import {validateLibraryEntry,validateLibraryPage} from '@/domain/library';
import {validateGoalDocument,type GoalUpdate} from '@/domain/goals';
import { analysisResponse, dayResponse, foodsResponse, productResponse, referencesResponse, checked } from './response-validation';
import type { MealDraft, CanonicalItem } from '@/domain/canonical';
import type { AppleChallenge, AppleProof } from '@/auth/apple-auth';
import type { CatalogMealPayload, CustomMealPayload } from '@/domain/drafts';
import type { AnalysisOptions, AnalyzedMealPayload, MealAnalysis } from './meal-analysis-types';

import { ApiClient, UPLOAD_TIMEOUT_MS } from './client';
import type {
  Meal,
  Prediction,
  SessionResponse,
  User,
} from './types';

/** The server only answers sign-in requests that carry this header (anti cross-site rule). */
const AUTH_HEADERS = { 'X-FoodLogger-Request': '1', 'X-FoodLogger-Client': 'mobile' };

/**
 * A picture ready to upload. Expo's `fetch` builds the multipart body from parts
 * that expose `name`, `type` and `bytes()`; the older `{ uri }` descriptor is not accepted.
 */
export type UploadImage = {
  name: string;
  type: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: () => Promise<Uint8Array>;
};

export function imageForm(image: UploadImage) {
  const form = new FormData();
  form.append('file', image as unknown as Blob);
  return form;
}

export type Api = ReturnType<typeof createApi>;

export function createApi(client: ApiClient) {
  const { request } = client;
  return {
    captureSession: client.captureSession,
    advice: async(feature:Feature,date:string,language:AdviceLanguage)=>validateAdvice(await request(`/api/${feature==='insight'?'insights?week_start':'recommendations?day'}=${encodeURIComponent(date)}&language=${language}`),feature,date,language),
    wording: async(feature:Feature,date:string,language:AdviceLanguage,revision:string,key:string)=>validateAdvice(await request(`/api/wording/${feature}`,{method:'POST',json:{date,language,expected_revision:revision},idempotencyKey:key}),feature,date,language),
    recommendationPreferences: async()=>validatePreferences(await request('/api/recommendation-preferences')),
    saveRecommendationPreferences: async(p:Preferences)=>validatePreferences(await request('/api/recommendation-preferences',{method:'PUT',json:{expected_version:p.version,allergy_status:p.allergy_status,allergens:p.allergens,diets:p.diets}})),
    clearRecommendationPreferences: async(version:number)=>validatePreferences(await request(`/api/recommendation-preferences?expected_version=${version}`,{method:'DELETE'})),
    recommendationSources: async()=>validateSources(await request('/api/recommendation-sources')),
    saveRecommendationReview: async(source:ReviewSource)=>validateSourceReview(await request(`/api/recommendation-sources/${source.entry.kind}/${encodeURIComponent(source.entry.id)}`,{method:'PUT',json:{source_revision:source.source_revision,expected_preferences_version:source.preferences_version,expected_version:source.review.version,ingredients_reviewed:source.review.ingredients_reviewed,allergens:source.review.allergens,suitable_diets:source.review.suitable_diets}})),
    health: () =>
      request<{ status: string; model: string; version: string }>('/api/health', {
        auth: false,
        timeoutMs: 10_000,
      }),

    register: (username: string, password: string) =>
      request<SessionResponse>('/api/auth/register', {
        method: 'POST',
        auth: false,
        headers: AUTH_HEADERS,
        json: { username, password },
      }),
    login: (username: string, password: string) =>
      request<SessionResponse>('/api/auth/login', {
        method: 'POST',
        auth: false,
        headers: AUTH_HEADERS,
        json: { username, password },
      }),
    recover: (username: string, recoveryCode: string, newPassword: string) =>
      request<SessionResponse>('/api/auth/recover', {
        method: 'POST',
        auth: false,
        headers: AUTH_HEADERS,
        json: { username, recovery_code: recoveryCode, new_password: newPassword },
      }),
    appleChallenge: (purpose: 'login' | 'link' | 'delete') =>
      request<AppleChallenge>('/api/auth/apple/challenge', {
        method: 'POST', auth: purpose !== 'login', headers: AUTH_HEADERS, json: { purpose },
      }),
    appleLogin: (proof: AppleProof) => request<SessionResponse>('/api/auth/apple/login', {
      method: 'POST', auth: false, headers: AUTH_HEADERS, json: proof,
    }),
    appleLink: (proof: AppleProof) => request<{ user: User }>('/api/auth/apple/link', {
      method: 'POST', headers: AUTH_HEADERS, json: proof,
    }),
    appleDelete: (proof: AppleProof) => request<null>('/api/auth/apple/delete', {
      method: 'POST', headers: AUTH_HEADERS, json: { ...proof, confirmation: 'DELETE' },
    }),
    me: () => request<{ user: User }>('/api/auth/me'),
    logout: () => request<null>('/api/auth/logout', { method: 'POST', timeoutMs: 10_000 }),

    deleteAccount: (password: string) =>
      request<null>('/api/auth/account', {
        method: 'DELETE', json: { password, confirmation: 'DELETE' },
      }),

    foods: async () => foodsResponse(await request('/api/foods', { auth: false })),

    predict: (image: UploadImage) =>
      request<Prediction>('/api/predict', {
        method: 'POST',
        form: imageForm(image),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      }),
    analyzeMeal: async (image: UploadImage, secondImage: UploadImage | null, options: AnalysisOptions, key: string, signal?: AbortSignal) => {
      const form = imageForm(image);
      if (secondImage) form.append('second_file', secondImage as unknown as Blob);
      form.append('options', JSON.stringify(options));
      return analysisResponse(await request<MealAnalysis>('/api/analyze-meal', {
        method: 'POST', form, idempotencyKey: key, timeoutMs: 120_000, signal,
      }));
    },
    servings: async (foodId:string,version:string) => {
      const result=await request(`/api/servings?food_id=${encodeURIComponent(foodId)}&version=${encodeURIComponent(version)}`);
      return checked<{conversions:ServingConversion[]}>(result,validServings(result));
    },
    nutritionReferences: async (query: string) => referencesResponse(await request(
      `/api/analysis/references?q=${encodeURIComponent(query)}`)),
    addAnalyzedMeal: (body: AnalyzedMealPayload, idempotencyKey: string) =>
      request<{ meals: Meal[] }>('/api/meals/analyzed', { method: 'POST', json: body, idempotencyKey }),
    scanBarcode: (image: UploadImage) =>
      request<{ barcode: string }>('/api/barcode/scan', {
        method: 'POST',
        form: imageForm(image),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      }),
    product: async (barcode: string) => productResponse(await request(`/api/products/${encodeURIComponent(barcode)}`)),

    parseLabel: async (text:string,barcode?:string) => validateLabelResult(await request('/api/labels/parse',{method:'POST',json:{text,barcode:barcode||null}})),
    extractLabel: async (image:UploadImage,language:string,key:string,signal?:AbortSignal) => {
      const form=imageForm(image);form.append('language',language);
      return validateLabelResult(await request('/api/labels/extract',{method:'POST',form,idempotencyKey:key,timeoutMs:UPLOAD_TIMEOUT_MS,signal}));
    },
    privateProducts: async(q='')=>validatePrivateProducts(await request(`/api/private-products?q=${encodeURIComponent(q)}`)),
    savePrivateProduct: async(id:string,item:CanonicalItem,version:number,key:string)=>validatePrivateProduct(await request(`/api/private-products/${encodeURIComponent(id)}`,{method:'PUT',json:{confirmed:true,item,expected_version:version},idempotencyKey:key})),
    deletePrivateProduct: (id:string,version:number)=>request(`/api/private-products/${encodeURIComponent(id)}?expected_version=${version}`,{method:'DELETE'}),
    analyzeText: async (body:TextRequest,key:string,signal?:AbortSignal) => validateTextResult(await request('/api/analyze-text',{method:'POST',json:body,idempotencyKey:key,signal})),
    capabilities: () => request<{canonical_writes:boolean;partial_core_writes:boolean;tiny_portion_writes:boolean;insights?:boolean;recommendations?:boolean;recommendation_writes?:boolean;wording?:boolean;goals?:boolean;tracking?:boolean;tracking_writes?:boolean;trends?:boolean;library?:boolean;recipes?:boolean;recipe_writes?:boolean;copy?:boolean;label_ocr?:boolean;private_products?:boolean;servings?:boolean}>('/api/capabilities'),
    addCanonicalMeal: async (body: MealDraft, idempotencyKey: string) => {
      const group = await request<{snapshot?:{meals?:Meal[]}}>('/api/meal-logs', {method:'POST',json:{...body,confirmed:true},idempotencyKey});
      const meals = group?.snapshot?.meals;
      // Reuse the day validator for rows; totals are recomputed by the journal store.
      const valid = dayResponse({day:body.local_date,meals,summary:{count:meals?.length,calories:0,protein:0,carbs:0,fat:0}},body.local_date);
      return checked<Meal[]>(valid.meals, valid.meals.length===body.items.length);
    },
    library: async (favorites=false,query='',offset=0) => validateLibraryPage(await request(`/api/${favorites?'favorites':'recents'}?limit=20&offset=${offset}&query=${encodeURIComponent(query)}`)),
    setFavorite: (kind:'meal'|'recipe',id:string,wanted:boolean) => wanted
      ? request('/api/favorites',{method:'POST',json:{kind,id}})
      : request(`/api/favorites/${kind}/${encodeURIComponent(id)}`,{method:'DELETE'}),
    copySources: async (day:string) => {
      const result=await request<{items:unknown[]}>(`/api/copy-sources?day=${encodeURIComponent(day)}`);
      if(!Array.isArray(result?.items))throw new ApiError('server');
      return result.items.map(value=>{const entry=validateLibraryEntry(value);const ids=(value as {entry_ids?:unknown}).entry_ids;
        if(!Array.isArray(ids)||!ids.every(id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id)))throw new ApiError('server');return {...entry,entry_ids:ids as string[]};});
    },
    copyPreview: async (selection:CopySelection) => validateCopyPreview(await request('/api/days/copy',{method:'POST',json:{...selection,action:'preview'}})),
    copyMeals: async (body:ReturnType<typeof copyPayload>,key:string) => {
      const result=await request<{groups:{snapshot:{meals:Meal[]}}[]}>('/api/days/copy',{method:'POST',json:body,idempotencyKey:key});
      if(!Array.isArray(result?.groups)||result.groups.length!==body.drafts.length)throw new ApiError('server');
      return result.groups.flatMap((g,i)=>{const meals=g?.snapshot?.meals;const valid=dayResponse({day:body.destination_date,meals,summary:{count:meals?.length,calories:0,protein:0,carbs:0,fat:0}},body.destination_date);
        return checked<Meal[]>(valid.meals,valid.meals.length===body.drafts[i].items.length);});
    },
    recipes: async (query='',offset=0) => validateLibraryPage(await request(`/api/saved-recipes?limit=20&offset=${offset}&query=${encodeURIComponent(query)}`)),
    recipe: async (id:string) => validateLibraryEntry(await request(`/api/saved-recipes/${encodeURIComponent(id)}`)),
    recipeVersions: async (id:string) => {const result=await request<{versions:unknown[]}>(`/api/saved-recipes/${encodeURIComponent(id)}/versions`);if(!Array.isArray(result?.versions))throw new ApiError('server');return result.versions.map(validateLibraryEntry);},
    saveRecipe: async (id:string|null,body:RecipeBody,key:string) => validateLibraryEntry(await request(id?`/api/saved-recipes/${encodeURIComponent(id)}`:'/api/saved-recipes',{method:id?'PATCH':'POST',json:body,idempotencyKey:key})),
    duplicateRecipe: async (id:string,version:number,name:string,key:string) => validateLibraryEntry(await request(`/api/saved-recipes/${encodeURIComponent(id)}/duplicate`,{method:'POST',json:{expected_version:version,name},idempotencyKey:key})),
    deleteRecipe: (id:string,version:number) => request(`/api/saved-recipes/${encodeURIComponent(id)}?expected_version=${version}`,{method:'DELETE'}),
    tracking: async(kind:TrackingKind,from:string,to:string,offset=0)=>validateTrackingPage(await request(`/api/${kind}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&offset=${offset}`),kind,from,to),
    saveMeasurement: async(kind:TrackingKind,body:MeasurementBody,entry:Measurement|null,key:string)=>validateMeasurement(await request(`/api/${kind}${entry?'/'+encodeURIComponent(entry.id):''}`,{method:entry?'PATCH':'POST',json:entry?{...body,expected_version:entry.version}:body,idempotencyKey:key}),kind),
    deleteMeasurement: (kind:TrackingKind,id:string,version:number)=>request(`/api/${kind}/${encodeURIComponent(id)}?expected_version=${version}`,{method:'DELETE'}),
    trends: async(from:string,to:string)=>validateTrends(await request(`/api/trends?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),from,to),
    getGoals: async () => validateGoalDocument(await request('/api/goals')),
    putGoals: async (body:GoalUpdate) => validateGoalDocument(await request('/api/goals',{method:'PUT',json:body})),
    dailySummary: async (day:string) => {
      const result=await request<{goals?:unknown}>(`/api/daily-summary?date=${encodeURIComponent(day)}`);
      return {...dayResponse(result,day),goals:validateGoalDocument(result?.goals)};
    },
    day: async (day: string) => dayResponse(await request(`/api/meals?day=${encodeURIComponent(day)}&schema_version=2`),day),
    addMeal: (body: CatalogMealPayload, idempotencyKey: string) =>
      request<Meal>('/api/meals', { method: 'POST', json: body, idempotencyKey }),
    addCustomMeal: (body: CustomMealPayload, idempotencyKey: string) =>
      request<Meal>('/api/meals/custom', { method: 'POST', json: body, idempotencyKey }),
    deleteMeal: (id: string) =>
      request<null>(`/api/meals/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    exportCsv: (day: string) =>
      request<string>(`/api/export?day=${encodeURIComponent(day)}`, { responseType: 'text' }),
  };
}
