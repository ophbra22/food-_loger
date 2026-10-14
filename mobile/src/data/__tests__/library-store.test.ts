import AsyncStorage from '@react-native-async-storage/async-storage';
import {LibraryStore} from '../library-store';
import {libraryEntry} from '@/test-fixtures/library';
import {clearAccount,openAccountStorage} from '@/storage/kv';
import {ApiError} from '@/api/errors';
const caps=async()=>({library:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true});
beforeEach(async()=>{await AsyncStorage.clear();openAccountStorage('alice');});
it('cached entries form offline drafts but are explicitly stale and erased with their owner',async()=>{
 const store=new LibraryStore('alice',{capabilities:caps,library:async()=>({items:[libraryEntry()],next_offset:null})});
 await store.load();expect(store.get().fresh).toBe(true);
 store.close();const offline=new LibraryStore('alice',{capabilities:async()=>{throw new ApiError('network');}});
 await offline.load();expect(offline.get().data?.items).toHaveLength(1);expect(offline.get().fresh).toBe(false);
 await clearAccount('alice');offline.close();openAccountStorage('alice');
 const fresh=new LibraryStore('alice',{capabilities:caps});await fresh.load();expect(fresh.get().data).toBeNull();
});
it('late reads cannot resurrect changed favorites or deleted account cache',async()=>{
 let resolve!:(p:{items:ReturnType<typeof libraryEntry>[];next_offset:null})=>void;
 const store=new LibraryStore('alice',{capabilities:caps,library:()=>new Promise(r=>{resolve=r;})});
 const reading=store.refresh();await Promise.resolve();
 store.invalidate();resolve({items:[libraryEntry()],next_offset:null});await reading;
 expect(store.get().data).toBeNull();
 const second=store.refresh();await Promise.resolve();store.close();await clearAccount('alice');resolve({items:[libraryEntry()],next_offset:null});await second;
 expect((await AsyncStorage.getAllKeys()).some(k=>k.includes('library'))).toBe(false);
});
it('disabled capabilities clear cached entries and failed favorite mutation never claims success',async()=>{
 const store=new LibraryStore('alice',{capabilities:caps,library:async()=>({items:[libraryEntry()],next_offset:null}),setFavorite:async()=>{throw new ApiError('network');}});
 await store.load();await expect(store.favorite(libraryEntry(),true)).rejects.toThrow();
 expect(store.get().data?.items[0].favorite).toBe(false);
 const disabled=new LibraryStore('alice',{capabilities:async()=>({...await caps(),library:false})});await disabled.load();
 expect(disabled.get().enabled).toBe(false);expect(disabled.get().data).toBeNull();
});
