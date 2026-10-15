import {act,fireEvent,render,screen} from '@testing-library/react-native';
import {TrackingPanel} from '../TrackingPanel';
import {TrackingStore} from '@/data/tracking-store';
import {I18nProvider} from '@/i18n/I18nProvider';
import {openAccountStorage,clearAccount} from '@/storage/kv';
import type {TrackingPage,Measurement} from '@/domain/tracking';
jest.mock('expo-router',()=>({router:{push:jest.fn()},useFocusEffect:()=>{}}));
const day='2026-10-11';
function setup(){let entries:Measurement[]=[];const api={capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,tracking:true,tracking_writes:true}),tracking:async()=>({from:day,to:day,items:entries,total:entries.reduce((s,e)=>s+e.value,0),has_more:false,latest:entries.at(-1)??null,previous:null,delta:null} as TrackingPage),saveMeasurement:async(kind:any,body:any,entry:any)=>{const row={...body,kind,source:'manual',external_id:null,id:entry?.id??String(entries.length+1).padStart(32,'0'),version:1,created_at:body.occurred_at,updated_at:body.occurred_at};entries=[...entries.filter(i=>i.id!==row.id),row];return row;},deleteMeasurement:async(_kind:any,id:string)=>{entries=entries.filter(i=>i.id!==id);}};return new TrackingStore('panel-owner',api,()=>{});}
beforeEach(()=>openAccountStorage('panel-owner'));afterEach(()=>clearAccount('panel-owner'));
it.each(['en','he'] as const)('E2E-10 component journey: 250+500, delete250 and alternate display in %s',async language=>{
 const store=setup();await store.load('water',day);
 await render(<I18nProvider initial={language}><TrackingPanel kind="water" day={day} store={store} target={2000}/></I18nProvider>);
 await act(async()=>{await fireEvent.press(screen.getByTestId('water-add-250'));});
 await act(async()=>{await fireEvent.press(screen.getByTestId('water-add-500'));});
 expect(screen.getByTestId('water-total').props.children).toContain('750');
 await act(async()=>{await fireEvent.press(screen.getByTestId('delete-00000000000000000000000000000001'));});
 expect(screen.getByTestId('water-total').props.children).toContain('500');
 await fireEvent.press(screen.getByTestId('tracking-unit'));
 expect(screen.getByTestId('water-total').props.children).toContain('16.9');
 expect(store.get('water',day).data?.total).toBe(500);
});
