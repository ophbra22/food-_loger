import hashlib,json,os,re,shutil,subprocess
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
aapt=Path('/Users/braude/Library/Android/sdk/build-tools/36.0.0/aapt2')
if not aapt.exists():aapt=sorted(aapt.parent.parent.glob('*/aapt2'))[-1]
artifacts=[]
for variant in ['debug','release']:
 source=root/f'mobile/android/app/build/outputs/apk/{variant}/app-{variant}.apk'
 target=out/f'rc06-all-enabled-{variant}.apk';shutil.copyfile(source,target)
 xml=subprocess.check_output([str(aapt),'dump','xmltree',str(target),'--file','AndroidManifest.xml'],text=True)
 resources=subprocess.check_output([str(aapt),'dump','resources',str(target)],text=True)
 signed=subprocess.check_output([str(aapt.with_name('apksigner')),'verify','--print-certs',str(target)],text=True)
 assert 'Android Debug' in signed
 assert 'expo.modules.biteflowwidgets.BiteflowWidget' in xml
 assert 'biteflow_widget_open' in resources and 'פתיחת BiteFlow' in resources
 section=resources.split('xml/biteflow_widget_info\n',1)[1].split('    resource ',1)[0]
 paths=re.findall(r'\(([^)]*)\) \(file\) (\S+) type=XML',section)
 assert {qualifier for qualifier,_ in paths}=={'','v31'}
 for qualifier,resource_path in paths:
  info=subprocess.check_output([str(aapt),'dump','xmltree',str(target),'--file',resource_path],text=True)
  assert 'minWidth' in info and 'minHeight' in info
  assert ('previewLayout' in info)==(qualifier=='v31')
  (out/f'apk-{variant}-widget-{qualifier or "base"}.txt').write_text(info)
 (out/f'apk-{variant}-manifest.txt').write_text(xml)
 (out/f'apk-{variant}-resources.txt').write_text(resources)
 (out/f'apk-{variant}-signature.txt').write_text(signed)
 artifacts.append({'path':str(target.relative_to(root)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'signature':'Android Debug; not store/release signing','resource_assertions':'Hebrew preview string and base/v31 widget metadata present','installed_or_launched':False})
(out/'native-artifacts.json').write_text(json.dumps(artifacts,indent=2)+'\n');print(json.dumps(artifacts))
