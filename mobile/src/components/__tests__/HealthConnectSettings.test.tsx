import {render,fireEvent,act} from '@testing-library/react-native';
import {HealthSettings} from '../HealthSettings';
import {I18nProvider} from '@/i18n/I18nProvider';
const mockSync={subscribe:()=>()=>{},state:{connected:true,busy:false,error:false,blocked:1,withheld:0,imported:0,availability:'install_required',available:false,readGranted:{weight:false,steps:true},recovered:true,more:true},connect:jest.fn(async()=>{}),sync:jest.fn(async()=>{}),disconnect:jest.fn(async()=>{}),manage:jest.fn(async()=>{})};
jest.mock('../HealthProvider',()=>({useHealth:()=>mockSync}));
jest.mock('@/native/health/platform',()=>({healthEnabled:true,isHealthConnect:true}));
jest.mock('../Header',()=>({Header:()=>null}));
test('Android installation, revoked read, incomplete history and timezone are visible',async()=>{
 const v=await render(<I18nProvider initial="en"><HealthSettings/></I18nProvider>);
 expect(v.getByText(/install or update required/)).toBeTruthy();expect(v.getByText(/not granted or revoked/)).toBeTruthy();expect(v.getByText(/older deletions may be missing/)).toBeTruthy();expect(v.getByText(/journal display timezone/)).toBeTruthy();expect(v.getByText(/More records remain/)).toBeTruthy();
 await act(async()=>{await fireEvent.press(v.getByText('Install / manage Health Connect permissions'));});expect(mockSync.manage).toHaveBeenCalledTimes(1);
});
test('Hebrew Health Connect preserves disclosures and retry navigation',async()=>{
 const v=await render(<I18nProvider initial="he"><HealthSettings/></I18nProvider>);expect(v.getByText(/מחיקות ישנות לא נקלטו/)).toBeTruthy();expect(v.getByText('התקנה / ניהול הרשאות Health Connect')).toBeTruthy();
});

test('bounded Android pages can be explicitly continued',async()=>{
 const v=await render(<I18nProvider initial="en"><HealthSettings/></I18nProvider>);
 expect(v.getByText(/up to 20 pages per selected type/)).toBeTruthy();
 await fireEvent.press(v.getByText('Sync / retry'));
 expect(mockSync.sync).toHaveBeenCalled();
});
