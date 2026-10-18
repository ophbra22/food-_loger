import gzip,hashlib,json,re,subprocess
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
e=root/'docs/biteflow/evidence/release-readiness';d=root/'docs/biteflow/release-readiness'
sha=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads((e/'archive-manifest.json').read_text())
for x in manifest:
 p=e/x['path'];data=p.read_bytes();assert sha(data)==x['stored_sha256'],p
 raw=gzip.decompress(data) if p.suffix=='.gz' else data
 assert len(raw)==x['raw_bytes'] and sha(raw)==x['raw_sha256'],p
 if p.name.endswith('.log.gz'):
  tail=p.with_suffix('.tail.txt');assert tail.read_text()=='\n'.join(raw.decode(errors='replace').splitlines()[-35:])+'\n',tail
missing=[]
for p in [*d.glob('*.md'),e/'README.md']:
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if '://' in target or target.startswith('#'):continue
  if not (p.parent/target.split('#')[0]).exists():missing.append((str(p),target))
assert not missing,missing
gate=(d/'gate-register.md').read_text();assert len(re.findall(r'^\| G\d+',gate,re.M))==74
for prefix in ('F','E2E-'):
 assert set(re.findall(r'^\| ('+prefix+r'\d\d) \|',gate,re.M))=={f'{prefix}{n:02}' for n in range(1,21)}
assert not any('PENDING FINAL' in p.read_text() or 'pending at this draft' in p.read_text() for p in d.glob('*.md'))
for f in ('mobile/src/storage/private-files.ts','mobile/src/storage/export-session.ts','src/foodlogger/privacy.py','docs/biteflow/p14-open-gates.md','mobile/plugins/speech-guard.json'):
 assert (root/f).read_bytes()==subprocess.check_output(['git','show','e7f7c9d:'+f],cwd=root)
assert not (out/'postgres-url').exists() and not (out/'postgres-id').exists()
code_changes=subprocess.check_output(['git','diff','--name-only','5455c49','--','mobile','src','tests','Dockerfile.free'],cwd=root,text=True).strip();assert not code_changes,code_changes
for name in ('backend-final','browser-final','mobile-final','types-final','lint-final','python-lint-final','python-format-final','package-final','shipping-source-check-final','native-acceptance-final','evidence-secret-scan-final'):
 assert json.loads((out/(name+'.json')).read_text())['exit_code']==0,name
assert json.loads((out/'rc02-image-os-final.json').read_text())['exit_code']==1
assert json.loads((out/'android-lint-full.json').read_text())['exit_code']!=0
result={'source_commit':'5455c494067ea8474affb6375b3a40ff84c1ff02','manifest_files_verified':len(manifest),'local_doc_links':'PASS','gate_rows':74,'scope_ids':40,'product_changes_after_final_test_source':False,'disposable_db_credentials_removed':True,'final_suite_and_native_records':'PASS','rc02_advisory_and_full_lint_gate':'BLOCKED / failure retained','review':'independent range e7f7c9d..a00943e; fix5455c49 TDD verified; final evidence self-checked'}
(out/'evidence-integrity-final.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
