import {fireEvent,render,screen} from '@testing-library/react-native';
import {GoalDashboard} from '../GoalDashboard';
import {DayDial} from '../DayDial';
import {I18nProvider} from '@/i18n/I18nProvider';
import {first} from '@/test-fixtures/goals';
import {goalProgress} from '@/domain/goals';
import type {Meal} from '@/api/types';
const summary={count:1,calories:2300,protein:150,carbs:200,fat:70};
it.each(['en','he'] as const)('exposes progress, targets and actual status in %s without an overall completeness score',async language=>{
 await render(<I18nProvider initial={language}><GoalDashboard summary={summary} goal={first} onEdit={()=>{}}/></I18nProvider>);
 expect(screen.getByTestId('goal-progress-protein').props.accessibilityValue).toMatchObject({now:100});
 expect(screen.getByTestId('goal-progress-carbs').props.accessibilityValue).toMatchObject({now:80});
 expect(screen.getByTestId('goal-logging-caveat')).toBeTruthy();
 expect(screen.queryByTestId('goal-progress-water')).toBeNull();
 expect(screen.getByTestId('goal-status-water').props.children).toBe(language==='en'?'Not tracked':'לא במעקב');
});
it('does not render unknown protein as zero or show remaining/progress for it',async()=>{
 await render(<I18nProvider initial="en"><GoalDashboard summary={{...summary,protein:null,known_totals:{...summary,protein:30}}} goal={first} onEdit={()=>{}}/></I18nProvider>);
 expect(screen.queryByTestId('goal-progress-protein')).toBeNull();
 expect(screen.getByText('Known subtotal: 30 g. Some nutrients are missing.')).toBeTruthy();
 expect(screen.getByTestId('goal-status-protein').props.children).toBe('Incomplete nutrients');
});
it('labels unset goals and keeps add and meal navigation while showing calorie progress',async()=>{
 const edit=jest.fn(),add=jest.fn(),open=jest.fn();
 const meal:Meal={id:'lunch',day:'2026-10-14',meal_type:'lunch',food_id:'banana',name:'Lunch',emoji:'',grams:100,calories:2300,protein:150,carbs:200,fat:70,created_at:'2026-10-14T12:00:00Z',details:{}};
 await render(<I18nProvider initial="en"><DayDial meals={[meal]} onAdd={add} onOpenMeal={open} caloriesGoal={goalProgress(summary,first).calories}/><GoalDashboard summary={summary} goal={null} onEdit={edit}/></I18nProvider>);
 expect(screen.getByText('No targets set for this date.')).toBeTruthy();
 await fireEvent.press(screen.getByTestId('add-meal'));expect(add).toHaveBeenCalledTimes(1);
 await fireEvent.press(screen.getByTestId('dial-meal-lunch'));expect(open).toHaveBeenCalledWith(meal);
 await fireEvent.press(screen.getByText('Edit goals'));expect(edit).toHaveBeenCalledTimes(1);
 expect(screen.getByTestId('dial-goal-progress').props.accessibilityLabel).toContain('100%');
});
