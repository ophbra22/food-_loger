import {render,fireEvent,act} from '@testing-library/react-native';
import {I18nProvider} from '@/i18n/I18nProvider';
import {WidgetSettings} from '../WidgetSettings';
const mockState={available:true,enabled:false,error:false,setEnabled:jest.fn(async()=>{}),refresh:jest.fn(async()=>{})};
jest.mock('../WidgetProvider',()=>({useWidgets:()=>mockState}));
beforeEach(()=>{jest.clearAllMocks();Object.assign(mockState,{available:true,enabled:false,error:false});});
it('explains privacy and OS refresh then permits explicit opt-in',async()=>{const v=await render(<I18nProvider initial="en"><WidgetSettings/></I18nProvider>);expect(v.getByText(/system controls when/)).toBeTruthy();await act(async()=>fireEvent.press(v.getByText('Show widget data')));expect(mockState.setEnabled).toHaveBeenCalledWith(true);});
it('Hebrew includes hide and refresh and visible cleanup failure',async()=>{Object.assign(mockState,{enabled:true,error:true});const v=await render(<I18nProvider initial="he"><WidgetSettings/></I18nProvider>);expect(v.getByText(/לא ניתן לעדכן או לנקות/)).toBeTruthy();await act(async()=>fireEvent.press(v.getByText('הסתרת נתונים בווידג׳ט')));expect(mockState.setEnabled).toHaveBeenCalledWith(false);await act(async()=>fireEvent.press(v.getByText('רענון')));expect(mockState.refresh).toHaveBeenCalledTimes(1);});
it('unavailable builds provide no enable control',async()=>{mockState.available=false;const v=await render(<I18nProvider initial="en"><WidgetSettings/></I18nProvider>);expect(v.getByText('Widgets are unavailable in this build.')).toBeTruthy();expect(v.queryByText('Show widget data')).toBeNull();});
