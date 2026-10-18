from pathlib import Path
import hashlib,json,plistlib,shutil,subprocess,sys
out=Path(__file__).resolve().parent;root=out.parents[1];mode=sys.argv[1];assert mode in ('all-enabled','disabled');enabled=mode=='all-enabled'
rows=[]
for configuration in ('Debug','Release'):
 source=out/'ios-release-all-enabled/Build/Products'/(configuration+'-iphonesimulator')/'Biteflow.app'
 dest=out/'artifacts'/('ios-'+mode+'-'+configuration.lower())/'Biteflow.app'
 assert not dest.exists();dest.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(source,dest,symlinks=True)
 info=plistlib.loads((dest/'Info.plist').read_bytes());assert info['BiteFlowHealthEnabled'] is enabled and info['BiteFlowWidgetsEnabled'] is enabled
 assert bool(info.get('NSMicrophoneUsageDescription')) is enabled
 assert bool(info.get('NSSpeechRecognitionUsageDescription')) is enabled
 extension=dest/'PlugIns/BiteflowWidgets.appex';ei=plistlib.loads((extension/'Info.plist').read_bytes());assert ei['BiteFlowWidgetsEnabled'] is enabled
 entries=[{'path':str(p.relative_to(dest)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(dest.rglob('*')) if p.is_file()]
 manifest=out/('ios-'+mode+'-'+configuration.lower()+'-files.json');manifest.write_text(json.dumps(entries,indent=2)+'\n')
 if configuration=='Release':assert (dest/'main.jsbundle').exists()
 rows.append({'path':str(dest.relative_to(root)),'configuration':configuration,'files':len(entries),'manifest_sha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'minimum_os':info['MinimumOSVersion'],'compiled_health_widgets_voice_match':True,'widget_extension_present':True,'bundled_js':(dest/'main.jsbundle').exists(),'signing':'CODE_SIGNING_ALLOWED=NO; simulator only','source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()})
(out/('ios-artifacts-'+mode+'.json')).write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))
