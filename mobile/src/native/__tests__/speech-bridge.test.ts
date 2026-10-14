import {Platform} from 'react-native';
import {loadSpeechBridge} from '../speech';
const starts:unknown[]=[];
const mockModule={biteflowOnDeviceGuard:true,isRecognitionAvailable:()=>true,supportsOnDeviceRecognition:()=>false,
 getSupportedLocales:async()=>({locales:['he-IL','en-US'],installedLocales:['he-IL']}),getMicrophonePermissionsAsync:async()=>({granted:true,canAskAgain:true}),requestMicrophonePermissionsAsync:async()=>({granted:true,canAskAgain:true}),
 start:(options:unknown)=>starts.push(options),stop:()=>{},abort:()=>{},addListener:()=>({remove:()=>{}})};
jest.mock('expo-speech-recognition',()=>({ExpoSpeechRecognitionModule:mockModule}));
const originalOS=Platform.OS,originalFlag=process.env.EXPO_PUBLIC_VOICE_ENABLED;
beforeEach(()=>{Platform.OS='ios';process.env.EXPO_PUBLIC_VOICE_ENABLED='1';mockModule.biteflowOnDeviceGuard=true;starts.length=0;});
afterEach(()=>{Platform.OS=originalOS;if(originalFlag===undefined)delete process.env.EXPO_PUBLIC_VOICE_ENABLED;else process.env.EXPO_PUBLIC_VOICE_ENABLED=originalFlag;});
it('selected installed iOS locale works even if the default recognizer has no on-device model',async()=>{
 const bridge=await loadSpeechBridge();expect(await bridge?.available('he-IL')).toBe(true);expect(await bridge?.available('en-US')).toBe(false);
 bridge?.start('he-IL');expect(starts).toEqual([{lang:'he-IL',requiresOnDeviceRecognition:true,interimResults:true,continuous:false,maxAlternatives:1,recordingOptions:{persist:false}}]);
});
it('fails closed for an unguarded iOS binary and for the default-off feature',async()=>{
 mockModule.biteflowOnDeviceGuard=false;expect(await loadSpeechBridge()).toBeNull();
 mockModule.biteflowOnDeviceGuard=true;process.env.EXPO_PUBLIC_VOICE_ENABLED='0';expect(await loadSpeechBridge()).toBeNull();expect(starts).toEqual([]);
});
it('never enables browser speech, which may use a remote recognition service',async()=>{Platform.OS='web';expect(await loadSpeechBridge()).toBeNull();});
