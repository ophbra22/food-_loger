/**
 * A draft is a meal being reviewed that the server has not confirmed yet.
 * It carries the retry key that lets the server recognise a repeated save.
 */
import type {CopyState} from './copying';
import { todayIso } from './dates';
import { AnalysisDraft, analysisValid } from './meal-analysis';
import {
  BasisUnit,
  MealType,
  NUTRIENTS,
  Nutrient,
  NutritionPer100,
  defaultMealType,
  emptyNutrition,
  missingCore,
} from './nutrition';
import {
  NutritionInputs,
  emptyNutritionInputs,
  inputsToNutrition,
  nutritionToInputs,
  parseDecimal,
  validateAmount,
  validateFoodName,
  validateNutrient,
  ValidationKey,
} from './validation';

export type DraftOrigin = 'catalog' | 'photo' | 'barcode' | 'manual' | 'repeat' | 'recipe' | 'copy' | 'text' | 'voice' | 'label';

export type ProductInfo = {
  sourceProvider?: string | null; sourceVersion?: string | null;
  barcode: string;
  brand: string | null;
  quantity: string | null;
  servingQuantity: number | null;
  sourceUrl: string;
  /** Nutrients Open Food Facts did not provide when the product was looked up. */
  missingAtLookup: Nutrient[];
  notes: string[];
  rawNutriments: Record<string, number | string | null>;
};

export type Draft = {
  edit?: import('./meal-edit').MealEdit;
  inputText?: string;
  copy?: CopyState;
  /** Whole-meal review, persisted without any photo URIs or image bytes. */
  analysis?: AnalysisDraft;
  occurredAt?: string;
  timezoneId?: string;
  /** Sent as `Idempotency-Key`. Stable across retries of the same content. */
  key: string;
  origin: DraftOrigin;
  /** Set for catalog foods (including a confirmed photo suggestion). */
  foodId: string | null;
  name: string;
  brand: string;
  basisUnit: BasisUnit;
  /** Text exactly as typed, so a half-typed number survives a restart. */
  nutrition: NutritionInputs;
  amount: string;
  mealType: MealType;
  day: string;
  product: ProductInfo | null;
  /** True once a save was attempted; an edit after that gets a fresh key. */
  attempted: boolean;
  updatedAt: number;
};

export type DraftSeed = Partial<Pick<Draft, 'day' | 'mealType'>>;

const base = (key: string, origin: DraftOrigin, seed: DraftSeed, now: Date): Draft => ({
  key,
  origin,
  foodId: null,
  name: '',
  brand: '',
  basisUnit: 'g',
  nutrition: emptyNutritionInputs(),
  // The amount always starts empty: a photo or a catalog entry cannot tell how much was eaten.
  amount: '',
  mealType: seed.mealType ?? defaultMealType(now),
  day: seed.day ?? todayIso(now),
  product: null,
  attempted: false,
  updatedAt: now.getTime(),
});

export const catalogDraft = (
  key: string,
  foodId: string,
  origin: 'catalog' | 'photo',
  seed: DraftSeed = {},
  now: Date = new Date(),
): Draft => ({ ...base(key, origin, seed, now), foodId });

export const manualDraft = (key: string, seed: DraftSeed = {}, now: Date = new Date()): Draft =>
  base(key, 'manual', seed, now);

export function productDraft(
  key: string,
  product: {
    barcode: string;
    name: string;
    brand: string | null;
    quantity: string | null;
    basis_unit: BasisUnit;
    source?: string; source_version?: string | null;
    serving_quantity: number | null;
    nutrition: NutritionPer100;
    raw_nutriments: Record<string, number | string | null>;
    source_url: string;
    missing_nutrients: string[];
    notes: string[];
  },
  seed: DraftSeed = {},
  now: Date = new Date(),
): Draft {
  return {
    ...base(key, 'barcode', seed, now),
    // The journal accepts names up to 120 characters.
    name: product.name.trim().slice(0, 120),
    brand: product.brand ?? '',
    basisUnit: product.basis_unit,
    nutrition: nutritionToInputs({ ...emptyNutrition(), ...product.nutrition }),
    product: {
      barcode: product.barcode,
      sourceProvider: product.source, sourceVersion: product.source_version,
      brand: product.brand,
      quantity: product.quantity,
      servingQuantity: product.serving_quantity,
      sourceUrl: product.source_url,
      missingAtLookup: product.missing_nutrients.filter((key): key is Nutrient =>
        (NUTRIENTS as readonly string[]).includes(key),
      ),
      notes: product.notes,
      rawNutriments: product.raw_nutriments,
    },
  };
}

