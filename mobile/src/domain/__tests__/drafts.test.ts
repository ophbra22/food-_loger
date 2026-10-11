import {
  catalogDraft,
  draftPayload,
  draftProblems,
  editDraft,
  isDraftValid,
  manualDraft,
  markAttempted,
  productDraft,
} from '../drafts';
import { emptyNutrition } from '../nutrition';

const NOW = new Date(2026, 9, 11, 13, 0);
const keys = () => {
  let n = 0;
  return () => `new-key-${String(++n).padStart(8, '0')}`;
};

const PRODUCT = {
  barcode: '7290000066318',
  name: '  Oat drink  ',
  brand: 'Brand',
  quantity: '1 l',
  basis_unit: 'ml' as const,
  serving_quantity: 250,
  nutrition: { ...emptyNutrition(), calories: 46, protein: 1, carbs: 6.7, fat: 1.5, fiber: null },
  raw_nutriments: { 'energy-kcal_100g': 46 },
  source_url: 'https://world.openfoodfacts.org/product/7290000066318',
  missing_nutrients: ['sugars', 'saturated_fat', 'fiber', 'salt', 'sodium'],
  notes: [],
};

describe('new drafts', () => {
  it('never pre-fills the amount, whatever the source', () => {
    expect(catalogDraft('k'.repeat(20), 'banana', 'photo', {}, NOW).amount).toBe('');
    expect(catalogDraft('k'.repeat(20), 'banana', 'catalog', {}, NOW).amount).toBe('');
    expect(productDraft('k'.repeat(20), PRODUCT, {}, NOW).amount).toBe('');
    expect(manualDraft('k'.repeat(20), {}, NOW).amount).toBe('');
  });
  it('starts on the given day and meal, or today and the meal for the hour', () => {
    const draft = catalogDraft('k'.repeat(20), 'banana', 'catalog', {}, NOW);
    expect([draft.day, draft.mealType]).toEqual(['2026-10-11', 'lunch']);
    const seeded = manualDraft('k'.repeat(20), { day: '2026-10-09', mealType: 'dinner' }, NOW);
    expect([seeded.day, seeded.mealType]).toEqual(['2026-10-09', 'dinner']);
  });
  it('keeps product attribution and which nutrients the source did not provide', () => {
    const draft = productDraft('k'.repeat(20), PRODUCT, {}, NOW);
    expect(draft.name).toBe('Oat drink');
    expect(draft.basisUnit).toBe('ml');
    expect(draft.nutrition.calories).toBe('46');
    expect(draft.nutrition.fiber).toBe('');
    expect(draft.product?.sourceUrl).toContain('openfoodfacts.org');
    expect(draft.product?.missingAtLookup).toContain('fiber');
    expect(draft.product?.servingQuantity).toBe(250);
  });
});

describe('validation', () => {
  it('a catalog draft only needs a valid amount', () => {
    const draft = catalogDraft('k'.repeat(20), 'banana', 'catalog', {}, NOW);
    expect(isDraftValid(draft)).toBe(false);
    expect(draftProblems(draft).amount).toBe('validation.required');
    expect(isDraftValid({ ...draft, amount: '150' })).toBe(true);
    expect(isDraftValid({ ...draft, amount: '2001' })).toBe(false);
  });
  it('a custom draft needs a name and the four core values', () => {
    const draft = { ...manualDraft('k'.repeat(20), {}, NOW), amount: '100' };
    const problems = draftProblems(draft);
    expect(problems.name).toBe('validation.nameRequired');
    expect(Object.keys(problems.nutrition).sort()).toEqual(['calories', 'carbs', 'fat', 'protein']);
    const filled = {
      ...draft,
      name: 'Hummus',
      nutrition: { ...draft.nutrition, calories: '166', protein: '7.9', carbs: '14.3', fat: '0' },
    };
    expect(isDraftValid(filled)).toBe(true);
  });
});

describe('payloads', () => {
  it('builds the catalog request with a comma-decimal amount', () => {
    const draft = { ...catalogDraft('k'.repeat(20), 'banana', 'photo', {}, NOW), amount: '120,5' };
    expect(draftPayload(draft)).toEqual({
      kind: 'catalog',
      body: { food_id: 'banana', grams: 120.5, day: '2026-10-11', meal_type: 'lunch' },
    });
  });
  it('omits nutrients that were left empty and keeps real zeros', () => {
    const draft = { ...productDraft('k'.repeat(20), PRODUCT, {}, NOW), amount: '250' };
    const edited = { ...draft, nutrition: { ...draft.nutrition, salt: '0' } };
    const payload = draftPayload(edited);
    expect(payload.kind).toBe('custom');
    if (payload.kind !== 'custom') return;
    expect(payload.body.nutrition).toEqual({ calories: 46, protein: 1, carbs: 6.7, fat: 1.5, salt: 0 });
    expect('fiber' in payload.body.nutrition).toBe(false);
    expect(payload.body).toMatchObject({
      name: 'Oat drink',
      barcode: '7290000066318',
      basis_unit: 'ml',
      source: 'barcode',
      grams: 250,
      raw_nutriments: { 'energy-kcal_100g': 46 },
    });
  });
  it('marks hand-entered values as manual with no barcode', () => {
    const draft = {
      ...manualDraft('k'.repeat(20), {}, NOW),
      name: ' Hummus ',
      amount: '80',
      nutrition: {
        ...manualDraft('k'.repeat(20)).nutrition,
        calories: '166',
        protein: '7.9',
        carbs: '14.3',
        fat: '9.6',
      },
    };
    const payload = draftPayload(draft);
    expect(payload.body).toMatchObject({ name: 'Hummus', source: 'manual', barcode: null });
  });
});

describe('retry keys', () => {
  it('keeps the key while an unsent draft is edited', () => {
    const draft = catalogDraft('first-key-00000001', 'banana', 'catalog', {}, NOW);
    const edited = editDraft(draft, { amount: '150' }, keys(), NOW);
    expect(edited.key).toBe('first-key-00000001');
  });
  it('keeps the key when the same content is sent again after a failure', () => {
    const draft = markAttempted({
      ...catalogDraft('first-key-00000001', 'banana', 'catalog', {}, NOW),
      amount: '150',
    });
    expect(draft.attempted).toBe(true);
    expect(markAttempted(draft).key).toBe('first-key-00000001');
  });
  it('gives an edited draft a new key once a save was attempted', () => {
    const attempted = markAttempted({
      ...catalogDraft('first-key-00000001', 'banana', 'catalog', {}, NOW),
      amount: '150',
    });
    const edited = editDraft(attempted, { amount: '180' }, keys(), NOW);
    expect(edited.key).toBe('new-key-00000001');
    expect(edited.attempted).toBe(false);
    expect(edited.amount).toBe('180');
  });
});
