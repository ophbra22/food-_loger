import {correctBasis,reviewPayload} from '../unified-review';
import {draftFromCanonical,libraryDraft,validateCanonicalDraft} from '../library';
import {libraryEntry} from '@/test-fixtures/library';
import {storedDraft} from '@/storage/validation';
import {replaceReference} from '../meal-analysis';
import {saveDraft} from '@/data/save-draft';

test('g to ml to g retains the first source and values without density conversion',()=>{
 const d=draftFromCanonical(libraryEntry().draft,'basis-key','repeat');
 const first=d.analysis!.foods[0];
 first.originSource!.verified_status='legacy_unknown';
 const changed=correctBasis(first,'ml');
 expect(changed.amount).toBe('100');
 expect(changed.manualOverride).toBe(true);
 expect(changed.confirmed).toBe(false);
 expect(changed.originalPortion).toBeUndefined();
 expect(changed.basisCorrection).toMatchObject({original_nutrition_per_100:{basis:'g',energy_kcal:100,protein_g:null},original_source:{provider:'manual',reference_id:'source-id',verified_status:'legacy_unknown'}});
 changed.manual!.calories='120';
 const back=correctBasis(changed,'g');
 expect(back.basisCorrection!.original_nutrition_per_100.energy_kcal).toBe(100);
 d.analysis!.foods=[{...back,confirmed:true}];
 const wire=reviewPayload(d);
 expect(wire.items[0].source.verified_status).toBe('user_confirmed');
 expect(wire.items[0].manual_override).toBe(true);
 expect(wire.items[0].basis_correction).toEqual(back.basisCorrection);
 expect(storedDraft(JSON.parse(JSON.stringify(d)))).toBe(true);
 const round=draftFromCanonical(wire,'round-key','recipe');
 expect(reviewPayload(round).items[0].basis_correction).toEqual(back.basisCorrection);
 const repeated=libraryDraft({...libraryEntry(),draft:wire},'repeat-key',{},2);
 expect(reviewPayload(repeated).items[0].basis_correction).toEqual(back.basisCorrection);
 expect(repeated.analysis!.foods[0].amount).toBe('200');
 const malformed=JSON.parse(JSON.stringify(wire));malformed.items[0].basis_correction.original_nutrition_per_100.basis='kg';
 expect(()=>validateCanonicalDraft(malformed)).toThrow();
 const invalid=JSON.parse(JSON.stringify(d));invalid.analysis.foods[0].basisCorrection.original_source.provider=42;
 expect(storedDraft(invalid)).toBe(false);
});
test('replacing food starts a new source rather than attributing an old correction',()=>{
 const food=correctBasis(draftFromCanonical(libraryEntry().draft,'key','repeat').analysis!.foods[0],'ml');
 const replaced=replaceReference(food,{id:'new',name:'New food',source:'fixture',source_url:'https://example.test',data_type:'test',basis_unit:'g',nutrition:{calories:30,protein:1,carbs:2,fat:2}});
 expect(replaced.basisCorrection).toBeUndefined();
});
test('an unsupported server cannot silently drop corrected provenance',async()=>{
 const draft=draftFromCanonical(libraryEntry().draft,'key','repeat');
 draft.analysis!.foods[0]={...correctBasis(draft.analysis!.foods[0],'ml'),confirmed:true};
 const persisted:unknown[]=[];const sent:unknown[]=[];
 const api={addMeal:jest.fn(),addCustomMeal:jest.fn(),capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),addCanonicalMeal:async(body:unknown)=>{sent.push(body);return [];}};
 await expect(saveDraft(api,draft,async d=>{persisted.push(d);})).rejects.toMatchObject({kind:'unavailable'});
 expect(sent).toEqual([]);expect(persisted).toEqual([]);
});
