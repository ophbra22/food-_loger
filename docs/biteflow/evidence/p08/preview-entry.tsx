// Synthetic component preview. Reconstructed outside Expo routes; never shipped.
import {useState} from 'react';
import {AppRegistry,ScrollView,View} from 'react-native';
import {I18nProvider} from './src/i18n/I18nProvider';
import {AdvicePanel} from './src/components/AdvicePanel';
import {AppText} from './src/components/AppText';
import {adviceText} from './src/i18n/advice';
import {recommendationDraft} from './src/domain/advice';
import fixture from './src/test-fixtures/advice.json';
function Preview(){const language=location.search.includes('he')?'he':'en',feature=location.search.includes('insight')?'insight':'recommendation';const [selected,setSelected]=useState('');return <I18nProvider initial={language}><ScrollView style={{backgroundColor:'#162b20'}} contentContainerStyle={{padding:24,gap:20}}><View style={{gap:20,direction:language==='he'?'rtl':'ltr'}}><AppText variant="heading">{adviceText(language,feature)}</AppText><AppText>2026-10-11 – 2026-10-17 · Synthetic local fixture</AppText><AdvicePanel data={fixture[language][feature] as any} selectable onSelect={choice=>{const draft=recommendationDraft(choice,'preview-draft-key');setSelected(`${draft.origin}: ${draft.analysis?.foods[0].amount} g, editable, unsaved`);}}/><AppText testID="preview-selection">{selected}</AppText></View></ScrollView></I18nProvider>;}
AppRegistry.registerComponent('Preview',()=>Preview);AppRegistry.runApplication('Preview',{rootTag:document.getElementById('root')});
