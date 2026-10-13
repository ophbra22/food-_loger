import { render,screen } from '@testing-library/react-native';
import Review from '@/app/(app)/add/review';
import { manualDraft } from '@/domain/drafts';
import { I18nProvider } from '@/i18n/I18nProvider';
const mockDraft={...manualDraft('offline'),name:'Offline'};
jest.mock('@/auth/AuthProvider',()=>({useAuth:()=>({api:{capabilities:async()=>{throw new Error('offline');}}})}));
jest.mock('@/data/DraftProvider',()=>({useDraft:()=>({draft:mockDraft,update:jest.fn(),saving:false})}));
jest.mock('@/data/catalog',()=>({useCatalog:()=>({foods:[],error:null,reload:jest.fn()}),catalogFood:()=>null}));
jest.mock('../LegacyMealReview',()=>({LegacyMealReview:()=>{const {Text}=jest.requireActual('react-native');return <Text>Editable offline draft</Text>;}}));
jest.mock('../MealAnalysisReview',()=>({MealAnalysisReview:()=>null}));
test('failed capabilities do not prevent editing a local draft',async()=>{
 await render(<I18nProvider initial="en"><Review/></I18nProvider>);
 expect(await screen.findByText('Editable offline draft')).toBeTruthy();
});
