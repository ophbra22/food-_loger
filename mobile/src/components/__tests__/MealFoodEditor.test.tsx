import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { MealFoodEditor } from '../MealFoodEditor';
import { newReviewFood } from '@/domain/meal-analysis';
import { I18nProvider } from '@/i18n/I18nProvider';

function Harness() {
  const [food, setFood] = useState({ ...newReviewFood('food-test'), name: 'Chicken', amount: '160',
    reference: { id: 'fdc:171477', name: 'Chicken, roasted', source: 'USDA FoodData Central',
      source_url: 'https://fdc.nal.usda.gov/food-details/171477/nutrients', data_type: 'SR Legacy',
      basis_unit: 'g' as const, nutrition: { calories: 165, protein: 31, fat: 3.6, carbs: 0 } } });
  return <MealFoodEditor food={food} onChange={next => setFood(next as typeof food)}
    onRemove={() => setFood({ ...food, name: 'Removed' })} search={async () => ({ foods: [] })} disabled={false} />;
}

test('user changes grams, sees new calories, confirms and invalidates confirmation on edit', async () => {
  await render(<I18nProvider initial="en"><Harness /></I18nProvider>);
  expect(screen.getByText('264')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Portion weight (g)'), '100');
  expect(screen.getByText('165')).toBeTruthy();
  await fireEvent.press(screen.getByText('Confirm food and portion'));
  expect(screen.getByText('Confirmed')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Portion weight (g)'), '200');
  expect(screen.queryByText('Confirmed')).toBeNull();
  expect(screen.getByText('330')).toBeTruthy();
});

function BasisHarness(){
 const [food,setFood]=useState({...newReviewFood('basis'),name:'Label',amount:'100',basis:'g' as 'g'|'ml',confirmed:true,manualOverride:false,originSource:{provider:'Original-label',reference_id:'label-1',verified_status:'estimated'},manual:{calories:'120',protein:'',carbs:'',fat:''}});
 return <MealFoodEditor partial food={food} onChange={next=>setFood(next as typeof food)} onRemove={()=>{}} search={async()=>({foods:[]})} disabled={false}/>;
}
test('basis correction displays the original source and nutrition and requires reconfirmation',async()=>{
 await render(<I18nProvider initial="en"><BasisHarness/></I18nProvider>);
 await fireEvent.press(screen.getByText('ml'));
 expect(screen.queryByText('Confirmed')).toBeNull();
 expect(screen.getByText('Original-label · label-1')).toBeTruthy();
 expect(screen.getByText('Original basis: 100 g · current basis: 100 ml')).toBeTruthy();
 expect(screen.getByTestId('original-nutrition-basis')).toBeTruthy();
 await fireEvent.press(screen.getByRole('radio',{name:'g'}));
 expect(screen.getByText('Original basis: 100 g · current basis: 100 g')).toBeTruthy();
});
