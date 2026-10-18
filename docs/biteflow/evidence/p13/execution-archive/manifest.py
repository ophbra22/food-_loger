import hashlib,json,subprocess,shutil,zipfile
from pathlib import Path
root=Path.cwd();scratch=root/'.superpowers/sdd/p13-plan';out=root/'docs/biteflow/evidence/p13'
dest=root/'runtime/biteflow-p13-candidate';dest.mkdir(parents=True,exist_ok=True)
artifacts=[]
def include(path,name,source):
 target=dest/name
 if path.suffix==".app":
  subprocess.run(["ditto","-c","-k","--sequesterRsrc","--keepParent",str(path),str(target)],check=True)
 elif path.is_dir():
  with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for p in sorted(path.rglob('*')):
    if p.is_file():z.write(p,str(p.relative_to(path.parent)))
 else:shutil.copyfile(path,target)
 artifacts.append({'name':name,'path':str(target),'source':source,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
head=subprocess.check_output(['git','rev-parse','HEAD']).decode().strip()
for p in (scratch/'dist-review').iterdir(): include(p,'46b3a91-'+p.name,head)
include(root/'mobile/android/app/build/outputs/apk/release/app-release.apk','2d0b3d6-biteflow-local-release.apk','2d0b3d6 (mobile tree unchanged)' )
include(root/'mobile/android/app/build/outputs/apk/debug/app-debug.apk','2d0b3d6-biteflow-local-debug.apk','2d0b3d6 (mobile tree unchanged)' )
include(scratch/'export-final','2d0b3d6-javascript-export.zip','2d0b3d6 (mobile tree unchanged)' )
app=scratch/'ios-source-build/Build/Products/Release-iphonesimulator/Biteflow.app'
# iOS build failed; never archive an incomplete app.
manifest={'phase':'P13','status':'LOCAL ONLY — full acceptance BLOCKED','base':'8ce7ad3889813276d63d4d4e016299605eafa507','source_commit':head,'source_trees':{p:subprocess.check_output(['git','rev-parse',f'HEAD:{p}']).decode().strip() for p in ['src','tests','mobile']},'environment':{'api':'http://127.0.0.1:8765','widgets':'0','health':'0','health_connect':'0','live_ai':False,'native_signing':'Android debug key; iOS build FAILED, no iOS candidate; no distribution signing'},'artifacts':artifacts,'production':False,'staging':False,'P14':'NOT STARTED'}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'source':head,'artifacts':len(artifacts),'saved':str(dest)}))
