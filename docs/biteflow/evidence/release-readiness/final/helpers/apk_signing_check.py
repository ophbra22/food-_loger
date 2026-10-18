import hashlib,json,shutil,subprocess
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
apks=out/'all-enabled-artifacts-final';apks.mkdir(exist_ok=True)
for p in (root/'mobile/android/app/build/outputs/apk').glob('*/*.apk'):shutil.copy2(p,apks/p.name)
signer=sorted(Path('/Users/braude/Library/Android/sdk/build-tools').glob('*/apksigner'))[-1]
rows=[]
for directory in ('disabled-artifacts-final','all-enabled-artifacts-final'):
 for p in sorted((out/directory).glob('*.apk')):
  value=subprocess.check_output([str(signer),'verify','--print-certs',str(p)],text=True)
  assert 'CN=Android Debug' in value,value
  rows.append({'path':str(p.relative_to(root)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'signature_verified':True,'certificate':value.strip(),'release_signing':'NOT RUN; debug certificate only'})
assert len(rows)==4
(out/'native-artifacts-apk-signing.json').write_text(json.dumps(rows,indent=2)+'\n');print('Four local APK signatures verified; all use Android Debug certificates, no production signing.')
