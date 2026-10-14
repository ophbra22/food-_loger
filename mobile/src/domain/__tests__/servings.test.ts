import {applyServing,validServings} from '../servings';
import {newReviewFood,foodTotals,replaceReference} from '../meal-analysis';
const reference={id:'fdc:174915',source_version:'v1',name:'Pita',source:'USDA',source_url:'https://fdc.nal.usda.gov/',basis_unit:'g' as const,data_type:'SR',nutrition:{calories:200,protein:5,carbs:20,fat:1}};
const row={id:'pita-large',food_id:reference.id,source_version:'v1',unit:'large',label:'large pita',basis:'g' as const,amount:60,confidence:'source_reported',evidence:{source_url:reference.source_url}};
test('selected half pita stores original quantity and exact totals and resets on replacement',()=>{
 const food={...newReviewFood('x'),reference,name:'Pita',confirmed:true};
 const half=applyServing(food,row,'0.5');
 expect(half.amount).toBe('30'); expect(foodTotals(half).calories).toBe(60);
 expect(half.confirmed).toBe(false); expect(half.originalPortion?.quantity).toBe(0.5);
 expect(half.originalPortion?.food_specific_conversion_id).toBe('pita-large');
 expect(applyServing(half,row,'2').amount).toBe('120');
 expect(replaceReference(half,{...reference,id:'another'}).originalPortion).toBeUndefined();
 for(const r of [{...row,food_id:'another'},{...row,source_version:'v2'},{...row,basis:'ml' as const}]) expect(()=>applyServing(food,r,'1')).toThrow();
 for(const q of ['0','-1','NaN','4000']) expect(()=>applyServing(food,row,q)).toThrow();
});
test('conversion response rejects unknown/nonfinite/bounds and oversized data',()=>{
 expect(validServings({conversions:[row]})).toBe(true);
 for(const r of [{...row,amount:Infinity},{...row,amount:-1},{...row,food_id:''},{...row,label:'x'.repeat(41)},{...row,evidence:null}]) expect(validServings({conversions:[r]})).toBe(false);
});
