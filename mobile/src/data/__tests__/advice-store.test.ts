import {AdviceStore} from '../advice-store';
const caps={canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,insights:true,recommendations:true,wording:true};
const doc=(n:number)=>({revision:String(n),sentences:[]}) as any;
test('correction invalidates response in flight and reloads active review',async()=>{
 let resolve!:(v:any)=>void,n=0;
 const store=new AdviceStore({capabilities:async()=>caps,advice:()=>++n===1?new Promise(r=>{resolve=r;}):Promise.resolve(doc(n))});
 store.subscribe(()=>{});const first=store.load('insight','2026-10-11','en');await Promise.resolve();store.invalidate();await new Promise(r=>setTimeout(r,0));
 resolve(doc(1));await first;expect(store.get('insight','2026-10-11','en').data?.revision).toBe('2');
 store.close();expect(store.get('insight','2026-10-11','en').data).toBeNull();
});
test('account close prevents late wording response; outage keeps template but blocks stale selection',async()=>{
 let resolve!:(v:any)=>void;
 const api={capabilities:async()=>caps,advice:jest.fn().mockResolvedValue(doc(1)),wording:()=>new Promise<any>(r=>{resolve=r;})};
 const store=new AdviceStore(api);await store.load('insight','2026-10-11','en');
 api.advice.mockRejectedValueOnce(Error('offline'));await store.load('insight','2026-10-11','en');
 expect(store.get('insight','2026-10-11','en').fresh).toBe(false);expect(store.get('insight','2026-10-11','en').data?.revision).toBe('1');
 await store.load('insight','2026-10-11','en');const pending=store.enhance('insight','2026-10-11','en','wording-request-key');store.close();resolve(doc(2));await pending;
 expect(store.get('insight','2026-10-11','en').data).toBeNull();
});
