import {copyDraft,copyPayload,validateCopyPreview} from '../copying';
import {libraryEntry} from '@/test-fixtures/library';
import {saveDraft} from '@/data/save-draft';
import {storedDraft} from '@/storage/validation';
import {ApiError} from '@/api/errors';
const entry=libraryEntry();
const selection={source_day:'2026-10-13',destination_date:'2026-10-14',timezone_id:'Asia/Jerusalem',sources:[{id:entry.id,version:1}],times:{}};
const preview={preview_token:'a'.repeat(64),destination_populated:true,time_issues:[],drafts:[{...entry.draft,input_method:'copy',local_date:'2026-10-14',occurred_at:'2026-10-14T12:30:00+03:00',timezone_id:'Asia/Jerusalem'}]};
it('copy drafts retain each reviewed meal, selected source and date across persistence; nested/corrupt caches fail',()=>{
 const d=copyDraft(selection,validateCopyPreview(preview), 'persisted-copy-key');
 expect(storedDraft(JSON.parse(JSON.stringify(d)))).toBe(true);
 expect(copyPayload({...d,copy:{...d.copy!,confirmPopulated:true}}).drafts[0].occurred_at).toBe(preview.drafts[0].occurred_at);
 expect(()=>copyPayload(d)).toThrow();
 expect(storedDraft({...d,copy:{...d.copy,meals:[{...d.copy!.meals[0],copy:d.copy}]}})).toBe(false);
});
it('copy save persists retry identity before one atomic request; no canonical per-meal or AI dispatch',async()=>{
 const d=copyDraft(selection,validateCopyPreview(preview),'stable-copy-key1');d.copy!.confirmPopulated=true;
 const order:string[]=[];
 const api={capabilities:async()=>({copy:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),captureSession:()=>()=>{},addMeal:jest.fn(),addCustomMeal:jest.fn(),addCanonicalMeal:jest.fn(),copyMeals:jest.fn(async()=>{order.push('request');throw new ApiError('network');})};
 for(let i=0;i<2;i++)await expect(saveDraft(api,d,async attempted=>{expect(attempted.attempted).toBe(true);order.push('persist');})).rejects.toMatchObject({kind:'network'});
 expect(order).toEqual(['persist','request','persist','request']);expect(api.addCanonicalMeal).not.toHaveBeenCalled();
 expect(api.copyMeals.mock.calls.map(c=>(c as unknown[])[1])).toEqual(['stable-copy-key1','stable-copy-key1']);
});
it('unresolved DST issues cannot become a saveable draft',()=>{
 expect(()=>copyDraft(selection,validateCopyPreview({...preview,drafts:[],time_issues:[{id:entry.id,reason:'ambiguous_time'}]}),'invalid-copy-key')).toThrow();
 expect(()=>validateCopyPreview({...preview,preview_token:'forged'})).toThrow();
});
