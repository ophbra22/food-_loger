import gzip,hashlib,json,shutil
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent;dest=root/'docs/biteflow/evidence/release-readiness/RC06'
dest.mkdir(exist_ok=True)
for p in out.iterdir():
 if not p.is_file() or p.suffix not in {'.json','.log','.xml','.py','.txt'}:continue
 raw=p.read_bytes();name=p.name
 if len(raw)>192*1024:
  name+='.gz';raw=gzip.compress(raw,mtime=0)
 (dest/name).write_bytes(raw)
workspace=root/'.superpowers/sdd/2026-10-18-biteflow-release-readiness'
shutil.copyfile(workspace/'progress.md',dest/'execution-ledger.md')
shutil.copyfile(workspace/'task-6-brief.md',dest/'task-6-brief.md')
patch=workspace/'review-e70f17a..33e0edc.diff';(dest/(patch.name+'.gz')).write_bytes(gzip.compress(patch.read_bytes(),mtime=0))
# Preserve the dated RC02 verification facts rather than implying they were rerun.
prior=root/'runtime/rc02-verify-e70f17a-20261018'
for name in ['verification-report.md','test-and-scan-counts.json','npm-tree.json','npm-tree.log','npm-audit.json']:
 p=prior/name;raw=p.read_bytes();name='inherited-rc02-'+name
 if len(raw)>192*1024:name+='.gz';raw=gzip.compress(raw,mtime=0)
 (dest/name).write_bytes(raw)
manifest={'source':'runtime/rc06-20261018; inherited RC02 records explicitly prefixed','no_apk_or_credentials_committed':True,'files':[{'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(dest.iterdir()) if p.is_file() and p.name!='archive-manifest.json']}
(dest/'archive-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'files':len(manifest['files']),'bytes':sum(p['bytes'] for p in manifest['files'])}))
