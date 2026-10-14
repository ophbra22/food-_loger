import {labelDraft,validateLabelResult,privateProductDraft,validatePrivateProduct} from '../label-input';
import {reviewPayload} from '../unified-review';
import {storedDraft} from '@/storage/validation';
import {emptyNutrition} from '../nutrition';
const result={confirmed:false,warnings:['uncertain_field:protein'],observations:{columns:[]},product:{barcode:'',name:'מוצר',brand:null,quantity:null,basis_unit:'ml',serving_quantity:200,nutrition:{...emptyNutrition(),calories:50},source:'label',source_url:'',raw_nutriments:{label_observations:'raw dual basis'},nutriment_units:{},missing_nutrients:['protein'],notes:['Review']}};
test('label proposals stay editable and unsaved and preserve evidence into canonical review',()=>{
 const d=labelDraft('key',validateLabelResult(result),{day:'2026-10-14',mealType:'lunch'});
 expect(d.origin).toBe('label');expect(storedDraft(d)).toBe(true);
 expect(d.analysis!.foods[0].confirmed).toBe(false);expect(d.analysis!.foods[0].amount).toBe('');
 expect(()=>reviewPayload(d)).toThrow();
 d.analysis!.foods[0].amount='50';d.analysis!.foods[0].confirmed=true;
 const body=reviewPayload(d);expect(body.input_method).toBe('label');expect(body.items[0].nutrition_per_100.protein_g).toBeNull();
 expect(body.items[0].label_metadata?.rawNutriments.label_observations).toBe('raw dual basis');
 const privateProduct=validatePrivateProduct({id:'a'.repeat(32),version:1,item:body.items[0],created_at:'2026-10-14'});
 const again=privateProductDraft(privateProduct,'next',{day:'2026-10-15'});
 expect(again.analysis!.foods[0].amount).toBe('');expect(again.analysis!.foods[0].confirmed).toBe(false);
 expect(again.analysis!.foods[0].originSource?.reference_id).toBe(privateProduct.id);
});
test('malformed result and invalid private nutrition fail before review',()=>{
 expect(()=>validateLabelResult({...result,confirmed:true})).toThrow();
 expect(()=>validateLabelResult({...result,product:{...result.product,nutrition:{...result.product.nutrition,calories:Infinity}}})).toThrow();
 expect(()=>validatePrivateProduct({id:'a'.repeat(32),version:1,item:{}})).toThrow();
});
