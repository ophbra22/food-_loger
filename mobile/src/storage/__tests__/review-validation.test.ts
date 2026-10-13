import { storedDraft } from '../validation';
import { toUnifiedReview } from '@/domain/unified-review';
import { manualDraft } from '@/domain/drafts';
test('new persisted editor fields reject invalid runtime types before loading',()=>{
 const d=toUnifiedReview({...manualDraft('key'),name:'Test',amount:'1'});
 expect(storedDraft(d)).toBe(true);
 const mutate=(change:(d:any)=>void)=>{const raw=JSON.parse(JSON.stringify(d));change(raw);expect(storedDraft(raw)).toBe(false);};
 mutate(d=>d.timezoneId=7);
 mutate(d=>d.analysis.foods[0].manual.fiber=7);
 mutate(d=>d.analysis.foods[0].manualOverride='yes');
 mutate(d=>d.analysis.foods[0].product={});
});
