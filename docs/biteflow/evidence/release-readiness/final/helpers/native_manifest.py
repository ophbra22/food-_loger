import hashlib,json,plistlib,re,shutil,subprocess,sys
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
mode=sys.argv[1];enabled=mode=='all-enabled';assert mode in ('disabled','all-enabled')
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
record={'source_commit':source,'mode':mode,'local_only':True,'production_signed':False,'ios':[],'android':[],'inputs':{}}
for name in ('mobile/app.config.ts','mobile/package.json','mobile/package-lock.json','mobile/plugins/speech-guard.json','mobile/plugins/with-on-device-speech.cjs','mobile/ios/Podfile.lock'):
 record['inputs'][name]=sha(root/name)
for config in ('Debug','Release'):
 dirname=('ios-final-all-'+config.lower()) if enabled else ('ios-source-off-'+config.lower())
 app=out/dirname/'Build/Products'/(config+'-iphonesimulator')/'Biteflow.app'
 info=plistlib.loads((app/'Info.plist').read_bytes())
 assert info['BiteFlowHealthEnabled'] is enabled and info['BiteFlowWidgetsEnabled'] is enabled
 assert bool(info.get('NSMicrophoneUsageDescription')) is enabled
 assert bool(info.get('NSSpeechRecognitionUsageDescription')) is enabled
 widget=app/'PlugIns/BiteflowWidgets.appex';wi=plistlib.loads((widget/'Info.plist').read_bytes())
 assert wi['BiteFlowWidgetsEnabled'] is enabled
 entries=[{'path':str(p.relative_to(app)),'sha256':sha(p),'bytes':p.stat().st_size} for p in sorted(app.rglob('*')) if p.is_file()]
 data=json.dumps(entries,sort_keys=True).encode()
 (out/('ios-'+mode+'-'+config.lower()+'-files.json')).write_bytes(data+b'\n')
 record['ios'].append({'path':str(app.relative_to(root)),'configuration':config,'files':len(entries),'file_manifest_sha256':hashlib.sha256(data+b'\n').hexdigest(),'executable_sha256':sha(app/'Biteflow'),'bundle_id':info['CFBundleIdentifier'],'minimum_os':info['MinimumOSVersion'],'health_enabled':info['BiteFlowHealthEnabled'],'widgets_enabled':info['BiteFlowWidgetsEnabled'],'widget_extension_present':widget.exists(),'microphone_and_speech_permission_text':enabled,'js_bundle_present':(app/'main.jsbundle').exists(),'signature':'not signed; simulator only'})
apks=out/('all-enabled-artifacts-final' if enabled else 'disabled-artifacts-final')
if enabled:
 apks.mkdir(exist_ok=True)
 for p in (root/'mobile/android/app/build/outputs/apk').glob('*/*.apk'):shutil.copy2(p,apks/p.name)
aapt=sorted(Path('/Users/braude/Library/Android/sdk/build-tools').glob('*/aapt2'))[-1]
for p in sorted(apks.glob('*.apk')):
 xml=subprocess.check_output([str(aapt),'dump','xmltree',str(p),'--file','AndroidManifest.xml'],text=True)
 for key in ('BiteFlowWidgetsEnabled','BiteFlowHealthConnectEnabled'):
  chunk=xml[xml.index('"'+key+'"'):].split('E: ',1)[0]
  value=re.search(r'android:value.*?=(true|false)',chunk)
  assert value and (value.group(1)=='true') is enabled,(key,chunk)
 assert ('"android.permission.RECORD_AUDIO"' in xml) is enabled
 (out/('android-'+mode+'-'+p.stem+'-manifest.txt')).write_text(xml)
 badging=subprocess.check_output([str(aapt),'dump','badging',str(p)],text=True)
 record['android'].append({'path':str(p.relative_to(root)),'sha256':sha(p),'bytes':p.stat().st_size,'widgets_and_health_connect_enabled':enabled,'record_audio_permission':enabled,'sdk':re.findall(r"(?:sdkVersion|targetSdkVersion):'[^']+'",badging),'signing':'local debug key, not store signed'})
assert len(record['android'])==2
(out/('native-artifacts-'+mode+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
