import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {CopySelection} from '../CopySelection';
import {CopyReview} from '../CopyReview';
import {I18nProvider} from '@/i18n/I18nProvider';
import {DraftProvider,useDraft} from '@/data/DraftProvider';
import {JournalStore} from '@/data/journal-store';
import {libraryEntry} from '@/test-fixtures/library';
import {openAccountStorage} from '@/storage/kv';
import {copyPayload,type CopySelection as Selection} from '@/domain/copying';
const source={...libraryEntry(),entry_ids:['b'.repeat(32)]};
const requests:ReturnType<typeof copyPayload>[]=[];
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({copy:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),
 copySources:async()=>[source],nutritionReferences:async()=>({foods:[]}),
 copyPreview:async(s:Selection)=>({preview_token:'a'.repeat(64),destination_populated:true,time_issues:[] as [],drafts:[{...source.draft,input_method:'copy',local_date:s.destination_date,occurred_at:s.destination_date+'T12:30:00+03:00',timezone_id:'Asia/Jerusalem'}]}),
 copyMeals:async(body:ReturnType<typeof copyPayload>)=>{requests.push(body);return [{id:'copied-row',day:body.destination_date,meal_type:'lunch' as const,name:'Salad',emoji:'🍽️',grams:100,food_id:'custom',calories:100,protein:null,carbs:10,fat:5,created_at:new Date().toISOString(),details:{}}];},
 day:async(day:string)=>({day,meals:[],summary:{count:0,calories:0,protein:0,carbs:0,fat:0}}),deleteMeal:async()=>null};
let mockJournal:JournalStore;
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:mockApi,journal:mockJournal})}));
jest.mock('expo-router',()=>({router:{dismissTo:jest.fn(),back:jest.fn(),push:jest.fn()},useNavigation:()=>({canGoBack:()=>true})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'new-copy-flow-key'}));
function Harness(){const {draft,start,newKey}=useDraft();return draft?.copy?<CopyReview/>:<CopySelection api={mockApi} sourceDay="2026-10-13" destinationDay="2026-10-14" newKey={newKey} onReview={start}/>;}
beforeEach(async()=>{requests.length=0;await AsyncStorage.clear();openAccountStorage('alice');mockJournal=new JournalStore('alice',mockApi);});
it('copy selection previews, edits the shared item and requires populated-date confirmation before atomic save',async()=>{
 jest.spyOn(Intl.DateTimeFormat.prototype,'resolvedOptions').mockReturnValue({timeZone:'Asia/Jerusalem'} as Intl.ResolvedDateTimeFormatOptions);
 await mockJournal.refresh('2026-10-14');
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await waitFor(()=>expect(screen.getByTestId('preview-copy').props.accessibilityState.disabled).toBe(false));
 await fireEvent.press(screen.getByTestId('preview-copy'));
 const save=await screen.findByTestId('confirm-copy');expect(save.props.accessibilityState.disabled).toBe(true);expect(requests).toHaveLength(0);
 await fireEvent.changeText(screen.getByTestId('food-weight-ingredient'),'50');await fireEvent.press(screen.getByTestId('confirm-ingredient'));
 await fireEvent.press(screen.getByTestId('confirm-populated-copy'));await fireEvent.press(screen.getByTestId('confirm-copy'));
 await waitFor(()=>expect(requests).toHaveLength(1));expect(requests[0].drafts[0].items[0].portion.normalized_g).toBe(50);
 expect(requests[0].sources).toEqual([{id:source.id,version:source.version}]);
 await waitFor(()=>expect(mockJournal.get('2026-10-14').data?.meals).toHaveLength(1));jest.restoreAllMocks();
});
it('Hebrew selection displays unresolved time and stays out of review until a user chooses it',async()=>{
 const onReview=jest.fn();const api={...mockApi,copyPreview:jest.fn(async()=>({preview_token:'a'.repeat(64),destination_populated:false,time_issues:[{id:source.id,reason:'unknown_time' as const}],drafts:[]}))};
 await render(<I18nProvider initial="he"><CopySelection api={api} sourceDay="2026-10-13" destinationDay="2026-10-14" newKey={()=>'he-copy-flow-key'} onReview={onReview}/></I18nProvider>);
 await waitFor(()=>expect(screen.getByTestId('preview-copy').props.accessibilityState.disabled).toBe(false));await fireEvent.press(screen.getByTestId('preview-copy'));
 expect(await screen.findAllByText('לארוחה אין שעה מקומית מתועדת. בחרו שעה במפורש.')).toHaveLength(2);expect(onReview).not.toHaveBeenCalled();
 await fireEvent.changeText(screen.getByTestId('copy-time-'+source.id),'25:90:00');expect(screen.getByTestId('preview-copy').props.accessibilityState.disabled).toBe(true);
});

it('a 21-meal day explains the cap and requires a reviewed subset of at most 20',async()=>{
 const sources=Array.from({length:21},(_,n)=>({...source,id:String(n).padStart(32,'0'),entry_ids:[String(n).padStart(32,'0')]}));
 const api={...mockApi,copySources:async()=>sources};
 await render(<I18nProvider initial="en"><CopySelection api={api} sourceDay="2026-10-13" destinationDay="2026-10-14" newKey={()=>'limit-copy-flow-key'} onReview={jest.fn()}/></I18nProvider>);
 expect(await screen.findByText('Select up to 20 meals per copy. Copy larger days in reviewed subsets.')).toBeTruthy();
 expect(screen.getByTestId('preview-copy').props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(screen.getByTestId('copy-select-'+sources[0].id));
 expect(screen.getByTestId('preview-copy').props.accessibilityState.disabled).toBe(false);
 expect(screen.getAllByTestId(/^copy-select-/)).toHaveLength(21);
});
