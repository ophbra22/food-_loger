import {act,render,fireEvent} from '@testing-library/react-native';
import {AdviceScreen} from '../AdviceScreen';
import {I18nProvider} from '@/i18n/I18nProvider';
import fixture from '@/test-fixtures/advice.json';
const mockStart=jest.fn(),mockSave=jest.fn(),mockPush=jest.fn(),mockRefresh=jest.fn(),mockAdvice=jest.fn();
let mockDraft:any=null,mockSaving=false;
const mockState={data:fixture.en.recommendation,fresh:true,loading:false,wording:false,enabled:true,error:null,refresh:mockRefresh};
jest.mock('@/data/useAdvice',()=>({useAdvice:()=>mockState}));
jest.mock('@/data/DraftProvider',()=>({useDraft:()=>({draft:mockDraft,saving:mockSaving,start:mockStart,save:mockSave,newKey:()=> 'recommend-request-key'})}));
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:{captureSession:()=>()=>{},advice:mockAdvice}})}));
jest.mock('expo-router',()=>({router:{push:(v:any)=>mockPush(v)},useLocalSearchParams:()=>({day:'2026-10-14'})}));
jest.mock('../Screen',()=>({Screen:({children}:any)=>children}));
jest.mock('../Header',()=>({Header:()=>null}));
beforeEach(()=>{jest.clearAllMocks();mockDraft=null;mockSaving=false;mockAdvice.mockResolvedValue(fixture.en.recommendation);});
test('selecting recommendation persists only an editable draft then opens shared confirmation',async()=>{
 const view=await render(<I18nProvider initial="en"><AdviceScreen feature="recommendation"/></I18nProvider>);
 await act(async()=>{await fireEvent.press(view.getByTestId('advice-choice-0'));});
 expect(mockStart).toHaveBeenCalledTimes(1);const draft=mockStart.mock.calls[0][0];
 expect(draft.day).toBe('2026-10-14');expect(draft.origin).toBe('recipe');expect(draft.analysis.foods[0].amount).toBe('200');
 expect(mockPush).toHaveBeenCalledWith('/add/review');expect(mockSave).not.toHaveBeenCalled();
});
test.each(['allergy','ingredient review','source','goal'])('external %s revision change refuses selection and refreshes',async()=>{
 mockAdvice.mockResolvedValue({...fixture.en.recommendation,revision:'b'.repeat(64)});
 const view=await render(<I18nProvider initial="en"><AdviceScreen feature="recommendation"/></I18nProvider>);
 await act(async()=>{await fireEvent.press(view.getByTestId('advice-choice-0'));});
 expect(mockStart).not.toHaveBeenCalled();expect(mockPush).not.toHaveBeenCalled();expect(mockRefresh).toHaveBeenCalled();
});
test.each(['edited','attempted','saving','loading'])('existing %s draft is preserved rather than silently replaced',async kind=>{
 mockDraft=kind==='loading'?undefined:{key:'keep-retry-identity',origin:'manual',attempted:kind==='attempted'};mockSaving=kind==='saving';
 const view=await render(<I18nProvider initial="en"><AdviceScreen feature="recommendation"/></I18nProvider>);
 await act(async()=>{await fireEvent.press(view.getByTestId('advice-choice-0'));});
 expect(mockStart).not.toHaveBeenCalled();expect(mockAdvice).not.toHaveBeenCalled();
 if(kind!=='loading')expect(view.getByText('Resume existing draft')).toBeTruthy();
});
test('a draft created while authoritative selection is pending is also preserved',async()=>{
 let resolve!:(v:any)=>void;mockAdvice.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const view=await render(<I18nProvider initial="en"><AdviceScreen feature="recommendation"/></I18nProvider>);
 await act(async()=>{await fireEvent.press(view.getByTestId('advice-choice-0'));});
 mockDraft={key:'intervening-draft',origin:'manual',attempted:false};
 await view.rerender(<I18nProvider initial="en"><AdviceScreen feature="recommendation"/></I18nProvider>);
 if(resolve)await act(async()=>{resolve(fixture.en.recommendation);});
 expect(mockStart).not.toHaveBeenCalled();
});
