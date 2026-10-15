// Local P07 review harness: real components with deterministic fixtures, not a native E2E.
import {registerRootComponent} from 'expo';
import {useState} from 'react';
import {View,ScrollView} from 'react-native';
import {I18nProvider} from './src/i18n/I18nProvider';
import {TrackingPanel} from './src/components/TrackingPanel';
import {TrendsChart} from './src/components/TrendsChart';
import {AppText} from './src/components/AppText';
import {TrackingStore} from './src/data/tracking-store';
import fixture from './src/test-fixtures/trends.json';
import type {TrendPeriod} from './src/domain/trends';
import {openAccountStorage} from './src/storage/kv';
import {colors} from './src/theme/tokens';
const day='2026-10-11';let entries:any[]=[];
const api={capabilities:async()=>({canonical_writes:true,partial_core_writes:true,tiny_portion_writes:true,tracking:true,tracking_writes:true}),tracking:async()=>({from:day,to:day,items:entries,total:entries.reduce((s,e)=>s+e.value,0),has_more:false,latest:entries.at(-1)??null,previous:null,delta:null}),saveMeasurement:async(kind:any,body:any,entry:any)=>{const row={...body,kind,id:entry?.id??String(entries.length+1).padStart(32,'0'),version:1,source:'manual',external_id:null,created_at:body.occurred_at,updated_at:body.occurred_at};entries=[...entries.filter(i=>i.id!==row.id),row];return row;},deleteMeasurement:async(_:any,id:string)=>{entries=entries.filter(e=>e.id!==id);}};
openAccountStorage('preview');
function Preview(){const [store]=useState(()=>new TrackingStore('preview',api,()=>{}));const language=location.search.includes('he')?'he':'en';return <I18nProvider initial={language}><ScrollView style={{backgroundColor:colors.ground}} contentContainerStyle={{padding:24,gap:24,maxWidth:700,alignSelf:'center',width:'100%'}}><AppText variant="heading">P07 · component fixture preview</AppText><View style={{direction:language==='he'?'rtl':'ltr',gap:24}}><TrackingPanel kind="water" day={day} store={store} target={2000}/><TrendsChart period={fixture.current as TrendPeriod} metric="calories"/></View></ScrollView></I18nProvider>;}
registerRootComponent(Preview);
