import {render,fireEvent} from '@testing-library/react-native';
import {AdvicePanel} from '../AdvicePanel';
import {libraryEntry} from '@/test-fixtures/library';
import {I18nProvider} from '@/i18n/I18nProvider';
const choice={entry:libraryEntry(),draft:libraryEntry().draft,servings:1,nutrition:{values:{energy_kcal:100,protein_g:null,carbs_g:10,fat_g:5}},safety_status:'unknown',rationale:'familiar_portion',warnings:['partial_nutrition']} as any;
test.each(['en','he'] as const)('E2E-13 component %s selection only opens review; stale result cannot select',async language=>{
 const select=jest.fn(),data={choices:[choice],remaining:{calories:500,protein:40,carbs:null,fat:null},warnings:['allergies_unknown'],sentences:[]} as any;
 const view=await render(<I18nProvider initial={language}><AdvicePanel data={data} selectable onSelect={select}/></I18nProvider>);
 await fireEvent.press(view.getByTestId('advice-choice-0'));expect(select).toHaveBeenCalledWith(choice);
 await view.rerender(<I18nProvider initial={language}><AdvicePanel data={data} selectable={false} onSelect={select}/></I18nProvider>);
 await fireEvent.press(view.getByTestId('advice-choice-0'));expect(select).toHaveBeenCalledTimes(1);
});
