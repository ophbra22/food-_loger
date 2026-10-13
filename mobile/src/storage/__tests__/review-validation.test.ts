import { emptyNutrition } from '@/domain/nutrition';
import { storedDraft } from '../validation';
import { toUnifiedReview } from '@/domain/unified-review';
import { manualDraft, productDraft } from '@/domain/drafts';
test('new persisted editor fields reject invalid runtime types before loading',()=>{
 const d=toUnifiedReview({...manualDraft('key'),name:'Test',amount:'1'});
 expect(storedDraft(d)).toBe(true);
 const mutate=(change:(d:any)=>void)=>{const raw=JSON.parse(JSON.stringify(d));change(raw);expect(storedDraft(raw)).toBe(false);};
 mutate(d=>d.timezoneId=7);
 mutate(d=>d.analysis.foods[0].manual.fiber=7);
 mutate(d=>d.analysis.foods[0].manualOverride='yes');
 mutate(d=>d.analysis.foods[0].product={});
});

test('signed raw product metadata survives old and upgraded draft hydration',()=>{
 const product={barcode:'12345670',name:'Fixture',brand:null,quantity:null,basis_unit:'g' as const,serving_quantity:null,nutrition:emptyNutrition(),raw_nutriments:{'nutrition-score-fr_100g':-2},source_url:'https://world.openfoodfacts.org',missing_nutrients:[],notes:[]};
 const legacy=productDraft('metadata',product);
 expect(storedDraft(legacy)).toBe(true);
 expect(storedDraft(toUnifiedReview(legacy))).toBe(true);
});
