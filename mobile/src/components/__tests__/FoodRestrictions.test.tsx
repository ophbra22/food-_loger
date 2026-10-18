import {act,fireEvent,render} from '@testing-library/react-native';
import {AppState,type AppStateStatus} from 'react-native';
import {libraryEntry} from '@/test-fixtures/library';
import {FoodRestrictions} from '../FoodRestrictions';
import {I18nProvider} from '@/i18n/I18nProvider';
import {ApiError} from '@/api/errors';
const mockFocus=jest.fn(),mockInvalidate=jest.fn();
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({recommendations:true,recommendation_writes:true}),recommendationPreferences:jest.fn(),recommendationSources:jest.fn(),saveRecommendationPreferences:jest.fn(),saveRecommendationReview:jest.fn(),clearRecommendationPreferences:jest.fn()};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:mockApi,journal:{userId:'owner',advice:{invalidate:mockInvalidate}}})}));
jest.mock('expo-router',()=>({useFocusEffect:(fn:any)=>{mockFocus.mockImplementation(fn);}}));
jest.mock('../Screen',()=>({Screen:({children}:any)=>children}));
jest.mock('../Header',()=>({Header:()=>null}));
beforeEach(()=>{jest.clearAllMocks();mockApi.recommendationSources.mockResolvedValue([]);mockApi.recommendationPreferences.mockResolvedValue({version:1,allergy_status:'declared',allergens:['milk'],diets:[]});});
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

function pending<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
const updated={version:2,allergy_status:'declared',allergens:['peanuts'],diets:[]};
let resume:(state:AppStateStatus)=>void,remove:jest.Mock;
beforeEach(()=>{remove=jest.fn();jest.spyOn(AppState,'addEventListener').mockImplementation((_event,listener)=>{resume=listener;return {remove};});});
afterEach(()=>jest.restoreAllMocks());
async function foreground(){await act(async()=>{resume?.('background');resume?.('active');});}
test('foreground reloads another device’s preference changes and saves its current version',async()=>{
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 let blur!:()=>void;await act(async()=>{blur=mockFocus();});
 expect(view.getByText('✓ Milk')).toBeTruthy();
 expect(view.getByText(/Up to 60 recent meals/)).toBeTruthy();
 mockApi.recommendationPreferences.mockResolvedValue(updated);
 mockApi.saveRecommendationPreferences.mockResolvedValue({...updated,version:3});
 await foreground();
 expect(view.getByText('✓ Peanuts')).toBeTruthy();expect(view.queryByText('✓ Milk')).toBeNull();
 await fireEvent.press(view.getByText('Save preferences'));
 expect(mockApi.saveRecommendationPreferences).toHaveBeenCalledWith(updated);
 await act(async()=>{blur();});expect(remove).toHaveBeenCalledTimes(1);await view.unmount();
});
test('an earlier response cannot replace preferences loaded after resume',async()=>{
 const old=pending<unknown>();mockApi.recommendationPreferences.mockReturnValueOnce(old.promise);
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});
 mockApi.recommendationPreferences.mockResolvedValue(updated);await foreground();
 await act(async()=>{old.resolve({version:1,allergy_status:'declared',allergens:['milk'],diets:[]});});
 expect(view.getByText('✓ Peanuts')).toBeTruthy();expect(view.queryByText('✓ Milk')).toBeNull();
});
test('a resume during save queues a refresh after the write, without overlapping it',async()=>{
 const saving=pending<unknown>();mockApi.saveRecommendationPreferences.mockReturnValueOnce(saving.promise);
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});await fireEvent.press(view.getByText('Save preferences'));
 mockApi.recommendationPreferences.mockResolvedValue(updated);await foreground();
 expect(mockApi.recommendationPreferences).toHaveBeenCalledTimes(1);
 await act(async()=>{saving.resolve({version:2,allergy_status:'declared',allergens:['milk'],diets:[]});});
 expect(mockApi.recommendationPreferences).toHaveBeenCalledTimes(2);
 expect(view.getByText('✓ Peanuts')).toBeTruthy();
});
test('failed foreground refresh disables saving until a successful reload',async()=>{
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});mockApi.recommendationPreferences.mockRejectedValueOnce(new Error('offline'));
 await foreground();await fireEvent.press(view.getByText('Save preferences'));
 expect(mockApi.saveRecommendationPreferences).not.toHaveBeenCalled();
});

test.each([false,true])('dirty preferences survive resume; a changed server requires explicit discard: %s',async changed=>{
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});await fireEvent.press(view.getByText('Peanuts'));
 if(changed)mockApi.recommendationPreferences.mockResolvedValue({...updated,allergens:['soy']});
 await foreground();
 expect(view.getByText('✓ Milk')).toBeTruthy();expect(view.getByText('✓ Peanuts')).toBeTruthy();
 if(changed){
  expect(view.getByText('Saved restrictions or ingredient reviews changed. Your unsaved edits are retained; discard them and load the latest data before saving.')).toBeTruthy();
  await fireEvent.press(view.getByText('Save preferences'));expect(mockApi.saveRecommendationPreferences).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Discard unsaved edits and load latest'));
  expect(view.getByText('✓ Soy')).toBeTruthy();expect(view.queryByText('✓ Milk')).toBeNull();
 }else{
  mockApi.saveRecommendationPreferences.mockResolvedValue({...updated,allergens:['milk','peanuts']});
  await fireEvent.press(view.getByText('Save preferences'));
  expect(mockApi.saveRecommendationPreferences).toHaveBeenCalledWith({version:1,allergy_status:'declared',allergens:['milk','peanuts'],diets:[]});
 }
});
test.each([false,true])('dirty ingredient reviews survive resume and cannot overwrite a changed source: %s',async changed=>{
 const source={entry:libraryEntry(),source_revision:'a'.repeat(64),preferences_version:1,review:{version:0,ingredients_reviewed:false,allergens:[],suitable_diets:[]}};
 mockApi.recommendationSources.mockResolvedValue([source]);
 const view=await render(<I18nProvider initial="en"><FoodRestrictions/></I18nProvider>);
 await act(async()=>{await mockFocus();});await fireEvent.press(view.getByText('Saved salad (v1)'));
 await fireEvent.press(view.getByText('Ingredients are unknown / not reviewed'));
 if(changed)mockApi.recommendationSources.mockResolvedValue([{...source,source_revision:'b'.repeat(64),entry:{...source.entry,version:2}}]);
 await foreground();expect(view.getByText('I checked all ingredients for this exact source')).toBeTruthy();
 mockApi.saveRecommendationReview.mockResolvedValue({...source.review,version:1,ingredients_reviewed:true});
 await fireEvent.press(view.getByText('Save ingredient review'));
 if(changed){
  expect(mockApi.saveRecommendationReview).not.toHaveBeenCalled();
  await fireEvent.press(view.getByText('Discard unsaved edits and load latest'));
  expect(view.getByText('Saved salad (v2)')).toBeTruthy();
 }else expect(mockApi.saveRecommendationReview).toHaveBeenCalledWith({...source,review:{...source.review,ingredients_reviewed:true}});
});
