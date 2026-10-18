import {render,screen,waitFor} from '@testing-library/react-native';
import {router} from 'expo-router';
import MealEdit from '@/app/(app)/meal/edit/[id]';
import {I18nProvider} from '@/i18n/I18nProvider';
import {libraryEntry} from '@/test-fixtures/library';
import {ApiError} from '@/api/errors';

const mockId='a'.repeat(32),mockComponent='b'.repeat(32);
const mockUser={id:'alice'};
const mockStart=jest.fn(async()=>{}),mockNewKey=()=> 'reloaded-edit-key';
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),mealLogs:jest.fn(async()=>[]),mealLog:jest.fn()};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:mockUser,api:mockApi})}));
jest.mock('@/data/DraftProvider',()=>({useDraft:()=>({draft:null,start:mockStart,newKey:mockNewKey})}));
jest.mock('expo-router',()=>({router:{replace:jest.fn()},useLocalSearchParams:()=>({id:mockId,day:'2026-10-13',kind:'group'})}));
beforeEach(()=>{jest.clearAllMocks();});
test('reload route opens the latest version on its new day after conflict',async()=>{
 mockApi.mealLog.mockResolvedValue({id:mockId,version:3,local_date:'2026-10-15',occurred_at:null,timezone_id:null,snapshot:{meals:[{id:mockComponent,day:'2026-10-15',meal_type:'lunch',food_id:'custom',name:'Salad',emoji:'',grams:100,calories:100,protein:null,carbs:10,fat:5,created_at:'2026-10-15T12:00:00Z',details:{group_id:mockId,canonical_item:libraryEntry().draft.items[0]}}]}});
 await render(<I18nProvider initial="en"><MealEdit/></I18nProvider>);
 await waitFor(()=>expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({day:'2026-10-15',edit:expect.objectContaining({groupId:mockId,expectedVersion:3,originalDate:'2026-10-15'})})));
 expect(mockApi.mealLogs).not.toHaveBeenCalled();expect(mockApi.mealLog).toHaveBeenCalledWith(mockId);
 expect(router.replace).toHaveBeenCalledWith('/add/review');
});
test('deleted group stays unavailable and never creates a replacement draft',async()=>{
 mockApi.mealLog.mockRejectedValue(new ApiError('notFound'));
 await render(<I18nProvider initial="en"><MealEdit/></I18nProvider>);
 await screen.findByRole('button',{name:'Try again'});
 expect(mockApi.mealLog).toHaveBeenCalledWith(mockId);expect(mockApi.mealLogs).not.toHaveBeenCalled();
 expect(mockStart).not.toHaveBeenCalled();expect(router.replace).not.toHaveBeenCalled();
});
