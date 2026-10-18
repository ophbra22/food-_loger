import {allowPrivateExports} from '../export-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {File} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {accountKey,clearAccount,openAccountStorage,captureAccountStorage} from '../kv';
import {buildAccountArchive,sharePrivateExport} from '../export';

const mockFiles=new Map<string,string>();
jest.mock('expo-file-system',()=>({Paths:{cache:'cache'},File:class{uri:string;constructor(_:unknown,name:string){this.uri=name;}get exists(){return mockFiles.has(this.uri);}create(){mockFiles.set(this.uri,'');}write(text:string){mockFiles.set(this.uri,text);}delete(){mockFiles.delete(this.uri);}}}));
jest.mock('expo-sharing',()=>({isAvailableAsync:jest.fn(async()=>true),shareAsync:jest.fn(async()=>{})}));
const server=()=>({schema_version:1,account:{id:'alice',username:'alice'},data:{meals:[]},exclusions:{},generated_at:'2026-10-18T00:00:00Z'});
beforeEach(async()=>{await AsyncStorage.clear();mockFiles.clear();jest.clearAllMocks();openAccountStorage('alice');allowPrivateExports();jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);});
afterEach(()=>{delete process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED;});
it('blocks a stale account-export caller before loading data in a rollback build',async()=>{
 process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED='1';
 const load=jest.fn(async()=>server());
 await expect(buildAccountArchive('alice',load)).rejects.toMatchObject({kind:'server'});
 expect(load).not.toHaveBeenCalled();
});
it('keeps guarded CSV sharing and cleanup available when account archives are disabled',async()=>{
 process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED='1';
 jest.mocked(Sharing.shareAsync).mockImplementationOnce(async uri=>{expect(mockFiles.get(uri)).toBe('day,calories\n2026-10-18,133.5');});
 await sharePrivateExport({name:'biteflow-2026-10-18.csv',mime:'text/csv',load:async()=>'day,calories\n2026-10-18,133.5',check:captureAccountStorage('alice')});
 expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);expect(mockFiles.size).toBe(0);
});
it('exports only this owner’s pending content and discloses excluded derived caches',async()=>{
 await AsyncStorage.multiSet([[accountKey('alice','draft:v2'),'{"note":"tahini"}'],[accountKey('alice','tracking-pending'),'{"value":500}'],[accountKey('bob','draft:v2'),'other-owner'],[accountKey('alice','health-connect-sync'),'sensitive-native-cursor'],[accountKey('alice','day:2026-10-13'),'cached-day']]);
 const result=JSON.parse(await buildAccountArchive('alice',async()=>server()));
 expect(result.device.records).toEqual({'draft:v2':'{"note":"tahini"}','tracking-pending':'{"value":500}'});
 expect(JSON.stringify(result)).not.toMatch(/other-owner|sensitive-native-cursor|cached-day/);
 expect(result.device.exclusions.length).toBeGreaterThan(0);
});
it('rejects a wrong owner and logout while server response is pending',async()=>{
 await expect(buildAccountArchive('alice',async()=>({...server(),account:{id:'bob'}}))).rejects.toMatchObject({kind:'server'});
 let resolve!:(v:unknown)=>void;const pending=buildAccountArchive('alice',()=>new Promise(r=>resolve=r));await clearAccount('alice');resolve(server());await expect(pending).rejects.toMatchObject({kind:'unauthorized'});
});
it.each([false,true])('removes temporary file after share completion/failure=%s',async fail=>{
 jest.mocked(Sharing.shareAsync).mockImplementationOnce(async uri=>{expect(mockFiles.get(uri)).toBe('private nutrition');if(fail)throw Error('share failed');});
 const result=sharePrivateExport({name:'biteflow-account-test.json',mime:'application/json',load:async()=>'private nutrition',check:captureAccountStorage('alice')});
 if(fail)await expect(result).rejects.toThrow('share failed');else await result;
 expect(mockFiles.size).toBe(0);
});
it('does not create or share files after logout during availability check',async()=>{
 jest.mocked(Sharing.isAvailableAsync).mockImplementationOnce(async()=>{await clearAccount('alice');return true;});
 await expect(sharePrivateExport({name:'biteflow-account-test.json',mime:'application/json',load:async()=>'private',check:captureAccountStorage('alice')})).rejects.toMatchObject({kind:'unauthorized'});
 expect(mockFiles.size).toBe(0);expect(Sharing.shareAsync).not.toHaveBeenCalled();
});
it('unavailable sharing and fetch failure leave no private files',async()=>{
 jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false);
 await expect(sharePrivateExport({name:'biteflow-account-test.json',mime:'application/json',load:async()=>'private',check:()=>{}})).rejects.toThrow();
 await expect(sharePrivateExport({name:'biteflow-account-test.json',mime:'application/json',load:async()=>{throw Error('offline');},check:()=>{}})).rejects.toThrow('offline');expect(mockFiles.size).toBe(0);
});
it('surfaces cleanup failure rather than claiming erased export',async()=>{
 const spy=jest.spyOn(File.prototype,'delete').mockImplementationOnce(()=>{throw Error('disk');});
 await expect(sharePrivateExport({name:'biteflow-account-test.json',mime:'application/json',load:async()=>'private',check:()=>{}})).rejects.toThrow('disk');spy.mockRestore();
});
