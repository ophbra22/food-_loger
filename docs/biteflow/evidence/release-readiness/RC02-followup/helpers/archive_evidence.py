from pathlib import Path
import gzip,hashlib,json,shutil
out=Path(__file__).resolve().parent;root=out.parents[1];dest=root/'docs/biteflow/evidence/release-readiness/RC02-followup';dest.mkdir(parents=True,exist_ok=True)
selected=[p for p in out.iterdir() if p.is_file() and p.suffix in ('.json','.log','.xml','.txt') and not p.name.startswith('upstream-')]
for name in ('base-audit','lint-first-pass','root-lint-reports'):
 selected.extend(p for p in (out/name).rglob('*') if p.is_file() and p.suffix in ('.json','.xml','.txt'))
selected.extend(p for p in (out/'artifacts').rglob('*') if p.is_file() and p.suffix in ('.json','.xml','.txt'))
# Explicitly no credentials, containers, node_modules, source-package copies, images or app/APK binaries.
records=[]
for p in sorted(selected):
 relative=p.relative_to(out);raw=p.read_bytes();stored=raw;target=dest/relative
 if len(raw)>192*1024:
  target=Path(str(target)+'.gz');stored=gzip.compress(raw,mtime=0)
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(stored)
 records.append({'path':str(target.relative_to(dest)),'raw_sha256':hashlib.sha256(raw).hexdigest(),'raw_bytes':len(raw),'stored_sha256':hashlib.sha256(stored).hexdigest()})
for p in sorted(out.glob('*.py')):
 target=dest/'helpers'/p.name;target.parent.mkdir(exist_ok=True);shutil.copy2(p,target);raw=p.read_bytes()
 records.append({'path':str(target.relative_to(dest)),'raw_sha256':hashlib.sha256(raw).hexdigest(),'raw_bytes':len(raw),'stored_sha256':hashlib.sha256(raw).hexdigest()})
(dest/'archive-manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps({'files':len(records),'stored_bytes':sum((dest/r['path']).stat().st_size for r in records),'private_and_binary_artifacts':'excluded; artifact hashes in manifests','original_archive':'untouched'}))
