import AsyncStorage from '@react-native-async-storage/async-storage';
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {LabelEntry} from '../LabelEntry';
import {MealAnalysisReview} from '../MealAnalysisReview';
import {I18nProvider} from '@/i18n/I18nProvider';
import {DraftProvider,useDraft} from '@/data/DraftProvider';
import {openAccountStorage} from '@/storage/kv';
import {emptyNutrition} from '@/domain/nutrition';
const mockApi={captureSession:()=>()=>{},capabilities:async()=>({label_ocr:false,private_products:false}),parseLabel:async()=>({confirmed:false,warnings:[],observations:{},product:{barcode:'',name:'מוצר',brand:null,quantity:null,basis_unit:'g',serving_quantity:null,nutrition:{...emptyNutrition(),calories:90},source:'label',source_url:'',raw_nutriments:{},nutriment_units:{},missing_nutrients:['protein'],notes:[]}}),nutritionReferences:async()=>({foods:[]})};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({user:{id:'alice'},api:mockApi,journal:null})}));
jest.mock('expo-router',()=>({router:{replace:jest.fn(),dismissTo:jest.fn(),back:jest.fn()},useNavigation:()=>({canGoBack:()=>true})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}));
jest.mock('expo-image-picker',()=>({launchImageLibraryAsync:jest.fn()}));
jest.mock('@/data/images',()=>({prepareUpload:jest.fn()}));
function Harness(){const {draft}=useDraft();return draft?.analysis?<MealAnalysisReview/>:<LabelEntry/>;}
beforeEach(async()=>{await AsyncStorage.clear();openAccountStorage('alice');});
test('manual label stays editable, reaches shared review, no automatic confirmation or amount',async()=>{
 await render(<I18nProvider initial="en"><DraftProvider><Harness/></DraftProvider></I18nProvider>);
 await fireEvent.changeText(await screen.findByTestId('label-text'),'מוצר\n100 g\nenergy 90 kcal');
 expect(screen.queryByTestId('label-camera')).toBeNull();
 await fireEvent.press(screen.getByTestId('label-parse'));
 await waitFor(()=>expect(screen.getByTestId('save-analyzed-meal')).toBeTruthy());
 expect(screen.getByText('Confirm food and portion')).toBeTruthy();
 expect(screen.getByTestId('food-weight-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa').props.value).toBe('');
});
