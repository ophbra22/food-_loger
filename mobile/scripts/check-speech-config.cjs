const {execFileSync}=require('node:child_process');const assert=require('node:assert/strict');
for(const enabled of ['0','1']){
 const env={...process.env,EXPO_PUBLIC_VOICE_ENABLED:enabled,EXPO_NO_DOTENV:'1',EXPO_NO_TELEMETRY:'1',EXPO_OFFLINE:'1',EXPO_PUBLIC_API_URL:'http://127.0.0.1:8765'};
 const config=JSON.parse(execFileSync(process.execPath,['node_modules/expo/bin/cli','config','--type','introspect','--json'],{env,encoding:'utf8',maxBuffer:8*1024*1024}));
 const mods=config._internal.modResults;
 const plist=mods.ios.infoPlist;
 const permissions=mods.android.manifest.manifest['uses-permission'];
 const microphone=permissions.find(p=>p.$['android:name']==='android.permission.RECORD_AUDIO');
 assert.equal(!!plist.NSMicrophoneUsageDescription,enabled==='1','iOS microphone purpose must match voice flag');
 assert.equal(!!microphone&&microphone.$['tools:node']!=='remove',enabled==='1','Android microphone permission must match voice flag');
 console.log('PASS: resolved iOS/Android microphone configuration, voice='+enabled);
}
