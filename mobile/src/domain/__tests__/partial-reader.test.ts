import { summarize } from '@/data/journal-store';
import { dayResponse } from '@/api/response-validation';
import type { Meal } from '@/api/types';
import { dialMinutes, consumedAt, dotRadius } from '../dial';
const item={id:'id',day:'2026-10-13',meal_type:'lunch',food_id:'custom',name:'Partial',emoji:'',grams:0.1,calories:0.0014,protein:null,carbs:0,fat:0,created_at:'2026-10-13T12:00:00Z',details:{}} as Meal;
test('journal summary retains partial values and exact known subtotal',()=>{
 const result=summarize([item,{...item,id:'b',protein:1.5}]);
 expect(result.protein).toBeNull();
 expect(result.known_totals?.protein).toBe(1.5);
 expect(result.calories).toBe(0.0028);
 expect(result.partial?.protein).toBe(true);
 expect(dayResponse({day:item.day,meals:[item],summary:result},item.day).meals[0].protein).toBeNull();
 expect(dotRadius(null)).toBe(7);
});

test('canonical consumption time is shown on the dial in the assigned zone, not save time',()=>{
 const meal={...item,created_at:'2026-10-13T20:00:00Z',details:{schema_version:'2',occurred_at:'2026-10-13T08:30:00+03:00',timezone_id:'Asia/Jerusalem'}};
 expect(dialMinutes(meal)).toBe(510);
 expect(consumedAt(meal)).toBe(meal.details.occurred_at);
 expect(consumedAt({...meal,details:{schema_version:'2'}})).toBeNull();
});
