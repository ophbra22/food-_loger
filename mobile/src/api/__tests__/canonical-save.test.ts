import { saveDraft } from '@/data/save-draft';
import { manualDraft } from '@/domain/drafts';
import { toUnifiedReview } from '@/domain/unified-review';
import { analysisResponse, productResponse, dayResponse } from '../response-validation';
import { ApiError } from '../errors';
test('canonical lost response retains one wire identity and persistence precedes dispatch',async()=>{
 const d=toUnifiedReview({...manualDraft('retry-key'),name:'Partial',amount:'0.1'});
 d.analysis!.foods[0].confirmed=true;
 const calls:string[]=[];
 const api={addMeal:jest.fn(),addCustomMeal:jest.fn(),capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),
   addCanonicalMeal:jest.fn(async()=>{calls.push('send');throw new ApiError('network');})};
 let saved=d;
 const persist=async(value:typeof d)=>{calls.push('persist');saved=value;};
 await expect(saveDraft(api,d,persist)).rejects.toMatchObject({kind:'network'});
 await expect(saveDraft(api,saved,persist)).rejects.toMatchObject({kind:'network'});
 expect(calls).toEqual(['persist','send','persist','send']);
 expect(api.addCanonicalMeal.mock.calls[0]).toEqual(api.addCanonicalMeal.mock.calls[1]);
 expect(api.addCustomMeal).not.toHaveBeenCalled();
});
test('malformed upstream payloads fail before an editor or journal can use them',()=>{
 expect(()=>analysisResponse({foods:[{}]})).toThrow();
 expect(()=>productResponse({nutrition:{protein:'10'}})).toThrow();
 expect(()=>dayResponse({day:'2026-10-13',meals:[{}],summary:{}},'2026-10-13')).toThrow();
});
