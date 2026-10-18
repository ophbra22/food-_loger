import {render,screen,fireEvent,waitFor,act} from '@testing-library/react-native';
import {AccountExport} from '../AccountExport';
import {I18nProvider} from '@/i18n/I18nProvider';
import {openAccountStorage} from '@/storage/kv';
import {allowPrivateExports,stopPrivateExports} from '@/storage/export-session';
const mockExport=jest.fn();
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:{exportAccount:mockExport,captureSession:()=>()=>{}}})}));
jest.mock('expo-sharing',()=>({isAvailableAsync:async()=>true,shareAsync:async()=>{}}));
jest.mock('expo-file-system',()=>({Paths:{cache:'cache'},File:class{uri='fixture';exists=false;create(){this.exists=true;}write(){}delete(){this.exists=false;}}}));
beforeEach(()=>{mockExport.mockReset();openAccountStorage('alice');allowPrivateExports();});
afterEach(()=>{delete process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED;});
it('hides account export in a compatible rollback build without fetching account data',async()=>{
 process.env.EXPO_PUBLIC_ACCOUNT_EXPORT_DISABLED='1';
 await render(<I18nProvider initial="en"><AccountExport/></I18nProvider>);
 expect(screen.queryByTestId('export-account')).toBeNull();
 expect(screen.queryByText(/contains sensitive/)).toBeNull();
 expect(mockExport).not.toHaveBeenCalled();
});
it('requires a deliberate press, shows progress, then reports cancellation instead of success',async()=>{
 let finish!:(v:unknown)=>void;mockExport.mockImplementation(()=>new Promise(r=>finish=r));
 await render(<I18nProvider initial="en"><AccountExport/></I18nProvider>);
 expect(mockExport).not.toHaveBeenCalled();expect(screen.getByText(/contains sensitive/)).toBeTruthy();
 await fireEvent.press(screen.getByTestId('export-account'));
 await waitFor(()=>expect(screen.getByTestId('export-account').props.accessibilityState.busy).toBe(true));
 await act(async()=>{stopPrivateExports();finish({schema_version:1,account:{id:'alice'},data:{}});});
 expect(screen.getByText(/Could not complete export/)).toBeTruthy();
 expect(screen.getByTestId('export-account').props.accessibilityState.busy).toBe(false);
});
it('provides Hebrew sensitive-data and shared-copy disclosures',async()=>{
 await render(<I18nProvider initial="he"><AccountExport/></I18nProvider>);
 expect(screen.getByText(/הקובץ כולל מידע רגיש/)).toBeTruthy();expect(screen.getByText(/מחיקת חשבון אינה מוחקת עותקים/)).toBeTruthy();
});
