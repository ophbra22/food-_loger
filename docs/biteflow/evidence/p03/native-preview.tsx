import {registerRootComponent} from 'expo';
import {useFonts,Fredoka_400Regular,Fredoka_500Medium,Fredoka_600SemiBold} from '@expo-google-fonts/fredoka';
import {useState} from 'react';
import {I18nManager,DevSettings,ScrollView,View,Text,Button} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {I18nProvider} from '@/i18n/I18nProvider';
import {DayDial} from '@/components/DayDial';
import {GoalDashboard} from '@/components/GoalDashboard';
import {GoalSettings} from '@/components/GoalSettings';
import {GoalsStore} from '@/data/goals-store';
import {goalProgress} from '@/domain/goals';
import {first} from '@/test-fixtures/goals';
import {openAccountStorage} from '@/storage/kv';
const doc={version:1,revisions:[first]};
openAccountStorage('p03-synthetic');
const store=new GoalsStore('p03-synthetic',{getGoals:async()=>doc,capabilities:async()=>({goals:true}),putGoals:async update=>({version:2,revisions:[first,{...first,...update,version:2,id:'b'.repeat(32)}]})});
function App(){
 const [loaded]=useFonts({Fredoka_400Regular,Fredoka_500Medium,Fredoka_600SemiBold});
 const [settings,setSettings]=useState(false);
 const summary={count:1,calories:2070,protein:150,carbs:200,fat:50};
 if(!loaded)return null;
 return <SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:'#1B211D'}}><I18nProvider initial={I18nManager.isRTL?'he':'en'}>
 <View style={{padding:8}}><Text style={{color:'white'}}>LOCAL SYNTHETIC COMPONENT PREVIEW</Text><Button title="Switch EN / HE" onPress={()=>{I18nManager.allowRTL(true);I18nManager.forceRTL(!I18nManager.isRTL);DevSettings.reload();}}/><Button title={settings?'Show dashboard':'Show settings'} onPress={()=>setSettings(!settings)}/></View>
 <ScrollView contentContainerStyle={{padding:20,gap:20}}>{settings?<GoalSettings store={store}/>:<><DayDial meals={[]} onAdd={()=>{}} onOpenMeal={()=>{}} caloriesGoal={goalProgress(summary,first).calories}/><GoalDashboard summary={summary} goal={first} onEdit={()=>setSettings(true)}/></>}</ScrollView>
 </I18nProvider></SafeAreaView></SafeAreaProvider>;
}
registerRootComponent(App);
