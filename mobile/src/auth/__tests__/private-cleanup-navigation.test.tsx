import {DEFAULT_API_URL} from '@/config/env';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RootLayout from '@/app/_layout';
import {capturePrivateExport} from '@/storage/export-session';
import {sessionStore} from '../session-store';

const mockFiles=new Set<string>();
let mockDeleteFailure=false;
let mockLanguage:'en'|'he'='en';
jest.mock('expo-file-system',()=>({File:class {
 name:string;constructor(name:string){this.name=name;}
 delete(){if(mockDeleteFailure)throw Error('disk unavailable');mockFiles.delete(this.name);}
},Directory:class{},Paths:{cache:{list:()=>{
 const {File}=jest.requireMock('expo-file-system');return Array.from(mockFiles,name=>new File(name));
}}}}));
jest.mock('@expo-google-fonts/fredoka',()=>({useFonts:()=>[true,null]}));
jest.mock('expo-splash-screen',()=>({preventAutoHideAsync:jest.fn(),hideAsync:jest.fn()}));
jest.mock('expo-status-bar',()=>({StatusBar:()=>null}));
jest.mock('react-native-safe-area-context',()=>({
 SafeAreaProvider:({children}:{children:unknown})=>children,
 SafeAreaView:jest.requireActual('react-native').View,
}));
jest.mock('@/i18n/direction',()=>({ensureDirection:async()=> 'ready'}));
jest.mock('@/i18n/I18nProvider',()=>({...jest.requireActual('@/i18n/I18nProvider'),loadInitialLanguage:async()=>mockLanguage}));
jest.mock('@/components/WidgetProvider',()=>({WidgetProvider:({children}:{children:unknown})=>children}));
jest.mock('@/data/DraftProvider',()=>({DraftProvider:({children}:{children:unknown})=>children}));
jest.mock('@/components/Toast',()=>({ToastProvider:({children}:{children:unknown})=>children}));
jest.mock('@/native/notifications',()=>({stopNotificationSession:jest.fn()}));
jest.mock('@/native/widgets/session',()=>({stopWidgetSession:jest.fn(),allowWidgetSession:jest.fn()}));
jest.mock('@/native/health/session',()=>({stopHealthSession:jest.fn()}));
jest.mock('@/api/endpoints',()=>({createApi:()=>({me:async()=>({}),logout:async()=>{},deleteAccount:async()=>{}})}));
jest.mock('../session-store',()=>({sessionStore:{read:jest.fn(),clear:jest.fn(),write:jest.fn()}}));
jest.mock('../apple-auth',()=>({requestAppleProof:jest.fn()}));
// Router is the native boundary. RootLayout, AuthProvider and cleanup are real.
jest.mock('expo-router',()=>{
 const React=jest.requireActual('react'),{Text,View,Button}=jest.requireActual('react-native');
 function Stack(){
  const auth=jest.requireActual('../AuthProvider').useAuth();
  return React.createElement(View,null,
   React.createElement(Text,null,auth.status==='signedOut'?'Sign-in navigation':'Account navigation'),
   React.createElement(Button,{title:'Logout',onPress:()=>void auth.signOut().catch(()=>{})}),
   React.createElement(Button,{title:'Delete',onPress:()=>void auth.deleteAccount('fixture').catch(()=>{})}));
 }
 Stack.Protected=function Protected(){return null;};Stack.Screen=function Screen(){return null;};return {Stack};
});
beforeEach(async()=>{
 process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED='1';mockDeleteFailure=false;mockFiles.clear();jest.clearAllMocks();await AsyncStorage.clear();
 mockFiles.add('biteflow-account-old.json');mockFiles.add('biteflow-2026-10-18.csv');mockFiles.add('font.ttf');
 jest.mocked(sessionStore.read).mockResolvedValue({serverUrl:DEFAULT_API_URL,token:'fixture',user:{id:'owner',username:'test'},expiresAt:Date.now()+60000});
});
afterEach(()=>{delete process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED;});
it.each([['Logout','en'],['Delete','en'],['Logout','he'],['Delete','he']] as const)('keeps failed %s cleanup visible in %s and retries without restoring authentication',async(action,language)=>{
 mockLanguage=language;
 await render(<RootLayout/>);await waitFor(()=>expect(screen.getByText('Account navigation')).toBeTruthy());
 mockFiles.add('biteflow-account-old.json');mockFiles.add('biteflow-2026-10-18.csv');
 const check=capturePrivateExport();mockDeleteFailure=true;
 await act(async()=>{await fireEvent.press(screen.getByText(action));});
 const warning=language==='he'?'לא ניתן לנקות קבצים פרטיים זמניים. נסו שוב לפני פתיחת חשבון.':'Private temporary files could not be cleared. Retry before opening an account.';
 await waitFor(()=>expect(screen.getByText(warning)).toBeTruthy());
 expect(screen.queryByText('Sign-in navigation')).toBeNull();expect(screen.queryByText('Account navigation')).toBeNull();
 expect(sessionStore.clear).toHaveBeenCalled();expect(check).toThrow();expect(mockFiles.has('biteflow-account-old.json')).toBe(true);
 const retry=language==='he'?'ניסיון נוסף':'Retry';
 await fireEvent.press(screen.getByRole('button',{name:retry}));expect(screen.getByText(warning)).toBeTruthy();
 mockDeleteFailure=false;await fireEvent.press(screen.getByRole('button',{name:retry}));
 await waitFor(()=>expect(screen.getByText('Sign-in navigation')).toBeTruthy());
 expect(screen.queryByText('Account navigation')).toBeNull();expect(mockFiles).toEqual(new Set(['font.ttf']));expect(check).toThrow();
});

it('cold signed-out start blocks navigation on leftover cleanup failure and recovers without credentials',async()=>{
 mockLanguage='en';jest.mocked(sessionStore.read).mockResolvedValue(null);mockDeleteFailure=true;
 await render(<RootLayout/>);
 expect(await screen.findByText('Private temporary files could not be cleared. Retry before opening an account.')).toBeTruthy();
 expect(screen.queryByText('Sign-in navigation')).toBeNull();
 mockDeleteFailure=false;await fireEvent.press(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(screen.getByText('Sign-in navigation')).toBeTruthy());
 expect(mockFiles).toEqual(new Set(['font.ttf']));expect(sessionStore.write).not.toHaveBeenCalled();
});
