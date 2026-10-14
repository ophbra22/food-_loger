import {registerRootComponent} from 'expo';
import {useFonts,Fredoka_400Regular,Fredoka_500Medium,Fredoka_600SemiBold} from '@expo-google-fonts/fredoka';
import {useState} from 'react';
import {I18nManager,DevSettings,ScrollView,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {I18nProvider} from '@/i18n/I18nProvider';
import {Button} from '@/components/Button';
import {AppText} from '@/components/AppText';
import {RecipeEditor} from '@/components/RecipeEditor';
import {LibraryPanel} from '@/components/LibraryPanel';
import {CopySelection} from '@/components/CopySelection';
import {LibraryStore} from '@/data/library-store';
import {libraryEntry} from '@/test-fixtures/library';
import {openAccountStorage} from '@/storage/kv';
import {randomUUID} from 'expo-crypto';
const owner='p04-synthetic-preview';openAccountStorage(owner);
const entry={...libraryEntry(),kind:'recipe',name:'My usual salad / הסלט הרגיל שלי',servings:4};
const api={captureSession:()=>()=>{},capabilities:async()=>({library:true,canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true}),library:async()=>({items:[entry],next_offset:null}),setFavorite:async()=>{},nutritionReferences:async()=>({foods:[]}),saveRecipe:async(_id,body)=>({...entry,...body,version:2,draft:{...entry.draft,items:body.items}}),recipe:async()=>entry,copySources:async()=>[{...entry,kind:'meal',entry_ids:['b'.repeat(32)]}],copyPreview:async()=>({preview_token:'a'.repeat(64),destination_populated:false,time_issues:[{id:entry.id,reason:'unknown_time'}],drafts:[]})};
const store=new LibraryStore(owner,api);
function App(){const [loaded]=useFonts({Fredoka_400Regular,Fredoka_500Medium,Fredoka_600SemiBold});const [tab,setTab]=useState('recipe');
 if(!loaded)return null;
 return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#14251D'}}><I18nProvider initial={I18nManager.isRTL?'he':'en'}>
  <ScrollView contentContainerStyle={{padding:20,gap:16}}><AppText variant="caption">P04 · Synthetic component preview</AppText>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}><Button compact label="EN / HE" onPress={()=>{I18nManager.allowRTL(true);I18nManager.forceRTL(!I18nManager.isRTL);DevSettings.reload();}}/>{['recipe','library','copy'].map(name=><Button compact key={name} label={name} onPress={()=>setTab(name)}/>)}</View>
   {tab==='recipe'?<RecipeEditor owner={owner} initial={entry} api={api} newKey={randomUUID} onSaved={()=>{}}/>:tab==='library'?<LibraryPanel store={store} onSelect={()=>{}}/>:<CopySelection api={api} sourceDay="2026-10-13" destinationDay="2026-10-14" newKey={randomUUID} onReview={async()=>{}}/>}
  </ScrollView></I18nProvider></SafeAreaView></SafeAreaProvider>;
}registerRootComponent(App);
