import gzip,hashlib,json,shutil
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
dest=root/'docs/biteflow/evidence/release-readiness';manifest=dest/'archive-manifest.json'
records={v['path']:v for v in json.loads(manifest.read_text())} if manifest.exists() else {}
sha=lambda b:hashlib.sha256(b).hexdigest()
def put(p,area,name=None):
 data=p.read_bytes();name=name or p.name
 if len(data)>150000 and p.suffix in ('.log','.json','.txt'):
  name+='.gz';stored=gzip.compress(data,mtime=0)
 else:stored=data
 rel=area+'/'+name;target=dest/rel;target.parent.mkdir(parents=True,exist_ok=True)
 if rel in records and records[rel]['raw_sha256']!=sha(data):
  raise ValueError('Refusing to overwrite different evidence: '+rel)
 target.write_bytes(stored);records[rel]={'path':rel,'raw_sha256':sha(data),'raw_bytes':len(data),'stored_sha256':sha(stored)}
 if p.suffix=='.log' and name.endswith('.gz'):
  tail=target.with_suffix('.tail.txt');tail.write_text('\n'.join(data.decode(errors='replace').splitlines()[-35:])+'\n')
def area(n):
 if n.startswith(('backend-baseline','mobile-baseline')):return 'RC00'
 if n.startswith(('ios','android','native','rc01','enabled-apks','disabled-apks','jvm-')):return 'RC01'
 if n.startswith(('rc02','audit-initial','secret-scan','shipping-image','trivy')):return 'RC02'
 if n.startswith(('rc03','backend-rc03')):return 'RC03'
 if n.startswith(('rc04','backend-rc04')):return 'RC04'
 if n.startswith('rc05'):return 'RC05'
 return 'final'
results=[]
for p in sorted(out.glob('*.json')):
 if p.name=='secret-scan.json':continue # the first scan is already archived; latest is explicitly -final
 data=json.loads(p.read_text())
 if isinstance(data,dict) and all(k in data for k in ('name','command','exit_code')):
  put(p,area(p.stem));log=p.with_suffix('.log')
  if log.exists():put(log,area(p.stem))
  results.append(data)
 elif p.name.startswith(('native-artifacts-','ios-disabled-','ios-all-enabled-','android-jvm-','disabled-apks','enabled-apks','package-manifest','shipping-source','shipping-image','secret-scan-final','rollback-local-check','rollback-final','evidence-secrets-final','evidence-integrity-final')):
  put(p,area(p.stem))
for p in out.glob('*.xml'):put(p,'RC01' if p.name.startswith('jvm-') else 'final')
for p in out.glob('android-*-manifest.txt'):put(p,'RC01')
for p in out.glob('*requirements*.txt'):put(p,'RC02')
for name in ('trivy.json','trivy-final.json'):
 p=out/'image-audit'/name
 if p.exists():put(p,'RC02')
for name in ('review-summary.md','review-final-moved-reload.log'):
 p=out/name
 if p.exists():put(p,'final')
for name in ('run.py','postgres.py','inventory.py','secret_scan.py','swift_check.py','task_verify.py','package_check.py','image_source_check.py','native_manifest.py','apk_signing_check.py','native_acceptance.py','evidence_secret_check.py','verify_final_evidence.py','audit_map.py','archive_evidence.py'):
 p=out/name
 if p.exists():
  # Helpers may evolve until final archival; save final source once.
  target=dest/'final/helpers'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
manifest.write_text(json.dumps(sorted(records.values(),key=lambda x:x['path']),indent=2)+'\n')
import shlex
lines=['# Executed verification commands','',
 'All commands ran locally with fixture data/mocked AI. Early RED and diagnostic failures are retained. A zero exit is a command result, not automatic task/release acceptance. Counts and skip explanations are in the checkpoint. No summing repeated runs. Runtime is executor wall time; test runners may report a smaller duration.',
 '', 'Final command records capture source commit, UTC start and public flags. Earlier records without these fields are intermediate evidence from this wave; do not infer an exact commit/time they did not capture. The checkpoint identifies the final implementation. Output larger than150KB is losslessly gzipped; archive manifest records raw and stored hashes.',
 '', '| Record | Exit | Seconds | Command (cwd in linked JSON) |','|---|---:|---:|---|']
for x in results:
 n=x['name'];a=area(n);cmd=shlex.join(x['command']).replace('|','\\|')
 lines.append(f"| [{n}](../evidence/release-readiness/{a}/{n}.json) | {x['exit_code']} | {x.get('seconds','?')} | `{cmd}` |")
(root/'docs/biteflow/release-readiness/verification-results.md').write_text('\n'.join(lines)+'\n')
for x in records.values():
 data=(dest/x['path']).read_bytes();assert sha(data)==x['stored_sha256'],x['path']
 raw=gzip.decompress(data) if x['path'].endswith('.gz') else data
 assert sha(raw)==x['raw_sha256'] and len(raw)==x['raw_bytes'],x['path']
print(f'Archived and hash-verified {len(records)} evidence files; {len(results)} command records. No database/credential files or binaries copied.')
