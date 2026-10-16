import {Platform} from 'react-native';
import {requireOptionalNativeModule} from 'expo';
import type {WidgetPort} from './publisher';
const bridge=Platform.OS==='ios'||Platform.OS==='android'?requireOptionalNativeModule<WidgetPort>('BiteflowWidgets'):null;
export const widgetsEnabled=process.env.EXPO_PUBLIC_WIDGETS_ENABLED==='1';
export function createWidgetPort(native:WidgetPort|null,enabled:boolean):WidgetPort{
 const require=()=>{if(!enabled||!native||!native.available())throw Error('Widgets unavailable');return native;};
 return {available:()=>{try{return !!enabled&&!!native&&native.available();}catch{return false;}},bind:session=>require().bind(session),publish:(session,sequence,json)=>require().publish(session,sequence,json),clear:()=>native?.clear()};
}
export const widgetPort=createWidgetPort(bridge,widgetsEnabled);