/**
 * Apply an edit. If a save was already attempted, the edited draft gets a new
 * retry key so the server does not answer with the earlier, different content.
 */
export function editDraft(
  draft: Draft,
  changes: Partial<Omit<Draft, 'key' | 'attempted' | 'updatedAt' | 'origin'>>,
  newKey: () => string,
  now: Date = new Date(),
): Draft {
  if(draft.edit&&draft.attempted)return draft;
  return {
    ...draft,
    ...changes,
    key: draft.attempted ? newKey() : draft.key,
    attempted: false,
    updatedAt: now.getTime(),
  };
}

export const markAttempted = (draft: Draft): Draft => ({ ...draft, attempted: true });

export type DraftProblems = {
  name?: ValidationKey;
  amount?: ValidationKey;
  nutrition: Partial<Record<Nutrient, ValidationKey>>;
};

export function draftProblems(draft: Draft): DraftProblems {
  const problems: DraftProblems = { nutrition: {} };
  const amount = validateAmount(draft.amount);
  if (amount) problems.amount = amount;
  if (draft.foodId === null) {
    const name = validateFoodName(draft.name);
    if (name) problems.name = name;
    for (const key of NUTRIENTS) {
      const problem = validateNutrient(key, draft.nutrition[key]);
      if (problem) problems.nutrition[key] = problem;
    }
  }
  return problems;
}

export const isDraftValid = (draft: Draft):boolean => {
  if (draft.copy) return draft.copy.meals.length>0 && (!draft.copy.destinationPopulated || draft.copy.confirmPopulated) && draft.copy.meals.every(m=>!m.copy && isDraftValid(m));
  if (draft.analysis) return analysisValid(draft.analysis);
  const problems = draftProblems(draft);
  return !problems.name && !problems.amount && Object.keys(problems.nutrition).length === 0;
};

export type CatalogMealPayload = {
  food_id: string;
  grams: number;
  day: string;
  meal_type: MealType;
};

export type CustomMealPayload = {
  name: string;
  brand: string;
  barcode: string | null;
  grams: number;
  basis_unit: BasisUnit;
  day: string;
  meal_type: MealType;
  nutrition: Partial<Record<Nutrient, number>>;
  source: 'manual' | 'barcode';
  raw_nutriments: Record<string, number | string | null>;
};

export type DraftPayload =
  | { kind: 'catalog'; body: CatalogMealPayload }
  | { kind: 'custom'; body: CustomMealPayload };

/** Build the request body. Call only for a draft that passed `isDraftValid`. */
export function draftPayload(draft: Draft): DraftPayload {
  const grams = parseDecimal(draft.amount) as number;
  if (draft.foodId !== null) {
    return {
      kind: 'catalog',
      body: { food_id: draft.foodId, grams, day: draft.day, meal_type: draft.mealType },
    };
  }
  const per100 = inputsToNutrition(draft.nutrition);
  if (missingCore(per100).length) throw new Error('Draft is missing a required nutrient.');
  const nutrition: Partial<Record<Nutrient, number>> = {};
  for (const key of NUTRIENTS) {
    const value = per100[key];
    // A nutrient left empty is omitted, so the journal keeps it as "not provided".
    if (value != null) nutrition[key] = value;
  }
  return {
    kind: 'custom',
    body: {
      name: draft.name.trim(),
      brand: draft.brand.trim().slice(0, 120),
      barcode: draft.product?.barcode ?? null,
      grams,
      basis_unit: draft.basisUnit,
      day: draft.day,
      meal_type: draft.mealType,
      nutrition,
      source: draft.product ? 'barcode' : 'manual',
      raw_nutriments: draft.product?.rawNutriments ?? {},
    },
  };
}

/** Resume unfinished descriptions at their entry screen, preserving parsed review edits. */
export function resumeDraftPath(draft: Draft | null | undefined): '/add/text' | '/add/voice' | '/add/label' | '/add/review' {
  return draft && !draft.analysis && !draft.attempted && (draft.origin === 'text' || draft.origin === 'voice' || draft.origin === 'label')
    ? draft.origin === 'text' ? '/add/text' : draft.origin === 'voice' ? '/add/voice' : '/add/label'
    : '/add/review';
}
