import { effectiveGoal, goalProgress, validateGoalDocument, parseGoalForm, goalWarnings } from '../goals';

import warningCases from '@/test-fixtures/goal-warning-cases.json';
import {values,first,document} from '@/test-fixtures/goals';

it('selects the effective date then latest revision without rewriting yesterday',()=>{
 const doc={version:3,revisions:[first,{...first,id:'b'.repeat(32),version:2,effective_local_date:'2026-10-15',calorie_target:2500},{...first,id:'c'.repeat(32),version:3,protein_g:160}]};
 expect(effectiveGoal(doc,'2026-10-13')).toBeNull();
 expect(effectiveGoal(doc,'2026-10-14')?.protein_g).toBe(160);
 expect(effectiveGoal(doc,'2026-10-15')?.calorie_target).toBe(2500);
});
it('uses inclusive calorie bands and protein >=100%, without treating low carbs as failure',()=>{
 const summary={count:1,calories:2070,protein:150,carbs:100,fat:80};
 const p=goalProgress(summary,first);
 expect(p.calories).toEqual({consumed:2070,known_total:2070,target:2300,remaining:230,percent:90,status:'in_range'});
 expect(p.protein.status).toBe('met');expect(p.carbs.status).toBe('below_target');expect(p.fat.status).toBe('above_target');
 expect(goalProgress({...summary,calories:2530},first).calories.status).toBe('in_range');
 expect(goalProgress({...summary,calories:2530.01},first).calories.status).toBe('above_range');
 expect(goalProgress(summary,{...first,calorie_min_percent:95}).calories.status).toBe('below_range');
});
it('keeps unknowns and known subtotals distinct, empty days unlogged, and hydration untracked',()=>{
 const summary={count:2,calories:null,protein:150,carbs:100,fat:80,known_totals:{calories:300,protein:150,carbs:100,fat:80}};
 expect(goalProgress(summary,first).calories).toMatchObject({consumed:null,known_total:300,percent:null,remaining:null,status:'partial'});
 expect(goalProgress(summary,null).calories.status).toBe('no_goal');
 expect(goalProgress({...summary,count:0,calories:0},first).calories.status).toBe('unlogged');
 expect(goalProgress(summary,first).water).toMatchObject({consumed:null,remaining:null,status:'untracked'});
});
it('rejects corrupt goal history rather than coercing impossible values',()=>{
 expect(validateGoalDocument(document)).toEqual(document);
 for(const doc of [{version:1,revisions:[]},{version:1,revisions:[{...first,protein_g:NaN}]},{version:1,revisions:[{...first,calorie_target:0}]},{version:1,revisions:[{...first,effective_local_date:'2026-02-30'}]},{version:2,revisions:[first,first]}])expect(()=>validateGoalDocument(doc)).toThrow();
});
it('parses blank targets as unset and flags invalid input without overriding user numbers',()=>{
 const form=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v===null?'':String(v)]));
 expect(parseGoalForm(form)).toEqual(values);
 expect(parseGoalForm({...form,water_ml:''})?.water_ml).toBeNull();
 expect(parseGoalForm({...form,protein_g:'0'})).toBeNull();
 expect(parseGoalForm({...form,carbs_g:'1e3'})).toBeNull();
 expect(parseGoalForm({...form,calorie_target:'5000'})?.calorie_target).toBe(5000);
});

it('rejects near-zero targets that could overflow progress',()=>{
 for(const k of ['calorie_target','protein_g','carbs_g','fat_g','water_ml','target_weight_kg']) {
  expect(()=>validateGoalDocument({version:1,revisions:[{...first,[k]:1e-308}]})).toThrow();
 }
});

// Hand-calculated: 220 / 180 kcal and 220.11 / 180.09 kcal are exactly ±10%.
// The same literals exercise the Python API; no implementation-derived oracle.
it.each(warningCases)('strict macro warning: $name', (testCase)=>{
 const {calorie_target,protein_g,carbs_g,fat_g,warning}=testCase;
 const goal=Object.freeze({...values,calorie_target,protein_g,carbs_g,fat_g});
 expect(goalWarnings(goal)).toEqual(warning?['energy_macro_mismatch']:[]);
 expect(goal.calorie_target).toBe(testCase.calorie_target);
});
