import {render,screen,fireEvent,waitFor} from '@testing-library/react-native';
import {useState} from 'react';
import {ServingSelector} from '../ServingSelector';
import {newReviewFood} from '@/domain/meal-analysis';
import {I18nProvider} from '@/i18n/I18nProvider';
const ref={id:'pita',source_version:'v1',name:'Pita',source:'USDA',source_url:'https://example.org',basis_unit:'g' as const,data_type:'SR',nutrition:{calories:200,protein:5,carbs:20,fat:1}};
const row={id:'large',food_id:'pita',source_version:'v1',unit:'large',label:'large pita',basis:'g' as const,amount:60,confidence:'source_reported',evidence:{}};
function Harness(){const [food,setFood]=useState({...newReviewFood('x'),reference:ref});return <ServingSelector food={food} onChange={f=>setFood(f as typeof food)} disabled={false} load={async()=>({conversions:[row]})}/>;}
test('unit choice and quantity need deliberate apply; original measure stays visible',async()=>{
 await render(<I18nProvider initial="en"><Harness/></I18nProvider>);
 await fireEvent.press(screen.getByText('Household measure'));
 await waitFor(()=>expect(screen.getByText('large pita · 60 g')).toBeTruthy());
 await fireEvent.press(screen.getByText('large pita · 60 g'));
 await fireEvent.changeText(screen.getByLabelText('Number of measures'),'0.5');
 await fireEvent.press(screen.getByText('Apply measure'));
 expect(screen.getByText('0.5 × large pita → 30 g')).toBeTruthy();
});
test('missing source evidence asks for grams instead of guessed volume',async()=>{
 await render(<I18nProvider initial="en"><ServingSelector food={{...newReviewFood('x'),reference:ref}} onChange={()=>{}} disabled={false} load={async()=>({conversions:[]})}/></I18nProvider>);
 await fireEvent.press(screen.getByText('Household measure'));
 await waitFor(()=>expect(screen.getByText('No validated measure for this food. Enter a weighed amount in g/ml.')).toBeTruthy());
});
