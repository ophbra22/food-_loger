import {render,screen,fireEvent,waitFor} from '@testing-library/react-native';
import {ApiError} from '@/api/errors';
import {PrivateProductSave} from '../PrivateProductSave';
import {I18nProvider} from '@/i18n/I18nProvider';
import {manualDraft} from '@/domain/drafts';
import {toUnifiedReview} from '@/domain/unified-review';
const mockSaved:unknown[][]=[];let mockFail=true;let mockError:unknown=new Error('lost response');
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({private_products:true}),savePrivateProduct:async(...args:unknown[])=>{mockSaved.push(args);if(mockFail)throw mockError;return {id:args[0],version:1,item:args[1]};}};
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

beforeEach(()=>{mockSaved.length=0;mockFail=true;mockError=new Error('lost response');});
test.each(['en','he'] as const)('private product cap is explained before saving and at rejection: %s',async language=>{
 mockError=new ApiError('validation',{status:422,detail:'Private product limit reached; remove an unused product first.'});
 const draft=toUnifiedReview({...manualDraft('b'.repeat(32)),name:'Milk',amount:'100'});draft.analysis!.foods[0].confirmed=true;
 await render(<I18nProvider initial={language}><PrivateProductSave draft={draft} onSaved={jest.fn()} disabled={false}/></I18nProvider>);
 const button=await screen.findByText(language==='en'?'Save confirmed product privately':'שמירת מוצר מאושר באופן פרטי');
 expect(screen.getByText(language==='en'?'Up to 100 active private products per account. Delete an unused product from My private products to make room.':'אפשר לשמור עד 100 מוצרים פרטיים פעילים בחשבון. כדי לפנות מקום, מחקו מוצר שאינו נחוץ מתוך המוצרים הפרטיים שלי.')).toBeTruthy();
 await fireEvent.press(button);
 expect(await screen.findByText(language==='en'?'The private product limit was reached. Delete an unused product, then retry. Your meal draft is retained.':'הגעתם למגבלת המוצרים הפרטיים. מחקו מוצר שאינו נחוץ ונסו שוב. טיוטת הארוחה נשמרת.')).toBeTruthy();
 expect(mockSaved).toHaveLength(1);
});
