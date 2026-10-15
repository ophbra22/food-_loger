import {act,render,fireEvent} from '@testing-library/react-native';
import {AdviceScreen} from '../AdviceScreen';
import {I18nProvider} from '@/i18n/I18nProvider';
import fixture from '@/test-fixtures/advice.json';
const mockStart=jest.fn(),mockSave=jest.fn(),mockPush=jest.fn(),mockRefresh=jest.fn();
const mockState={data:fixture.en.recommendation,fresh:true,loading:false,wording:false,enabled:true,error:null,refresh:mockRefresh};
jest.mock('@/data/useAdvice',()=>({useAdvice:()=>mockState}));
jest.mock('@/data/DraftProvider',()=>({useDraft:()=>({start:mockStart,save:mockSave,newKey:()=> 'recommend-request-key'})}));
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:{captureSession:()=>()=>{}}})}));
jest.mock('expo-router',()=>({router:{push:(v:any)=>mockPush(v)},useLocalSearchParams:()=>({day:'2026-10-14'})}));
jest.mock('../Screen',()=>({Screen:({children}:any)=>children}));
jest.mock('../Header',()=>({Header:()=>null}));
test('selecting recommendation persists only an editable draft then opens shared confirmation',async()=>{
 const view=await render(<I18nProvider initial="en"><AdviceScreen feature="recommendation"/></I18nProvider>);
 await act(async()=>{await fireEvent.press(view.getByTestId('advice-choice-0'));});
 expect(mockStart).toHaveBeenCalledTimes(1);const draft=mockStart.mock.calls[0][0];
 expect(draft.day).toBe('2026-10-14');expect(draft.origin).toBe('recipe');expect(draft.analysis.foods[0].amount).toBe('200');
 expect(mockPush).toHaveBeenCalledWith('/add/review');expect(mockSave).not.toHaveBeenCalled();
});
