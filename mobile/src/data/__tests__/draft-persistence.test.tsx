import {act,render,waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useEffect} from 'react';
import {DraftProvider,useDraft} from '../DraftProvider';
import {catalogDraft} from '@/domain/drafts';
import {openAccountStorage} from '@/storage/kv';
const mockApi={captureSession:()=>()=>{},addMeal:jest.fn(),addCustomMeal:jest.fn()};
const mockJournal={addConfirmed:jest.fn()};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:mockApi,journal:mockJournal})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'fresh-random-test-key'}));
const originalSetItem=jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
let value:ReturnType<typeof useDraft>;
function Probe(){const current=useDraft();useEffect(()=>{value=current;},[current]);return null;}
beforeEach(async()=>{
  jest.clearAllMocks();jest.mocked(AsyncStorage.setItem).mockImplementation(originalSetItem);await AsyncStorage.clear();openAccountStorage('alice');
  await render(<DraftProvider><Probe/></DraftProvider>);
  await waitFor(()=>expect(value.draft).toBeNull());
});
test('failed edit persistence stays visible and prevents a server save',async()=>{
  jest.mocked(AsyncStorage.setItem).mockRejectedValue(new Error('disk full'));
  await act(async()=>{await value.start({...catalogDraft('save-key','banana','catalog'),amount:'100'});});
  expect(value.draft?.amount).toBe('100');
  expect(value.persistenceError?.kind).toBe('storage');
  await act(async()=>{await expect(value.save()).rejects.toMatchObject({kind:'storage'});});
  expect(mockApi.addMeal).not.toHaveBeenCalled();
  jest.mocked(AsyncStorage.setItem).mockImplementation(originalSetItem);
});
test('a confirmed save retains the attempted draft if clearing disk fails',async()=>{
  await act(async()=>value.start({...catalogDraft('save-key','banana','catalog'),amount:'100'}));
  mockApi.addMeal.mockResolvedValue({id:'saved'});
  jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('disk failed'));
  await act(async()=>{await expect(value.save()).rejects.toMatchObject({kind:'draftCleanup'});});
  expect(value.draft?.attempted).toBe(true);
  expect(value.draft?.key).toBe('save-key');
  expect(mockJournal.addConfirmed).toHaveBeenCalledWith({id:'saved'});
});
