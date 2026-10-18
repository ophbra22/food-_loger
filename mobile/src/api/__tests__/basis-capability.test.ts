import {createApi} from '../endpoints';
import type {ApiClient} from '../client';
import {libraryEntry} from '@/test-fixtures/library';

test.each(['meal','private','recipe','copy'])('%s refuses a correction on a server without its reader',async(kind)=>{
 const calls:string[]=[];
 const request=async(path:string)=>{calls.push(path);return {};};
 const api=createApi({request,captureSession:()=>()=>{}} as unknown as ApiClient);
 const draft=libraryEntry().draft,item=draft.items[0];
 item.manual_override=true;item.basis_correction={original_source:{...item.source},original_nutrition_per_100:{...item.nutrition_per_100}};
 const work=()=>kind==='meal'?api.addCanonicalMeal(draft,'key'):kind==='private'?api.savePrivateProduct('a'.repeat(32),item,0,'key'):kind==='recipe'?api.saveRecipe(null,{name:'test',servings:1,items:[item]},'key'):api.copyMeals({drafts:[draft]} as never,'key');
 await expect(work()).rejects.toMatchObject({kind:'unavailable'});
 expect(calls).toEqual(['/api/capabilities']);
});
