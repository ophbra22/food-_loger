import type { CoreNutrient, MealType } from '@/domain/nutrition';

export type CoreValues = Record<CoreNutrient, number | null>;
export type Confidence = 'high' | 'medium' | 'low';
export type NutritionReference = {
  source_version?: string | null;
  id: string; name: string; data_type: string; source: string; source_url: string;
  basis_unit: 'g'; nutrition: CoreValues;
};
export type AnalyzedFood = {
  id: string; name: string; search_name: string; preparation: string; region: string;
  dish_type: 'single' | 'composite'; visible_ingredients: string[];
  estimated_weight_g: number; weight_min_g: number; weight_max_g: number;
  confidence: Confidence; alternatives: string[]; question: string | null;
  reference: NutritionReference | null; reference_alternatives: NutritionReference[];
  nutrients: CoreValues; requires_confirmation: boolean; match_confidence: Confidence;
  weight_basis: 'visual_estimate';
};
export type MealAnalysis = {
  schema_version: 1; analysis_id: string; meal_name: string;
  status: 'food' | 'no_food' | 'uncertain'; foods: AnalyzedFood[]; total: CoreValues;
  complete_nutrition: boolean; overall_confidence: Confidence; warnings: string[];
  provider: string; model: string; usage: Record<string, number>; elapsed_ms: number;
};
export type AnalysisOptions = { language: 'en' | 'he'; plate_diameter_cm: number | null; context: string };
export type AnalyzedMealPayload = {
  day: string; meal_type: MealType; analysis_id: string;
  foods: { id: string; name: string; grams: number; reference_id: string | null;
    manual_nutrition: CoreValues | null; confirmed: true }[];
};
