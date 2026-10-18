import {render,fireEvent,act} from '@testing-library/react-native';
import {HealthSettings} from '../HealthSettings';
import {I18nProvider} from '@/i18n/I18nProvider';
const mockSync={subscribe:()=>()=>{},state:{connected:false,busy:false,error:false,blocked:0,withheld:0,imported:0},connect:jest.fn(async()=>{}),sync:jest.fn(async()=>{}),disconnect:jest.fn(async()=>{})};
jest.mock('../HealthProvider',()=>({useHealth:()=>mockSync}));
jest.mock('@/native/health/platform',()=>({healthEnabled:true,isHealthConnect:false,healthStorageName:'health-sync'}));
jest.mock('../Header',()=>({Header:()=>null}));
test('Health settings request only selected permissions and disclose read ambiguity',async()=>{const v=await render(<I18nProvider initial="en"><HealthSettings/></I18nProvider>);expect(v.getByText(/Empty results do not prove read permission/)).toBeTruthy();await fireEvent.press(v.getByText('Import body weight: off'));await act(async()=>{await fireEvent.press(v.getByText('Connect selected data'));});expect(mockSync.connect).toHaveBeenCalledWith({nutrition:false,water:false,weight:true,steps:false});});
test('Hebrew settings retain ordinary navigation with Health disconnected',async()=>{const v=await render(<I18nProvider initial="he"><HealthSettings/></I18nProvider>);expect(v.getByText('חיבור הנתונים שנבחרו')).toBeTruthy();});

test('iOS discloses bounded imports and history rather than promising all records',async()=>{
 const v=await render(<I18nProvider initial="en"><HealthSettings/></I18nProvider>);
 expect(v.getByText(/at most 1,000 samples per selected type/)).toBeTruthy();
 expect(v.getByText(/10,000 owned records/)).toBeTruthy();
 expect(v.getByText(/preview of up to 10 records/)).toBeTruthy();
 expect(v.getAllByText(/last 30 days/)[0]).toBeTruthy();
});
