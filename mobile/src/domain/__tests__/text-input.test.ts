import {replaceReference,foodTotals} from '../meal-analysis';
import {textDraft,validateTextResult} from '../text-input';
import {storedDraft} from '@/storage/validation';
import {reviewPayload} from '../unified-review';
import {isDraftValid} from '../drafts';
import {textResult} from '@/test-fixtures/text-input';

it('unknown quantities remain editable and cannot be saved, including persisted voice drafts',()=>{
 const result=textResult();result.foods[0].amount='';result.foods[0].quantity=0.5;result.foods[0].unit='piece';
 const draft=textDraft(validateTextResult(result),'text-retry-key','voice','half a pita',{day:'2026-10-14'});
 expect(draft.analysis?.foods[0].amount).toBe('');expect(isDraftValid(draft)).toBe(false);
 expect(storedDraft(JSON.parse(JSON.stringify(draft)))).toBe(true);
 expect(draft.inputText).toBe('half a pita');expect(()=>reviewPayload(draft)).toThrow();
});
it('confirmed text preserves exact amount and source through the existing canonical save adapter',()=>{
 const draft=textDraft(validateTextResult(textResult()),'text-retry-key','text','100g rice',{day:'2026-10-14'});
 expect(isDraftValid(draft)).toBe(false);
 draft.analysis!.foods[0].confirmed=true;
 const body=reviewPayload(draft);
 expect(body.input_method).toBe('text');expect(body.items[0].portion.normalized_g).toBe(100);
 expect(body.items[0].nutrition_per_100.energy_kcal).toBe(130);
 expect(body.items[0].source.reference_id).toBe('fdc:1');
});
it.each([null,{foods:[]},{...textResult(),foods:[{...textResult().foods[0],amount:'NaN'}]},
 {...textResult(),foods:[{...textResult().foods[0],confirmed:true}]},
 {...textResult(),foods:[{...textResult().foods[0],references:[{}]}]}])('rejects malformed server proposals',value=>expect(()=>validateTextResult(value)).toThrow());

it('generated recurring quantities survive persistence, confirmation, totals and canonical save',()=>{
 const result=textResult();result.foods[0].amount='333.3333333333333333333333333';result.foods[0].quantity=1/3;result.foods[0].unit='kg';
 const draft=textDraft(validateTextResult(result),'fraction-text-key','text','1/3 kg rice',{day:'2026-10-14'});
 expect(storedDraft(JSON.parse(JSON.stringify(draft)))).toBe(true);
 draft.analysis!.foods[0].confirmed=true;
 expect(isDraftValid(draft)).toBe(true);
 expect(foodTotals(draft.analysis!.foods[0]).calories).not.toBeNull();
 expect(reviewPayload(draft).items[0].portion).toMatchObject({quantity:1/3,unit:'kg',normalized_g:Number(result.foods[0].amount)});
});

it('choosing another reference keeps a validated generated metric portion saveable',()=>{
 const result=textResult();result.foods[0].amount='333.3333333333333333333333333';result.foods[0].quantity=1/3;result.foods[0].unit='kg';
 const draft=textDraft(validateTextResult(result),'fraction-source-key','text','1/3 kg rice');
 draft.analysis!.foods[0]=replaceReference(draft.analysis!.foods[0],{...result.foods[0].reference,id:'fdc:2'});
 draft.analysis!.foods[0].confirmed=true;
 expect(isDraftValid(draft)).toBe(true);expect(reviewPayload(draft).items[0].source.reference_id).toBe('fdc:2');
});
