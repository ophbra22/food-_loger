import AsyncStorage from '@react-native-async-storage/async-storage';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {GoalSettings} from '../GoalSettings';
import {GoalsStore} from '@/data/goals-store';
import {I18nProvider} from '@/i18n/I18nProvider';
import {document,first} from '@/test-fixtures/goals';
import {ApiError} from '@/api/errors';
import {openAccountStorage} from '@/storage/kv';
import type {GoalUpdate,GoalDocument} from '@/domain/goals';
import {todayIso,addDays} from '@/domain/dates';
beforeEach(async()=>{await AsyncStorage.clear();});
const current={...document,revisions:[{...first,effective_local_date:todayIso()}]};
function store(putGoals:(v:GoalUpdate)=>Promise<GoalDocument>) {
 openAccountStorage('alice');return new GoalsStore('alice',{getGoals:async()=>current,putGoals,capabilities:async()=>({goals:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true})});
}
it('saves explicit tomorrow targets without changing entered values when macro energy mismatches',async()=>{
 const requests:GoalUpdate[]=[];
 const goals=store(async body=>{requests.push(body);return {version:2,revisions:[current.revisions[0],{...first,...body,id:'b'.repeat(32),version:2,warnings:['energy_macro_mismatch']}]};});
 await render(<I18nProvider initial="en"><GoalSettings store={goals}/></I18nProvider>);
 await screen.findByTestId('goal-calorie_target');
 await fireEvent.changeText(screen.getByTestId('goal-calorie_target'),'5000');
 await fireEvent.changeText(screen.getByTestId('goal-date'),addDays(todayIso(),1));
 expect(screen.getByText(/Macro energy differs/)).toBeTruthy();
 await fireEvent.press(screen.getByTestId('save-goals'));
 await waitFor(()=>expect(requests).toHaveLength(1));
 expect(requests[0]).toMatchObject({calorie_target:5000,protein_g:150,effective_local_date:addDays(todayIso(),1),expected_version:1,allow_past:false});
 expect(await screen.findByText('Goals saved.')).toBeTruthy();
});
it('failure shows rollback and refresh guidance while retaining the editable inputs',async()=>{
 const goals=store(async()=>{throw new ApiError('network');});
 await render(<I18nProvider initial="en"><GoalSettings store={goals}/></I18nProvider>);
 await screen.findByTestId('goal-protein_g');
 await fireEvent.changeText(screen.getByTestId('goal-protein_g'),'160');
 await fireEvent.press(screen.getByTestId('save-goals'));
 expect(await screen.findByText(/Targets on this device were restored/)).toBeTruthy();
 expect(screen.getByTestId('goal-protein_g').props.value).toBe('160');
 expect(screen.getByTestId('save-goals').props.accessibilityState.disabled).toBe(true);
});
it('Hebrew form requires explicit historical confirmation and validates target bounds',async()=>{
 const put=jest.fn(async()=>document);const goals=store(put);
 await render(<I18nProvider initial="he"><GoalSettings store={goals}/></I18nProvider>);
 await screen.findByTestId('goal-date');
 await fireEvent.changeText(screen.getByTestId('goal-date'),'2020-01-01');
 expect(screen.getByTestId('save-goals').props.accessibilityState.disabled).toBe(true);
 await fireEvent(screen.getByTestId('goal-allow-past'),'valueChange',true);
 expect(screen.getByTestId('save-goals').props.accessibilityState.disabled).toBe(false);
 await fireEvent.changeText(screen.getByTestId('goal-water_ml'),'0');
 expect(screen.getByTestId('save-goals').props.accessibilityState.disabled).toBe(true);
 expect(put).not.toHaveBeenCalled();
});
it('disabled capability exposes no editable form',async()=>{
 const goals=new GoalsStore('alice',{capabilities:async()=>({goals:false,canonical_writes:false,partial_core_writes:false,tiny_portion_writes:false}),getGoals:async()=>document});
 await render(<I18nProvider initial="en"><GoalSettings store={goals}/></I18nProvider>);
 expect(await screen.findByText('Goals are not enabled on this server.')).toBeTruthy();
 expect(screen.queryByTestId('save-goals')).toBeNull();
 await act(()=>goals.close());
});

it('locks the selected date and inputs during reload so a delayed answer cannot replace another date',async()=>{
 let finish!:(value:GoalDocument)=>void;let delayed=false;
 const today=current.revisions[0],tomorrow={...first,id:'b'.repeat(32),version:2,effective_local_date:addDays(todayIso(),1),calorie_target:2500};
 const doc={version:2,revisions:[today,tomorrow]};openAccountStorage('alice');
 const goals=new GoalsStore('alice',{getGoals:()=>delayed?new Promise(resolve=>{finish=resolve;}):Promise.resolve(doc),putGoals:async()=>doc,capabilities:async()=>({goals:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true})});
 await render(<I18nProvider initial="en"><GoalSettings store={goals}/></I18nProvider>);
 await screen.findByTestId('goal-date');
 await fireEvent.changeText(screen.getByTestId('goal-date'),tomorrow.effective_local_date);
 delayed=true;await fireEvent.press(screen.getByText('Reload targets for this date'));
 expect(screen.getByTestId('goal-date').props.editable).toBe(false);
 expect(screen.getByTestId('goal-calorie_target').props.editable).toBe(false);
 expect(screen.getByTestId('save-goals').props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(screen.getByTestId('goal-date'),todayIso());
 await fireEvent.changeText(screen.getByTestId('goal-calorie_target'),'999');
 await act(()=>finish(doc));
 expect(screen.getByTestId('goal-date').props.value).toBe(tomorrow.effective_local_date);
 expect(screen.getByTestId('goal-calorie_target').props.value).toBe('2500');
 expect(screen.getByTestId('goal-date').props.editable).toBe(true);
});
