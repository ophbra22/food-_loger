import { toUnifiedReview, reviewPayload } from '../unified-review';
import { manualDraft, catalogDraft, productDraft } from '../drafts';
import { emptyNutrition } from '../nutrition';
import { foodTotals, mealTotals, analysisValid } from '../meal-analysis';

const seed={day:'2026-10-13',mealType:'lunch' as const};
const food={id:'test',name:'Fixture',emoji:'',category:'test',calories:1.4,protein:0,carbs:0,fat:0};
test('catalog, label and manual normalize to equivalent nutrient snapshots without rounding',()=>{
 const manual={...manualDraft('key',seed),name:food.name,amount:'0.1',nutrition:{...manualDraft('key').nutrition,calories:'1.4',protein:'0',carbs:'0',fat:'0'}};
 const catalog={...catalogDraft('key','test','catalog',seed),amount:'0.1'};
 const label={...productDraft('key',{barcode:'12345670',name:food.name,brand:null,quantity:null,basis_unit:'g',serving_quantity:null,nutrition:{...emptyNutrition(),...food},raw_nutriments:{},source_url:'https://world.openfoodfacts.org/',missing_nutrients:[],notes:[]},seed),amount:'0.1'};
 const drafts=[toUnifiedReview(manual),toUnifiedReview(catalog,food),toUnifiedReview(label)];
 drafts.forEach(d=>d.analysis!.foods.forEach(f=>{f.confirmed=true;}));
 const payloads=drafts.map(reviewPayload);
 expect(payloads[0].items[0].nutrition_per_100).toEqual(payloads[1].items[0].nutrition_per_100);
 expect(payloads[0].items[0].nutrition_per_100).toEqual(payloads[2].items[0].nutrition_per_100);
 expect(foodTotals(drafts[0].analysis!.foods[0]).calories).toBe(0.0014);
 expect(mealTotals([drafts[0].analysis!.foods[0],drafts[0].analysis!.foods[0]]).calories).toBe(0.0028);
});
test('partial confirmed values stay null; invalid typed values and empty meals cannot save',()=>{
 const d=toUnifiedReview({...manualDraft('key',seed),name:'Unknown',amount:'0.5'});
 d.analysis!.foods[0].confirmed=true;
 expect(analysisValid(d.analysis!)).toBe(true);
 expect(reviewPayload(d).items[0].nutrition_per_100.protein_g).toBeNull();
 d.analysis!.foods[0].manual!.protein='bad';
 expect(analysisValid(d.analysis!)).toBe(false);
 d.analysis!.foods=[];
 expect(analysisValid(d.analysis!)).toBe(false);
});
test('adapting an attempted legacy draft must preserve its retry wire format',()=>{
 const d={...manualDraft('key',seed),attempted:true};
 expect(toUnifiedReview(d)).toBe(d);
});

test('photo three-item draft reaches the same facade and keeps ambiguity and unknowns',()=>{
 const d=manualDraft('photo-key',seed);
 const {analysisFromResult}=require('../meal-analysis');
 const {analysisResponse}=require('@/api/response-validation');
 const result={schema_version:1,analysis_id:'mock-analysis',meal_name:'Three foods',provider:'mock',model:'offline',status:'uncertain',warnings:['hidden_ingredients'],
  foods:['Rice','Chicken','Unknown sauce'].map((name,i)=>({id:String(i),name,region:'plate',estimated_weight_g:100,weight_min_g:50,weight_max_g:150,confidence:'low',question:i===2?'What sauce?':null,reference:null,reference_alternatives:[],alternatives:[]}))};
 const upgraded=toUnifiedReview({...d,origin:'photo',analysis:analysisFromResult(analysisResponse(result))});
 // Explicitly accept unknown values through manual confirmation; no automatic journal write.
 upgraded.analysis!.foods.forEach(f=>{f.manual={calories:'',protein:'',carbs:'',fat:''};f.confirmed=true;});
 const body=reviewPayload(upgraded);
 expect(body.items).toHaveLength(3);
 expect(body.items[2].warnings).toContain('What sauce?');
 expect(body.items[2].nutrition_per_100.energy_kcal).toBeNull();
 expect(body.input_method).toBe('image');
});
