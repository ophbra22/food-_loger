import {isDraftValid} from '../drafts';
import {saveDraft} from '@/data/save-draft';
import {recipeForm,recipeBody} from '../recipes';
import {draftFromCanonical,libraryDraft,validateLibraryPage} from '../library';
import {reviewPayload} from '../unified-review';
import {storedDraft} from '@/storage/validation';
import {libraryEntry} from '@/test-fixtures/library';
it('repeat uses a fresh retry key/date, preserves nutrient source and scales exact portions with unknowns',()=>{
 const source=libraryEntry();const before=JSON.stringify(source);
 const draft=libraryDraft(source,'fresh-repeat-key',{day:'2026-10-15'},0.5);
 expect(draft.key).toBe('fresh-repeat-key');expect(storedDraft(draft)).toBe(true);
 const body=reviewPayload(draft);
 expect(body).toMatchObject({input_method:'repeat',local_date:'2026-10-15',occurred_at:null,timezone_id:null});
 expect(body.items[0]).toMatchObject({portion:{normalized_g:50},nutrition_per_100:{energy_kcal:100,protein_g:null},source:{version:'saved-v1'}});
 expect(JSON.stringify(source)).toBe(before);
 expect(()=>libraryDraft(source,'key',{},0)).toThrow();
 expect(()=>libraryDraft(source,'key',{},Infinity)).toThrow();
 expect(()=>libraryDraft(source,'key',{},21)).toThrow();
});
it('recipe yield and selected servings scale each ingredient without mixing g and ml',()=>{
 const source=libraryEntry();source.kind='recipe';source.servings=4;
 const body=reviewPayload(libraryDraft(source,'new-recipe-log',{},2));
 expect(body.input_method).toBe('recipe');expect(body.items[0].portion.normalized_g).toBe(50);
});
it('rejects malformed response or cached item before it can become a draft',()=>{
 expect(validateLibraryPage({items:[libraryEntry()],next_offset:null}).items).toHaveLength(1);
 const source=libraryEntry();source.draft.items[0].portion.normalized_g=Infinity;
 expect(()=>validateLibraryPage({items:[source],next_offset:null})).toThrow();
 expect(()=>validateLibraryPage({items:[],next_offset:-1})).toThrow();
});
it('generated recurring fractions retain precision through persisted draft, preview and save payload',async()=>{

 const source=libraryEntry();source.kind='recipe';source.servings=3;
 const draft=JSON.parse(JSON.stringify(libraryDraft(source,'third-serving-retry')));
 expect(storedDraft(draft)).toBe(true);expect(isDraftValid(draft)).toBe(true);
 const body=reviewPayload(draft);expect(body.items[0].portion.normalized_g).toBeCloseTo(100/3,12);
 const addCanonicalMeal=jest.fn(async(_body:import('../canonical').MealDraft,_key:string)=>[]);
 await saveDraft({addMeal:jest.fn(),addCustomMeal:jest.fn(),addCanonicalMeal,capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true})},draft,async()=>{});
 expect(addCanonicalMeal.mock.calls[0][0]).toEqual(body);
});
it('unchanged/scaled recipe, repeat and copy retain original household portion and estimation provenance',async()=>{

 const source=libraryEntry();const portion={quantity:1,unit:'bowl',normalized_g:100,estimated:true,food_specific_conversion_id:'bowl-v1'};source.draft.items[0].portion=portion;
 const repeat=libraryDraft(source,'portion-repeat-key');expect(reviewPayload(repeat).items[0].portion).toEqual(portion);
 expect(storedDraft(JSON.parse(JSON.stringify(repeat)))).toBe(true);
 expect(reviewPayload(libraryDraft(source,'portion-scaled-key',{},0.5)).items[0].portion).toEqual({...portion,quantity:0.5,normalized_g:50});
 expect(reviewPayload(draftFromCanonical({...source.draft,input_method:'copy'},'portion-copy-key','copy')).items[0].portion).toEqual(portion);
 expect(recipeBody(recipeForm({...source,kind:'recipe'},'portion-recipe-key')).items[0].portion).toEqual(portion);
 repeat.analysis!.foods[0].amount='50';expect(reviewPayload(repeat).items[0].portion).toMatchObject({quantity:0.5,unit:'bowl',normalized_g:50,estimated:true,food_specific_conversion_id:'bowl-v1'});
 const malformed=JSON.parse(JSON.stringify(repeat));malformed.analysis.foods[0].originalPortion={...portion,normalized_g:'invalid'};expect(storedDraft(malformed)).toBe(false);
});
