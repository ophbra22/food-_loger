import {validateGoalDocument,type GoalUpdate} from '@/domain/goals';
import { analysisResponse, dayResponse, foodsResponse, productResponse, referencesResponse, checked } from './response-validation';
import type { MealDraft } from '@/domain/canonical';
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

    capabilities: () => request<{canonical_writes:boolean;partial_core_writes:boolean;tiny_portion_writes:boolean;goals?:boolean}>('/api/capabilities'),
    addCanonicalMeal: async (body: MealDraft, idempotencyKey: string) => {
      const group = await request<{snapshot?:{meals?:Meal[]}}>('/api/meal-logs', {method:'POST',json:{...body,confirmed:true},idempotencyKey});
      const meals = group?.snapshot?.meals;
      // Reuse the day validator for rows; totals are recomputed by the journal store.
      const valid = dayResponse({day:body.local_date,meals,summary:{count:meals?.length,calories:0,protein:0,carbs:0,fat:0}},body.local_date);
      return checked<Meal[]>(valid.meals, valid.meals.length===body.items.length);
    },
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
