import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {LibraryPanel} from '../LibraryPanel';
import {MealAnalysisReview} from '../MealAnalysisReview';
import {I18nProvider} from '@/i18n/I18nProvider';
import {DraftProvider,useDraft} from '@/data/DraftProvider';
import {JournalStore} from '@/data/journal-store';
import {libraryEntry} from '@/test-fixtures/library';
import {libraryDraft} from '@/domain/library';
import {openAccountStorage} from '@/storage/kv';
import {todayIso} from '@/domain/dates';
import type {MealDraft} from '@/domain/canonical';
const requests:MealDraft[]=[];
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({library:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),
 library:async()=>({items:[libraryEntry()],next_offset:null}),nutritionReferences:async()=>({foods:[]}),
 addCanonicalMeal:async(body:MealDraft)=>{requests.push(body);return [{id:'new-row',day:body.local_date,meal_type:'lunch' as const,name:'Salad',emoji:'🍽️',grams:100,food_id:'custom',calories:100,protein:null,carbs:10,fat:5,created_at:new Date().toISOString(),details:{}}];},
 day:async(day:string)=>({day,meals:[],summary:{count:0,calories:0,protein:0,carbs:0,fat:0}}),deleteMeal:async()=>null};
let mockJournal:JournalStore;
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:mockApi,journal:mockJournal})}));
jest.mock('expo-router',()=>({router:{dismissTo:jest.fn(),back:jest.fn()},useNavigation:()=>({canGoBack:()=>true})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'new-library-test-key'}));
function Harness(){const {draft,start,newKey}=useDraft();return draft?.analysis?<MealAnalysisReview/>:<LibraryPanel store={mockJournal.library} onSelect={entry=>start(libraryDraft(entry,newKey()))}/>;}
beforeEach(async()=>{requests.length=0;await AsyncStorage.clear();openAccountStorage('alice');mockJournal=new JournalStore('alice',mockApi);});
it('default repeat reaches shared review and confirmed journal in exactly two button actions',async()=>{
 await mockJournal.refresh(todayIso());
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.press(await screen.findByTestId('repeat-'+ 'a'.repeat(32)));
 expect(requests).toHaveLength(0);
 await fireEvent.press(await screen.findByTestId('save-analyzed-meal'));
 await waitFor(()=>expect(requests).toHaveLength(1));
 expect(requests[0].input_method).toBe('repeat');expect(requests[0].items[0].portion.normalized_g).toBe(100);
 await waitFor(()=>expect(mockJournal.get(requests[0].local_date).data?.meals[0]?.id).toBe('new-row'));
});
it('Hebrew Quick Add exposes portion adjustment before selecting a snapshot',async()=>{
 const choices:number[]=[];
 await render(<I18nProvider initial="he"><LibraryPanel store={mockJournal.library} onSelect={(_entry,amount)=>{choices.push(amount);}}/></I18nProvider>);
 await fireEvent.changeText(await screen.findByTestId('library-servings'),'0.5');
 await fireEvent.press(await screen.findByTestId('repeat-'+'a'.repeat(32)));
 expect(choices).toEqual([0.5]);
});
