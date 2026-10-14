import {render,screen,fireEvent,waitFor} from '@testing-library/react-native';
import {PrivateProductSave} from '../PrivateProductSave';
import {I18nProvider} from '@/i18n/I18nProvider';
import {manualDraft} from '@/domain/drafts';
import {toUnifiedReview} from '@/domain/unified-review';
const mockSaved:unknown[][]=[];let mockFail=true;
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({private_products:true}),savePrivateProduct:async(...args:unknown[])=>{mockSaved.push(args);if(mockFail)throw new Error('lost response');return {id:args[0],version:1,item:args[1]};}};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:mockApi})}));
jest.mock('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA256'},digestStringAsync:async(_a:string,text:string)=>jest.requireActual('crypto').createHash('sha256').update(text).digest('hex')}));
test('only confirmed product can save; network retry retains private identity and key',async()=>{
 const draft=toUnifiedReview({...manualDraft('a'.repeat(32)),name:'Milk',amount:'100'});draft.analysis!.foods[0].confirmed=true;
 let updated=false;await render(<I18nProvider initial="en"><PrivateProductSave draft={draft} onSaved={()=>{updated=true;}} disabled={false}/></I18nProvider>);
 const button=await screen.findByText('Save confirmed product privately');
 await fireEvent.press(button);await waitFor(()=>expect(mockSaved).toHaveLength(1));
 mockFail=false;await fireEvent.press(button);await waitFor(()=>expect(updated).toBe(true));
 expect(mockSaved[0]).toEqual(mockSaved[1]);expect(screen.getByText('Saved privately')).toBeTruthy();
});
