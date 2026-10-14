import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {TextEntry} from '../TextEntry';
import {MealAnalysisReview} from '../MealAnalysisReview';
import {I18nProvider} from '@/i18n/I18nProvider';
import {DraftProvider,useDraft} from '@/data/DraftProvider';
import {JournalStore} from '@/data/journal-store';
import {openAccountStorage} from '@/storage/kv';
import {textResult} from '@/test-fixtures/text-input';
import type {MealDraft} from '@/domain/canonical';
import {ApiError} from '@/api/errors';
const saved:MealDraft[]=[];let mockFailure=false;
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),
 analyzeText:async()=>{if(mockFailure)throw new ApiError('network');return textResult();},nutritionReferences:async()=>({foods:[]}),
 addCanonicalMeal:async(body:MealDraft)=>{saved.push(body);return [{id:'text-saved',day:body.local_date,meal_type:'lunch' as const,name:'rice',emoji:'🍽️',grams:100,food_id:'custom',calories:130,protein:2,carbs:28,fat:0.3,created_at:new Date().toISOString(),details:{}}];},
 day:async(day:string)=>({day,meals:[],summary:{count:0,calories:0,protein:0,carbs:0,fat:0}}),deleteMeal:async()=>null};
let mockJournal:JournalStore;
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:mockApi,journal:mockJournal})}));
jest.mock('expo-router',()=>({router:{replace:jest.fn(),dismissTo:jest.fn(),back:jest.fn()},useNavigation:()=>({canGoBack:()=>true})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'text-entry-test-key'}));
function Harness(){const {draft}=useDraft();return draft?.analysis?<MealAnalysisReview/>:<TextEntry mode="text"/>;}
beforeEach(async()=>{saved.length=0;mockFailure=false;await AsyncStorage.clear();openAccountStorage('alice');mockJournal=new JournalStore('alice',mockApi);});
it('text reaches the real shared confirmation and saves only after item and meal confirmation',async()=>{
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.changeText(await screen.findByTestId('food-description'),'100g rice');
 await fireEvent.press(screen.getByTestId('parse-text'));
 expect(await screen.findByTestId('save-analyzed-meal')).toBeTruthy();expect(saved).toHaveLength(0);
 await fireEvent.press(screen.getByTestId('confirm-text-item'));
 await fireEvent.press(screen.getByTestId('save-analyzed-meal'));
 await waitFor(()=>expect(saved).toHaveLength(1));expect(saved[0].input_method).toBe('text');
});
it('network failure preserves editable input without saving',async()=>{
 mockFailure=true;await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.changeText(await screen.findByTestId('food-description'),'half a pita');
 await fireEvent.press(screen.getByTestId('parse-text'));
 await waitFor(()=>expect(screen.getByTestId('food-description').props.value).toBe('half a pita'));
 expect(saved).toHaveLength(0);
});
