import type { CatalogMealPayload, CustomMealPayload } from '@/domain/drafts';

import { ApiClient, UPLOAD_TIMEOUT_MS } from './client';
import type {
  DayResponse,
  FoodsResponse,
  Meal,
  Prediction,
  Product,
  SessionResponse,
  User,
} from './types';

/** The server only answers sign-in requests that carry this header (anti cross-site rule). */
const AUTH_HEADERS = { 'X-FoodLogger-Request': '1', 'X-FoodLogger-Client': 'mobile' };

export type UploadImage = { uri: string; name: string; type: 'image/jpeg' | 'image/png' | 'image/webp' };

function imageForm(image: UploadImage) {
  const form = new FormData();
  // React Native's FormData takes a file descriptor instead of a Blob.
  form.append('file', image as unknown as Blob);
  return form;
}

export type Api = ReturnType<typeof createApi>;

export function createApi(client: ApiClient) {
  const { request } = client;
  return {
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
    me: () => request<{ user: User }>('/api/auth/me'),
    logout: () => request<null>('/api/auth/logout', { method: 'POST', timeoutMs: 10_000 }),

    foods: () => request<FoodsResponse>('/api/foods', { auth: false }),

    predict: (image: UploadImage) =>
      request<Prediction>('/api/predict', {
        method: 'POST',
        form: imageForm(image),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      }),
    scanBarcode: (image: UploadImage) =>
      request<{ barcode: string }>('/api/barcode/scan', {
        method: 'POST',
        form: imageForm(image),
        timeoutMs: UPLOAD_TIMEOUT_MS,
      }),
    product: (barcode: string) =>
      request<Product>(`/api/products/${encodeURIComponent(barcode)}`),

    day: (day: string) => request<DayResponse>(`/api/meals?day=${encodeURIComponent(day)}`),
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
