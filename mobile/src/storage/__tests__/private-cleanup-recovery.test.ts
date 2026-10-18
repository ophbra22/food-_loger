const mockDisk=new Map<string,string>();const mockFiles=new Map<string,string>();
let mockDeleteFail=false,mockWriteFail=false;
jest.mock('@react-native-async-storage/async-storage',()=>({__esModule:true,default:{getItem:async(k:string)=>mockDisk.get(k)??null,setItem:async(k:string,v:string)=>{if(mockWriteFail)throw Error('disk full');mockDisk.set(k,v);},removeItem:async(k:string)=>{mockDisk.delete(k);}}}));
jest.mock('expo-file-system',()=>({File:class{
 name:string;uri:string;constructor(first:string,second?:string){this.name=second??first;this.uri=this.name;}get exists(){return mockFiles.has(this.name);}create(){mockFiles.set(this.name,'');}write(t:string){mockFiles.set(this.name,t);}delete(){if(mockDeleteFail)throw Error('locked');mockFiles.delete(this.name);}
},Directory:class{},Paths:{cache:{list:()=>{const {File}=jest.requireMock('expo-file-system');return [...mockFiles.keys()].map(k=>new File(k));}}}}));
// Fresh module lifetimes deliberately require inside isolateModules.
// eslint-disable-next-line @typescript-eslint/no-require-imports
function processStart(){let mod!:typeof import('../private-cleanup-recovery');jest.isolateModules(()=>{mod=require('../private-cleanup-recovery');});return mod;}
beforeEach(()=>{mockDisk.clear();mockFiles.clear();mockDeleteFail=false;mockWriteFail=false;});
test.each([undefined,'corrupt'])('new signed-out process sweeps crash leftovers even with marker=%s',async marker=>{
 const first=processStart();await first.recoverPrivateFiles();
 const {File,Paths}=jest.requireMock('expo-file-system');
 for(const name of ['biteflow-account-test.json','biteflow-2026-10-18.csv']){const file=new File(Paths.cache,name);file.create();file.write('private');}
 mockDisk.set('owner-draft','pending');mockDisk.set('health-receipts','keep');
 if(marker)mockDisk.set('foodlogger:private-cleanup-pending',marker);
 mockFiles.set('unrelated.asset','keep');
 // New module lifetime: no promise, flag, session or credentials from the first process.
 const second=processStart();await second.recoverPrivateFiles();
 expect([...mockFiles.keys()]).toEqual(['unrelated.asset']);
 expect(mockDisk.get('owner-draft')).toBe('pending');expect(mockDisk.get('health-receipts')).toBe('keep');
});
test('deletion failure remains observable across process death; retry clears only owned files',async()=>{
 mockFiles.set('biteflow-account-test.json','private');mockDeleteFail=true;
 const first=processStart();await expect(first.recoverPrivateFiles()).rejects.toThrow();expect(first.privateCleanupFailed()).toBe(true);
 const second=processStart();await expect(second.recoverPrivateFiles()).rejects.toThrow();expect(mockFiles.size).toBe(1);
 mockDeleteFail=false;await second.recoverPrivateFiles();expect(second.privateCleanupFailed()).toBe(false);expect(mockFiles.size).toBe(0);
});
test('marker write failure cannot bypass the actual sweep or authorize new exports',async()=>{
 mockFiles.set('biteflow-account-test.json','private');mockWriteFail=true;
 const runtime=processStart();await expect(runtime.recoverPrivateFiles()).rejects.toThrow();
 expect(mockFiles.size).toBe(0);expect(runtime.privateCleanupFailed()).toBe(true);
 mockWriteFail=false;await runtime.recoverPrivateFiles();expect(runtime.privateCleanupFailed()).toBe(false);
});
