from pathlib import Path
import hashlib,json,re,shutil,subprocess,sys,xml.etree.ElementTree as ET,zipfile
out=Path(__file__).resolve().parent;root=out.parents[1];mode=sys.argv[1];assert mode in ('all-enabled','disabled');enabled=mode=='all-enabled'
dest=out/'artifacts'/('android-'+mode);dest.mkdir(parents=True,exist_ok=True)
aapt=sorted(Path('/Users/braude/Library/Android/sdk/build-tools').glob('*/aapt2'))[-1];signer=aapt.with_name('apksigner')
rows=[]
for config in ('debug','release'):
 source=root/'mobile/android/app/build/outputs/apk'/config/('app-'+config+'.apk');target=dest/source.name;shutil.copy2(source,target)
 xml=subprocess.check_output([str(aapt),'dump','xmltree',str(target),'--file','AndroidManifest.xml'],text=True)
 badging=subprocess.check_output([str(aapt),'dump','badging',str(target)],text=True)
 for key in ('BiteFlowWidgetsEnabled','BiteFlowHealthConnectEnabled'):
  chunk=xml[xml.index('"'+key+'"'):].split('E: ',1)[0];v=re.search(r'android:value.*?=(true|false)',chunk);assert v and (v.group(1)=='true')==enabled
 assert ('"android.permission.RECORD_AUDIO"' in xml)==enabled
 for feature in ('android.hardware.camera','android.hardware.camera.autofocus'):
  assert "uses-feature-not-required: name='"+feature+"'" in badging,(feature,badging)
  assert "uses-feature: name='"+feature+"'" not in badging
 assert 'uses-implied-feature: name=\'android.hardware.camera' not in badging
 with zipfile.ZipFile(target) as z:
  assert all(b'Rc02LintProbe' not in z.read(n) for n in z.namelist() if n.endswith('.dex'))
 signing=subprocess.check_output([str(signer),'verify','--print-certs',str(target)],text=True)
 assert 'Android Debug' in signing,signing
 for suffix,data in [('manifest.txt',xml),('badging.txt',badging),('signing.txt',signing)]: (dest/(config+'-'+suffix)).write_text(data)
 rows.append({'file':str(target.relative_to(root)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'mode':mode,'configuration':config,'signature':'Android Debug verified; NOT store signing','camera_and_autofocus_optional':True,'probe_absent':True,'compiled_health_widgets_voice_flags_match':True})
reports=[]
for prefix,p in [('app',root/'mobile/android/app'),('health',root/'mobile/modules/biteflow-health/android'),('widgets',root/'mobile/modules/biteflow-widgets/android')]:
 for f in (p/'build/reports').glob('lint-results-*.xml'):
  copy=dest/(prefix+'-'+f.name);shutil.copy2(f,copy)
  issues=ET.parse(copy).getroot().findall('issue');assert not any(i.attrib['severity'] in ('Error','Fatal') for i in issues)
  reports.append({'file':str(copy.relative_to(out)),'warnings':sum(i.attrib['severity']=='Warning' for i in issues),'errors':0})
tests=[]
for module in ('biteflow-widgets','biteflow-health'):
 for p in (root/'mobile/modules'/module/'android/build/test-results/testDebugUnitTest').glob('TEST-*.xml'):
  suite=ET.parse(p).getroot();d={k:int(suite.attrib.get(k,0)) for k in ('tests','failures','errors','skipped')};assert d['failures']==d['errors']==d['skipped']==0
  shutil.copy2(p,dest/(module+'-'+p.name));tests.append({'module':module,**d})
assert sum(t['tests'] for t in tests)==22
record={'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'mode':mode,'apks':rows,'lint':reports,'jvm':tests}
(out/('android-artifacts-'+mode+'.json')).write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
