import {act,fireEvent,render} from '@testing-library/react-native';
import {FoodRestrictions} from '../FoodRestrictions';
import {I18nProvider} from '@/i18n/I18nProvider';
import {ApiError} from '@/api/errors';
const mockFocus=jest.fn(),mockInvalidate=jest.fn();
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({recommendations:true,recommendation_writes:true}),recommendationPreferences:jest.fn(),recommendationSources:async()=>[],saveRecommendationPreferences:jest.fn(),clearRecommendationPreferences:jest.fn()};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:mockApi,journal:{userId:'owner',advice:{invalidate:mockInvalidate}}})}));
jest.mock('expo-router',()=>({useFocusEffect:(fn:any)=>{mockFocus.mockImplementation(fn);}}));
jest.mock('../Screen',()=>({Screen:({children}:any)=>children}));
jest.mock('../Header',()=>({Header:()=>null}));
beforeEach(()=>{jest.clearAllMocks();mockApi.recommendationPreferences.mockResolvedValue({version:1,allergy_status:'declared',allergens:['milk'],diets:[]});});
test('privacy clearing requires confirmation, clears server version and invalidates advice',async()=>{
 mockApi.clearRecommendationPreferences.mockResolvedValue({version:2,allergy_status:'unknown',allergens:[],diets:[]});
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});await fireEvent.press(view.getByText('Clear preferences and ingredient reviews'));
 expect(mockApi.clearRecommendationPreferences).not.toHaveBeenCalled();
 await act(async()=>{await fireEvent.press(view.getByText('Confirm clearing'));});
 expect(mockApi.clearRecommendationPreferences).toHaveBeenCalledWith(1);expect(mockInvalidate).toHaveBeenCalledTimes(1);
 expect(view.queryByText('✓ Milk')).toBeNull();
});
test('version conflict disables saves until explicit reload rather than overwriting another device',async()=>{
 mockApi.saveRecommendationPreferences.mockRejectedValue(new ApiError('conflict',{status:409}));
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});await act(async()=>{await fireEvent.press(view.getByText('Save preferences'));});
 await fireEvent.press(view.getByText('Save preferences'));expect(mockApi.saveRecommendationPreferences).toHaveBeenCalledTimes(1);expect(mockInvalidate).not.toHaveBeenCalled();
 await act(async()=>{await fireEvent.press(view.getByText('Refresh'));});expect(mockApi.recommendationPreferences).toHaveBeenCalledTimes(2);
});
