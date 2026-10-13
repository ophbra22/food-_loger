import AsyncStorage from '@react-native-async-storage/async-storage';
import { draftStore } from '../account-data';
import { accountKey, clearAccount, openAccountStorage } from '../kv';
import { catalogDraft } from '@/domain/drafts';
const originalGet = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
const originalRemove = jest.mocked(AsyncStorage.removeItem).getMockImplementation()!;
const owner = 'draft-order-owner';
const current = {...catalogDraft('new-server-saved-key','banana','catalog'),amount:'200',attempted:true};
const legacy = {...catalogDraft('legacy-original-key','banana','catalog'),amount:'100'};
async function ticks() { for(let i=0;i<30;i++) await Promise.resolve(); }
function pauseRead() {
  let enter!:()=>void, resume!:(value:string|null)=>void;
  const entered=new Promise<void>(resolve=>{enter=resolve;});
  const blocked=new Promise<string|null>(resolve=>{resume=resolve;});
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(()=>{enter();return blocked;});
  return {entered,resume};
}
beforeEach(async()=>{
  jest.mocked(AsyncStorage.getItem).mockImplementation(originalGet);
  jest.mocked(AsyncStorage.removeItem).mockImplementation(originalRemove);
  await AsyncStorage.clear();openAccountStorage(owner);
});
test('discard orders a write already suspended in its preflight read',async()=>{
  const read=pauseRead();
  const writing=draftStore.write(owner,current);
  await read.entered;
  const clearing=draftStore.clear(owner);
  await ticks();read.resume(null);
  await Promise.all([writing,clearing]);
  expect(await draftStore.read(owner)).toBeNull();
});
test('preflight from a prior session cannot restore an erased draft after reopening owner',async()=>{
  const read=pauseRead();
  const writing=draftStore.write(owner,current).then(()=>null,error=>error);
  await read.entered;await clearAccount(owner);openAccountStorage(owner);read.resume(null);
  expect(await writing).toMatchObject({kind:'unauthorized'});
  expect(await draftStore.read(owner)).toBeNull();
});
test.each(['draft','draft:v2'])('cleanup failure removing %s preserves the current attempted identity on restart',async(failing)=>{
  await AsyncStorage.setItem(accountKey(owner,'draft'),JSON.stringify(legacy));
  await draftStore.write(owner,current);
  jest.mocked(AsyncStorage.removeItem).mockImplementation(key=>key===accountKey(owner,failing)?Promise.reject(new Error('disk error')):originalRemove(key));
  await expect(draftStore.clear(owner)).rejects.toMatchObject({kind:'storage'});
  expect(await draftStore.read(owner)).toEqual(current);
});
