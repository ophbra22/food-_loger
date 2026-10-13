import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { MealFoodEditor } from '../MealFoodEditor';
import { newReviewFood, type ReviewFood } from '@/domain/meal-analysis';
import { emptyNutritionInputs } from '@/domain/validation';
import { I18nProvider } from '@/i18n/I18nProvider';
function Harness(){
 const [food,setFood]=useState<ReviewFood>({...newReviewFood('tiny'),name:'Oil',amount:'0.1',basis:'ml',manual:{...emptyNutritionInputs(),calories:'1.4'}});
 return <MealFoodEditor food={food} onChange={setFood} onRemove={()=>{}} disabled={false} partial search={async()=>({foods:[]})}/>;
}
test('shared editor accepts explicitly confirmed partial tiny portions and offers basis editing',async()=>{
 await render(<I18nProvider initial="en"><Harness/></I18nProvider>);
 expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0);
 await fireEvent.press(screen.getByText('Confirm food and portion'));
 expect(screen.getByText('Confirmed')).toBeTruthy();
 expect(screen.getByText('ml')).toBeTruthy();
});
