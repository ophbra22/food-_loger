import {libraryDraft,validateLibraryPage} from '../library';
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
