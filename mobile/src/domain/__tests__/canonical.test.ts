import fixtures from '../../../../tests/fixtures/biteflow/nutrition.json';
import { aggregateNutrients, scaleNutrientsExact, normalizePortion, energyKcal, sodiumMg,
  parseQuantity, adaptLegacyDraft, validateTimeContext } from '../canonical';
import { manualDraft } from '../drafts';

test('shared synthetic scaling retains precision and unknowns', () => {
  for (const testCase of fixtures.scaling) {
    const actual = scaleNutrientsExact(testCase.per100, testCase.amount);
    for (const [key, expected] of Object.entries(testCase.expected)) {
      expect(actual[key]).toBe(expected);
    }
  }
  const row = { energy_kcal: 0.14, protein_g: 0 };
  expect(aggregateNutrients([row,row,row]).values.energy_kcal).toBe(0.42);
  expect(aggregateNutrients([row,{energy_kcal:null}]).values.energy_kcal).toBeNull();
  expect(aggregateNutrients([row,{energy_kcal:null}]).known_totals.energy_kcal).toBe(0.14);
  expect(aggregateNutrients([row]).values.protein_g).toBe(0);
});
test('no density guesses or label energy overwrite', () => {
  expect(() => normalizePortion(20,'ml','g')).toThrow();
  expect(normalizePortion(20,'ml','g',1.2)).toBe(24);
  expect(energyKcal(99,418.4)).toBe(99);
  expect(energyKcal(null,418.4)).toBe(100);
  expect(sodiumMg(0.1,null)).toBe(100);
  expect(sodiumMg(null,1)).toBe(400);
  expect(() => scaleNutrientsExact({energy_kcal:NaN},100)).toThrow();
});
test('Hebrew keyboard values and legacy draft provenance', () => {
  for (const [text, expected] of fixtures.numbers) expect(parseQuantity(String(text))).toBe(expected);
  const old = {...manualDraft('key'), name:'drink', amount:'150', basisUnit:'ml' as const};
  old.nutrition.sodium='0.1';
  const adapted = adaptLegacyDraft(old);
  expect(adapted.local_date).toBe(old.day);
  expect(adapted.occurred_at).toBeNull();
  expect(adapted.items[0].nutrition_per_100.sodium_mg).toBe(100);
  expect(adapted.items[0].portion.normalized_ml).toBe(150);
  expect(adapted.items[0].source.verified_status).toBe('legacy_unknown');
});

test('Jerusalem DST gaps and naive timestamps cannot become confirmed time', () => {
  expect(validateTimeContext('2026-10-13','2026-10-13T12:30:00+03:00','Asia/Jerusalem')).toBe(true);
  expect(validateTimeContext('2026-03-27','2026-03-27T02:30:00+02:00','Asia/Jerusalem')).toBe(false);
  expect(validateTimeContext('2026-10-13','2026-10-13T12:30:00','Asia/Jerusalem')).toBe(false);
  expect(validateTimeContext('2026-02-30',null,null)).toBe(false);
  expect(validateTimeContext('2026-10-25','2026-10-25T01:30:00+03:00','Asia/Jerusalem')).toBe(true);
  expect(validateTimeContext('2026-10-25','2026-10-25T01:30:00+02:00','Asia/Jerusalem')).toBe(true);
});
