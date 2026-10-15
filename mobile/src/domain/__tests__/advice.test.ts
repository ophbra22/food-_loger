import {validateAdvice,validatePreferences,recommendationDraft} from '../advice';
import {libraryEntry} from '@/test-fixtures/library';
const entry=libraryEntry();
const values={energy_kcal:100,protein_g:null,carbs_g:10,fat_g:5,fiber_g:null,sugars_g:null,saturated_fat_g:null,sodium_mg:null};
export const recommendation=()=>({schema_version:1,day:'2026-10-13',language:'en',revision:'a'.repeat(64),preferences:{version:0,allergy_status:'unknown',allergens:[],diets:[]},remaining:{calories:500,protein:40,carbs:null,fat:null},choices:[{entry,servings:1,draft:entry.draft,nutrition:{values,known_totals:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v??0])),partial:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v===null]))},safety_status:'unknown',rationale:'remaining_targets',warnings:['check_ingredients','recorded_nutrition','partial_nutrition']}],warnings:['allergies_unknown'],pool_limit:60,ai_status:'not_requested'});
test('recommendation preserves unknown nutrition, provenance and editable unsaved draft',()=>{
 const value=validateAdvice(recommendation(),'recommendation','2026-10-13','en');
 if(!('choices' in value))throw Error();
 const draft=recommendationDraft(value.choices[0],'draft-request-key');
 expect(draft.origin).toBe('repeat');expect(draft.day).toBe('2026-10-13');
 expect(draft.analysis?.foods[0].originSource?.verified_status).toBe('user_confirmed');
 expect(value.choices[0].nutrition.values.protein_g).toBeNull();
});
test.each(['date','language','negative','status','draft','allergy'])('rejects malformed %s response before display',field=>{
 const v:any=recommendation();
 if(field==='date')v.day='2026-10-12';if(field==='language')v.language='he';if(field==='negative')v.choices[0].nutrition.values.energy_kcal=-1;
 if(field==='status')v.choices[0].safety_status='verified';if(field==='draft')v.choices[0].draft={};if(field==='allergy')v.preferences.allergens=['invented'];
 expect(()=>validateAdvice(v,'recommendation','2026-10-13','en')).toThrow();
});
test('unknown allergies are not rewritten as none; inconsistent preferences rejected',()=>{
 expect(validatePreferences({version:0,allergy_status:'unknown',allergens:[],diets:[]}).allergy_status).toBe('unknown');
 expect(()=>validatePreferences({version:1,allergy_status:'none',allergens:['milk'],diets:[]})).toThrow();
});

test.each(['en','he'] as const)('real HTTP fixture %s validates and keeps exact Trends statistics',language=>{
 const fixture=require('@/test-fixtures/advice.json')[language];
 const insight=validateAdvice(fixture.insight,'insight','2026-10-11',language);
 expect('trends' in insight&&insight.trends.current.statistics.logged_days).toBe(3);
 const rec=validateAdvice(fixture.recommendation,'recommendation','2026-10-14',language);
 if(!('choices' in rec))throw Error();
 expect(rec.choices).toHaveLength(2);expect(rec.remaining.protein).toBe(40);
 expect(rec.choices[0].nutrition.values.energy_kcal).toBe(500);
});
