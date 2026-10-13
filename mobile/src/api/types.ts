import type { BasisUnit, MealType, Nutrient, NutritionPer100 } from '@/domain/nutrition';

export type User = { id: string; username: string; apple_linked?: boolean;
  local_login?: boolean; apple_subject?: string | null };

export type SessionResponse = {
  user: User;
  csrf_token: string;
  session_token: string;
  expires_in: number;
  /** Present once, after registration or account recovery. */
  recovery_code?: string;
};

export type CatalogFood = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodsResponse = { foods: CatalogFood[]; source: string };

export type Candidate = { food_id: string; name: string; emoji: string; score: number };

export type Prediction = {
  status: 'recognized' | 'uncertain';
  candidates: Candidate[];
  unmapped_label: string | null;
  model?: string;
};

export type Product = {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  basis_unit: BasisUnit;
  serving_quantity: number | null;
  nutrition: NutritionPer100;
  raw_nutriments: Record<string, number | string | null>;
  nutriment_units: Record<string, string>;
  source: string;
  source_url: string;
  missing_nutrients: string[];
  notes: string[];
};

export type MealDetails = {
  basis_unit?: BasisUnit;
  source?: 'catalog' | 'manual' | 'barcode' | 'photo_analysis';
  nutrition_source?: string;
  nutrition_reference?: import('./meal-analysis-types').NutritionReference | null;
  group_id?: string;
  brand?: string;
  barcode?: string | null;
  nutrition_per100?: Partial<Record<Nutrient, number>>;
  nutrition_total?: Partial<Record<Nutrient, number>>;
  raw_nutriments?: Record<string, number | string | null>;
};

export type Meal = {
  id: string;
  day: string;
  meal_type: MealType;
  /** A catalog id, or "custom" for barcode and manual entries. */
  food_id: string;
  name: string;
  emoji: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  created_at: string;
  details: MealDetails;
};

export type DaySummary = {
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DayResponse = { day: string; meals: Meal[]; summary: DaySummary };
