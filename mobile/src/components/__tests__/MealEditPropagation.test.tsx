import {act,render} from '@testing-library/react-native';
import {AppState} from 'react-native';
import {HealthProvider} from '../HealthProvider';
import {HealthSync} from '@/native/health/sync';
import {JournalStore,summarize} from '@/data/journal-store';
import {WidgetLifecycle} from '@/native/widgets/lifecycle';
import {openAccountStorage} from '@/storage/kv';
import type {Meal} from '@/api/types';

let mockJournal:JournalStore;
const mockUser={id:'edit-owner'},mockApi={captureSession:()=>()=>{}};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:mockUser,api:mockApi,journal:mockJournal})}));
jest.mock('@/native/health/platform',()=>({healthEnabled:true,isHealthConnect:false,healthStorageName:'health-sync',healthPort:{stop:()=>{},status:async()=>({available:true,read:'unknown',write:{}})}}));

test('confirmed edit invalidates actual enabled Health subscription and widget lifecycle',async()=>{
 jest.useFakeTimers();const previous=AppState.currentState;AppState.currentState='active';
 const sync=jest.spyOn(HealthSync.prototype,'sync').mockResolvedValue(undefined);
 const now=new Date(2026,9,18,12).getTime(),day='2026-10-18',other='2026-10-17';
 const meal=(id:string,calories:number,date=day)=>({id,day:date,meal_type:'lunch',food_id:'custom',name:'fixture',emoji:'',grams:100,calories,protein:10,carbs:0,fat:0,created_at:'2026-10-18T00:00:00Z',details:{}} as Meal);
 let rows=[meal('old',100),meal('other',40)];
 openAccountStorage('edit-owner');
 mockJournal=new JournalStore('edit-owner',{day:async d=>({day:d,meals:rows.filter(r=>r.day===d),summary:summarize(rows.filter(r=>r.day===d))}),deleteMeal:async()=>null},undefined,()=>now);
 const port={available:()=>true,bind:jest.fn(),publish:jest.fn(),clear:jest.fn()};
 const widget=new WidgetLifecycle(mockJournal,port,'12345678-1234-1234-1234-123456789012','en',()=>now);
 const view=await render(<HealthProvider>{null}</HealthProvider>);
 try{
  await widget.start();sync.mockClear();port.publish.mockClear();
  rows=[meal('new',200,other),meal('other',40)];
  await act(async()=>{mockJournal.replaceConfirmedGroup({groupId:'a'.repeat(32),expectedVersion:1,originalDate:day,entryIds:['old']},[rows[0]]);});
  await act(async()=>{jest.advanceTimersByTime(300);});
  expect(sync).toHaveBeenCalledTimes(1);
  const snapshots=port.publish.mock.calls.map(c=>JSON.parse(c[2]));
  expect(snapshots.some(s=>s.state==='unavailable')).toBe(true);
  expect(snapshots.at(-1)).toMatchObject({date:day,calories:40});
  expect(mockJournal.get(other).data?.summary.calories).toBe(200);
 }finally{widget.close();await view.unmount();mockJournal.close();sync.mockRestore();AppState.currentState=previous;jest.useRealTimers();}
});
