/** On-device recognition only. No audio files, model download, cloud fallback or transcript logging. */
import {Platform} from 'react-native';

export type SpeechState='idle'|'checking'|'listening'|'stopping'|'denied'|'unavailable'|'error';
export type SpeechEvent={text?:string;final?:boolean;error?:string};
export interface SpeechBridge {
 permissions():Promise<{granted:boolean;canAskAgain:boolean}>;
 requestPermission():Promise<{granted:boolean;canAskAgain:boolean}>;
 available(locale:string):Promise<boolean>;
 listen(name:'start'|'result'|'end'|'error',callback:(event:SpeechEvent)=>void):()=>void;
 start(locale:string):void;stop():void;abort():void;
}
export class SpeechSession {
 private state:SpeechState='idle';private generation=0;private disposed=false;
 private removers:(()=>void)[]=[];private timer:ReturnType<typeof setTimeout>|null=null;
 constructor(private bridge:SpeechBridge,private onState:(state:SpeechState)=>void,private onText:(text:string)=>void){}
 private set(state:SpeechState){this.state=state;if(!this.disposed)this.onState(state);}
 private cleanup(){if(this.timer)clearTimeout(this.timer);this.timer=null;this.removers.splice(0).forEach(remove=>remove());}
 private finish(state:SpeechState,abort=false){this.generation++;this.cleanup();if(abort){try{this.bridge.abort();}catch{/* native interruption is already terminal */}}this.set(state);}
 async start(locale:'he-IL'|'en-US'){
  if(this.disposed||['checking','listening','stopping'].includes(this.state))return;
  const id=++this.generation;this.set('checking');
  const current=()=>!this.disposed&&id===this.generation;
  try{
   const available=await this.bridge.available(locale);if(!current())return;
   if(!available){this.finish('unavailable');return;}
   let permission=await this.bridge.permissions();if(!current())return;
   if(!permission.granted&&permission.canAskAgain){permission=await this.bridge.requestPermission();if(!current())return;}
   if(!permission.granted){this.finish('denied');return;}
   this.removers=[
    this.bridge.listen('start',()=>{if(current())this.set('listening');}),
    this.bridge.listen('result',event=>{if(current()&&typeof event.text==='string')this.onText(event.text.slice(0,2000));}),
    this.bridge.listen('end',()=>{if(current())this.finish('idle');}),
    this.bridge.listen('error',event=>{if(current())this.finish(event.error==='not-allowed'?'denied':event.error==='language-not-supported'?'unavailable':'error',true);}),
   ];
   this.bridge.start(locale);
   if(current())this.timer=setTimeout(()=>this.stop(),60000);
  }catch{if(current())this.finish('error',true);}
 }
 stop(){
  if(!['checking','listening'].includes(this.state))return;
  if(this.state==='checking'){this.cancel();return;}
  if(this.timer)clearTimeout(this.timer);this.set('stopping');
  const id=this.generation;
  try{this.bridge.stop();if(id===this.generation)this.timer=setTimeout(()=>this.cancel(),3000);}catch{this.finish('error',true);}
 }
 cancel(){this.finish('idle',true);}
 appState(state:string){if(state!=='active')this.cancel();}
 dispose(){this.disposed=true;this.finish('idle',true);}
}

export async function loadSpeechBridge():Promise<SpeechBridge|null>{
 if(process.env.EXPO_PUBLIC_VOICE_ENABLED!=='1'||!['ios','android'].includes(Platform.OS))return null;
 try{
  // Optional native binary: load lazily so old builds retain text/manual entry.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {ExpoSpeechRecognitionModule:module}:typeof import('expo-speech-recognition')=require('expo-speech-recognition');
  if(Platform.OS==='ios'&&(module as unknown as {biteflowOnDeviceGuard?:boolean}).biteflowOnDeviceGuard!==true)return null;
  return {
   // On-device iOS recognition needs microphone permission, not network-Speech permission.
   permissions:()=>module.getMicrophonePermissionsAsync(),requestPermission:()=>module.requestMicrophonePermissionsAsync(),
   available:async locale=>{
    if(!module.isRecognitionAvailable())return false;
    if(Platform.OS==='android'&&!module.supportsOnDeviceRecognition())return false;
    if(Platform.OS==='android'&&Number(Platform.Version)<33)return false;
    const {installedLocales}=await module.getSupportedLocales({});
    return installedLocales.some(value=>value.toLowerCase().replace('_','-')===locale.toLowerCase());
   },
   start:locale=>module.start({lang:locale,requiresOnDeviceRecognition:true,interimResults:true,continuous:false,maxAlternatives:1,recordingOptions:{persist:false}}),
   stop:()=>module.stop(),abort:()=>module.abort(),
   listen:(name,callback)=>{
    const sub=name==='result'?module.addListener('result',event=>callback({text:event.results[0]?.transcript,final:event.isFinal})):
     name==='error'?module.addListener('error',event=>callback({error:event.error})):
     module.addListener(name,()=>callback({}));
    return ()=>sub.remove();
   },
  };
 }catch{return null;}
}
