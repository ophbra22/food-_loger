import {act,fireEvent,render} from '@testing-library/react-native';
import {Reminders} from '../Reminders';
import {I18nProvider} from '@/i18n/I18nProvider';
const mockFocus=jest.fn();
const p={version:0,timezone_id:'UTC',language:'en',muted:false,breakfast:null,lunch:null,dinner:null,water:null,evening:null,quiet_start:'22:00',quiet_end:'07:00'};
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({habits:true}),habits:jest.fn(async()=>({preferences:p,streak:{current:2,longest:3,logged_days:5}})),saveHabitPreferences:jest.fn(async(v)=>({...v,version:1}))};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:mockApi,user:{id:'alice'},journal:{subscribeChanges:()=>()=>{}}})}));
jest.mock('expo-router',()=>({useFocusEffect:(fn:()=>void)=>{mockFocus.mockImplementation(fn);},router:{back:jest.fn()}}));
jest.mock('../Header',()=>({Header:()=>null}));
jest.mock('@/native/notifications',()=>({notificationsEnabled:false,syncNotifications:jest.fn(async()=> 'unavailable')}));
beforeEach(()=>jest.clearAllMocks());
test('displays logging streak, opt-in blank time and saves without enabling all reminders',async()=>{
 const v=await render(<I18nProvider initial="en"><Reminders/></I18nProvider>);await act(async()=>{await mockFocus();});
 expect(v.getByText('Current streak: 2')).toBeTruthy();
 await fireEvent.changeText(v.getByLabelText('Lunch'),'12:00');
 await act(async()=>{await fireEvent.press(v.getByText('Save reminder preferences'));});
 expect(mockApi.saveHabitPreferences).toHaveBeenCalledWith(expect.objectContaining({lunch:'12:00',breakfast:null,dinner:null}));
 expect(v.getByText('Push delivery is disabled in this build.')).toBeTruthy();
});
test('invalid time disables save and Hebrew labels render',async()=>{
 const v=await render(<I18nProvider initial="he"><Reminders/></I18nProvider>);await act(async()=>{await mockFocus();});
 await fireEvent.changeText(v.getByLabelText('ארוחת צהריים'),'99:99');
 await fireEvent.press(v.getByText('שמירת העדפות תזכורות'));expect(mockApi.saveHabitPreferences).not.toHaveBeenCalled();
});
