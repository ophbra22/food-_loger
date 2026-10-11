/**
 * Input checks that mirror the backend rules, so mistakes are caught before a request.
 * Each check returns a translation key for the problem, or null when the value is fine.
 */
import {
  AMOUNT_MAX,
  AMOUNT_MIN,
  CORE_NUTRIENTS,
  Nutrient,
  NUTRIENTS,
  NutritionPer100,
  emptyNutrition,
  nutrientMax,
} from './nutrition';

export type ValidationKey =
  | 'validation.required'
  | 'validation.numberInvalid'
  | 'validation.amountRange'
  | 'validation.nutrientRange'
  | 'validation.caloriesRange'
  | 'validation.usernameFormat'
  | 'validation.passwordLength'
  | 'validation.recoveryFormat'
  | 'validation.nameRequired'
  | 'validation.nameTooLong'
  | 'validation.nameControl'
  | 'validation.barcodeFormat'
  | 'validation.barcodeCheckDigit';

/**
 * Parse a number typed on either a "." or "," decimal keyboard.
 * Returns null for an empty field and NaN for text that is not a plain decimal.
 */
export function parseDecimal(input: string): number | null {
  // Hebrew and Arabic keyboards can add direction marks around digits.
  const text = input.replace(/[‎‏‪-‮⁦-⁩\s]/g, '');
  if (text === '') return null;
  if (!/^\d{1,7}([.,]\d{0,4})?$|^[.,]\d{1,4}$/.test(text)) return NaN;
  return Number(text.replace(',', '.'));
}

export function validateAmount(input: string): ValidationKey | null {
  const value = parseDecimal(input);
  if (value === null) return 'validation.required';
  if (Number.isNaN(value)) return 'validation.numberInvalid';
  return value >= AMOUNT_MIN && value <= AMOUNT_MAX ? null : 'validation.amountRange';
}

export function validateNutrient(key: Nutrient, input: string): ValidationKey | null {
  const value = parseDecimal(input);
  const core = (CORE_NUTRIENTS as readonly string[]).includes(key);
  if (value === null) return core ? 'validation.required' : null;
  if (Number.isNaN(value)) return 'validation.numberInvalid';
  if (value < 0 || value > nutrientMax(key)) {
    return key === 'calories' ? 'validation.caloriesRange' : 'validation.nutrientRange';
  }
  return null;
}

export type NutritionInputs = Record<Nutrient, string>;

export const emptyNutritionInputs = (): NutritionInputs =>
  Object.fromEntries(NUTRIENTS.map((key) => [key, ''])) as NutritionInputs;

/** Text for an input field: an empty string for a missing value, never "0". */
export const nutritionToInputs = (per100: NutritionPer100): NutritionInputs =>
  Object.fromEntries(
    NUTRIENTS.map((key) => [key, per100[key] == null ? '' : trimNumber(per100[key] as number)]),
  ) as NutritionInputs;

export function inputsToNutrition(inputs: NutritionInputs): NutritionPer100 {
  const result = emptyNutrition();
  for (const key of NUTRIENTS) {
    const value = parseDecimal(inputs[key]);
    result[key] = value === null || Number.isNaN(value) ? null : value;
  }
  return result;
}

export const trimNumber = (value: number) => String(Math.round(value * 1000) / 1000);

export const validateUsername = (value: string): ValidationKey | null =>
  /^[A-Za-z0-9_-]{3,32}$/.test(value.trim()) ? null : 'validation.usernameFormat';

export const validatePassword = (value: string): ValidationKey | null =>
  value.length >= 12 && value.length <= 128 ? null : 'validation.passwordLength';

/** Recovery codes are 43 URL-safe characters; spaces from copy and paste are ignored. */
export const cleanRecoveryCode = (value: string) => value.replace(/\s+/g, '');
export const validateRecoveryCode = (value: string): ValidationKey | null =>
  /^[A-Za-z0-9_-]{43}$/.test(cleanRecoveryCode(value)) ? null : 'validation.recoveryFormat';

export function validateFoodName(value: string): ValidationKey | null {
  const name = value.trim();
  if (!name) return 'validation.nameRequired';
  if (name.length > 120) return 'validation.nameTooLong';
  return /[\u0000-\u001f]/.test(name) ? 'validation.nameControl' : null;
}

/** GTIN-8/12/13/14 with a valid GS1 check digit, the same rule as the server. */
export function validateBarcode(value: string): ValidationKey | null {
  const code = value.trim();
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) {
    return 'validation.barcodeFormat';
  }
  let total = 0;
  const body = code.slice(0, -1);
  for (let index = 0; index < body.length; index += 1) {
    const digit = Number(body[body.length - 1 - index]);
    total += digit * (index % 2 === 0 ? 3 : 1);
  }
  return (10 - (total % 10)) % 10 === Number(code[code.length - 1])
    ? null
    : 'validation.barcodeCheckDigit';
}
