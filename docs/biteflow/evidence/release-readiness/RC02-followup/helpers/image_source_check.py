import hashlib,json,subprocess
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
code="import pathlib,hashlib,json,foodlogger; p=pathlib.Path(foodlogger.__file__).parent; print(json.dumps({str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in p.rglob('*') if f.is_file() and '__pycache__' not in f.parts}))"
data=json.loads(subprocess.check_output(['docker','run','--rm','--network=none','--read-only','biteflow-rc00-05-audit:local','python','-c',code],text=True))
paths=subprocess.check_output(['git','ls-files','src/foodlogger'],cwd=root,text=True).splitlines()
for name in paths:
 p=root/name;assert data[str(p.relative_to(root/'src/foodlogger'))]==hashlib.sha256(p.read_bytes()).hexdigest(),name
result={'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'matched_files':len(paths),'image_id':subprocess.check_output(['docker','image','inspect','--format','{{.Id}}','biteflow-rc00-05-audit:local'],text=True).strip(),'network':'none','filesystem':'read-only','ai_inference':'not invoked','package_source_matches':'PASS'}
(out/'shipping-source-final.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
