import fixture from '@/test-fixtures/trends.json';
import {displayValue,normalizeValue,measurementContext,validateMeasurement} from '../tracking';
import {periodDates,validateTrends} from '../trends';

test('unit switches are display-only and return to the same stored value',()=>{
 expect(displayValue(70,'lb')).toBeCloseTo(154.3235835294,8);
 expect(normalizeValue(displayValue(70,'lb'),'lb')).toBeCloseTo(70,12);
 expect(displayValue(250,'fl oz')).toBeCloseTo(8.453505675,8);
 expect(normalizeValue(1,'fl oz')).toBe(29.5735295625);
 expect(()=>normalizeValue(0,'kg')).toThrow();
});
test('Sunday week and month navigation preserve dates across DST and leap years',()=>{
 expect(periodDates('2026-10-14','week')).toEqual({from:'2026-10-11',to:'2026-10-17'});
 expect(periodDates('2024-02-29','month')).toEqual({from:'2024-02-01',to:'2024-02-29'});
});
test('measurement context requires explicit timezone offset and local date agreement',()=>{
 expect(measurementContext('2026-10-11T09:00:00+03:00','Asia/Jerusalem')).toEqual({occurred_at:'2026-10-11T09:00:00+03:00',timezone_id:'Asia/Jerusalem',local_date:'2026-10-11'});
 expect(()=>measurementContext('2026-10-11T09:00:00+02:00','Asia/Jerusalem')).toThrow();
 expect(()=>measurementContext('2026-10-11T09:00:00','Asia/Jerusalem')).toThrow();
});
test('untrusted measurement and trend response cannot introduce false zero/NaN data',()=>{
 expect(()=>validateMeasurement({value:NaN},'weight')).toThrow();
 expect(()=>validateTrends({schema_version:1,current:{days:[]}},'2026-10-11','2026-10-17')).toThrow();
});

it.each(['calorie_target','protein_g','carbs_g','fat_g','water_ml','target_weight_kg'])('rejects nested malformed chart target %s in otherwise valid response',field=>{
 const response=JSON.parse(JSON.stringify(fixture));response.current.days[0].targets={calorie_target:null,protein_g:null,carbs_g:null,fat_g:null,water_ml:null,target_weight_kg:null,[field]:'bad'};
 expect(()=>validateTrends(response,response.current.from,response.current.to)).toThrow();
});
it.each(['water_sources','weight_source','nutrition_sources','partial','known_totals'])('rejects malformed nested trend field %s',field=>{
 const response=JSON.parse(JSON.stringify(fixture));response.current.days[0][field]=field.endsWith('sources')?[{}]:field.endsWith('source')?{}:{};
 expect(()=>validateTrends(response,response.current.from,response.current.to)).toThrow();
});
test('accepts valid backend trend response and nullable targets',()=>{
 expect(validateTrends(fixture,fixture.current.from,fixture.current.to)).toEqual(fixture);
});
