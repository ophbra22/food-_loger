import {
  cleanRecoveryCode,
  inputsToNutrition,
  nutritionToInputs,
  parseDecimal,
  validateAmount,
  validateBarcode,
  validateFoodName,
  validateNutrient,
  validatePassword,
  validateRecoveryCode,
  validateUsername,
} from '../validation';
import { emptyNutrition } from '../nutrition';

describe('parseDecimal', () => {
  it('accepts dot and comma decimals', () => {
    expect(parseDecimal('150')).toBe(150);
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal(' 0 ')).toBe(0);
    expect(parseDecimal('.5')).toBe(0.5);
  });
  it('treats an empty field as missing, not zero', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });
  it('ignores direction marks added by right-to-left keyboards', () => {
    expect(parseDecimal('‏150‎')).toBe(150);
  });
  it('rejects text that is not a plain number', () => {
    for (const text of ['abc', '1e3', '-5', '1.2.3', '1,000.5', '12g', '٣']) {
      expect(parseDecimal(text)).toBeNaN();
    }
  });
});

describe('amount', () => {
  it('allows 1 to 2000 like the server', () => {
    expect(validateAmount('1')).toBeNull();
    expect(validateAmount('2000')).toBeNull();
    expect(validateAmount('0.5')).toBe('validation.amountRange');
    expect(validateAmount('2000.1')).toBe('validation.amountRange');
    expect(validateAmount('0')).toBe('validation.amountRange');
  });
  it('requires a value and a real number', () => {
    expect(validateAmount('')).toBe('validation.required');
    expect(validateAmount('lots')).toBe('validation.numberInvalid');
  });
});

describe('nutrients', () => {
  it('requires the four core values but accepts zero', () => {
    expect(validateNutrient('protein', '')).toBe('validation.required');
    expect(validateNutrient('protein', '0')).toBeNull();
    expect(validateNutrient('fat', '100')).toBeNull();
    expect(validateNutrient('fat', '100.1')).toBe('validation.nutrientRange');
    expect(validateNutrient('calories', '900')).toBeNull();
    expect(validateNutrient('calories', '1001')).toBe('validation.caloriesRange');
  });
  it('lets optional values stay empty', () => {
    expect(validateNutrient('fiber', '')).toBeNull();
    expect(validateNutrient('salt', 'x')).toBe('validation.numberInvalid');
  });
  it('keeps missing and zero apart when converting to and from input text', () => {
    const per100 = { ...emptyNutrition(), calories: 46, protein: 0, carbs: 6.7, fat: 1.5 };
    const inputs = nutritionToInputs(per100);
    expect(inputs.protein).toBe('0');
    expect(inputs.sugars).toBe('');
    const back = inputsToNutrition(inputs);
    expect(back.protein).toBe(0);
    expect(back.sugars).toBeNull();
    expect(back).toEqual(per100);
  });
});

describe('account fields', () => {
  it('matches the server username and password rules', () => {
    expect(validateUsername('ab')).toBe('validation.usernameFormat');
    expect(validateUsername('good_name-1')).toBeNull();
    expect(validateUsername('  alice  ')).toBeNull();
    expect(validateUsername('אליס')).toBe('validation.usernameFormat');
    expect(validateUsername('a'.repeat(33))).toBe('validation.usernameFormat');
    expect(validatePassword('short')).toBe('validation.passwordLength');
    expect(validatePassword('x'.repeat(12))).toBeNull();
    expect(validatePassword('x'.repeat(129))).toBe('validation.passwordLength');
  });
  it('accepts a 43-character recovery code pasted with spaces or line breaks', () => {
    const code = 'A'.repeat(20) + '_-' + 'b'.repeat(21);
    expect(validateRecoveryCode(code)).toBeNull();
    expect(validateRecoveryCode(` ${code.slice(0, 20)}\n${code.slice(20)} `)).toBeNull();
    expect(cleanRecoveryCode(` ${code} `)).toBe(code);
    expect(validateRecoveryCode(code.slice(1))).toBe('validation.recoveryFormat');
    expect(validateRecoveryCode(code.replace('_', '!'))).toBe('validation.recoveryFormat');
  });
});

describe('food name', () => {
  it('needs 1 to 120 visible characters', () => {
    expect(validateFoodName('  ')).toBe('validation.nameRequired');
    expect(validateFoodName('חומוס')).toBeNull();
    expect(validateFoodName('x'.repeat(121))).toBe('validation.nameTooLong');
    expect(validateFoodName('a\u0007b')).toBe('validation.nameControl');
  });
});

describe('barcode', () => {
  it('accepts valid GTIN-8, 12, 13 and 14', () => {
    for (const code of ['96385074', '036000291452', '4006381333931', '7290000066318', '10012345678902']) {
      expect(validateBarcode(code)).toBeNull();
    }
  });
  it('rejects wrong lengths, letters and bad check digits', () => {
    expect(validateBarcode('12345')).toBe('validation.barcodeFormat');
    expect(validateBarcode('40063813339a1')).toBe('validation.barcodeFormat');
    expect(validateBarcode('4006381333932')).toBe('validation.barcodeCheckDigit');
  });
});
