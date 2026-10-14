import AsyncStorage from '@react-native-async-storage/async-storage';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {LabelEntry} from '../LabelEntry';
import {MealAnalysisReview} from '../MealAnalysisReview';
import {I18nProvider} from '@/i18n/I18nProvider';
import {DraftProvider,useDraft} from '@/data/DraftProvider';
import {openAccountStorage} from '@/storage/kv';
import {emptyNutrition} from '@/domain/nutrition';
let mockBarcode='',mockLookupFail=false,mockOcr=false;
const mockLookups:string[]=[];
let mockLookupWait:Promise<void>|null=null;
const mockResult=()=>({confirmed:false,warnings:[],observations:{},product:{barcode:mockBarcode,name:'מוצר',brand:null,quantity:null,basis_unit:'g',serving_quantity:null,nutrition:{...emptyNutrition(),calories:90},source:'label',source_url:'',raw_nutriments:{},nutriment_units:{},missing_nutrients:['protein'],notes:[]}});
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({label_ocr:mockOcr,private_products:false}),parseLabel:async()=>mockResult(),extractLabel:async()=>mockResult(),
 product:async(barcode:string)=>{mockLookups.push(barcode);if(mockLookupWait)await mockLookupWait;if(mockLookupFail)throw new Error('unavailable');return {...mockResult().product,name:'Exact barcode product',source:'Open Food Facts',source_version:'off:1'};},nutritionReferences:async()=>({foods:[]})};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:mockApi,journal:null})}));
jest.mock('expo-router',()=>({router:{replace:jest.fn(),dismissTo:jest.fn(),back:jest.fn()},useNavigation:()=>({canGoBack:()=>true})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}));
jest.mock('expo-image-picker',()=>({requestCameraPermissionsAsync:async()=>({granted:true}),launchCameraAsync:async()=>({canceled:false,assets:[{uri:'file:///mock.jpg'}]}),launchImageLibraryAsync:jest.fn()}));
jest.mock('@/data/images',()=>({prepareUpload:async()=>({uri:'file:///mock-upload.jpg',dispose:jest.fn()})}));
function Harness(){const {draft}=useDraft();return draft?.analysis?<MealAnalysisReview/>:<LabelEntry/>;}
beforeEach(async()=>{await AsyncStorage.clear();openAccountStorage('alice');mockBarcode='';mockLookupFail=false;mockOcr=false;mockLookups.length=0;mockLookupWait=null;process.env.EXPO_PUBLIC_LABEL_OCR_ENABLED='1';});
afterEach(()=>{delete process.env.EXPO_PUBLIC_LABEL_OCR_ENABLED;});
test('manual label stays editable, reaches shared review, no automatic confirmation or amount',async()=>{
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.changeText(await screen.findByTestId('label-text'),'מוצר\n100 g\nenergy 90 kcal');
 expect(screen.queryByTestId('label-camera')).toBeNull();
 await fireEvent.press(screen.getByTestId('label-parse'));
 await waitFor(()=>expect(screen.getByTestId('save-analyzed-meal')).toBeTruthy());
 expect(screen.getByText('Confirm food and portion')).toBeTruthy();
 expect(screen.getByTestId('food-weight-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').props.value).toBe('');
});

test('an OCR barcode resolves the exact attributed product before shared review',async()=>{
 mockOcr=true;mockBarcode='7290000000000';
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.press(await screen.findByTestId('label-camera'));
 await waitFor(()=>expect(mockLookups).toEqual([mockBarcode]));
 expect((await screen.findAllByText('Exact barcode product')).length).toBeGreaterThan(0);
 expect(screen.getByText('Open Food Facts')).toBeTruthy();
 expect(screen.getByText('Confirm food and portion')).toBeTruthy();
});
test('unavailable exact barcode requires an explicit retained-label fallback',async()=>{
 mockOcr=true;mockBarcode='7290000000000';mockLookupFail=true;
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.press(await screen.findByTestId('label-camera'));
 await screen.findByTestId('label-fallback');
 expect(screen.queryByTestId('save-analyzed-meal')).toBeNull();
 await fireEvent.press(screen.getByTestId('label-fallback'));
 expect(await screen.findByTestId('save-analyzed-meal')).toBeTruthy();
 expect(screen.getByText('Confirm food and portion')).toBeTruthy();
});
test('cancelling during exact barcode resolution prevents a late review transition',async()=>{
 mockOcr=true;mockBarcode='7290000000000';let finish!:()=>void;mockLookupWait=new Promise(resolve=>{finish=resolve;});
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 const camera=await screen.findByTestId('label-camera');
 const pendingPress=fireEvent.press(camera);
 await waitFor(()=>expect(mockLookups).toHaveLength(1));
 await fireEvent.press(screen.getByText('Cancel'));
 await act(async()=>finish());
 await pendingPress;
 expect(screen.queryByTestId('save-analyzed-meal')).toBeNull();
 expect(screen.getByTestId('label-text')).toBeTruthy();
});
