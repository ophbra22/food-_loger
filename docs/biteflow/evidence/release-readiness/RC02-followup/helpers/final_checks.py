from pathlib import Path
import gzip,hashlib,json,subprocess
out=Path(__file__).resolve().parent;root=out.parents[1]
required=['decoder-clean-install','npm-tree','node24-dependency-check','mobile-node24-final','backend-full','browser','node24-types','mobile-lint-reviewed','python-lint','python-format','native-swift','package','android-final-all-enabled','android-final-disabled','ios-release-all-enabled','ios-debug-all-enabled','ios-release-disabled-clean','ios-debug-disabled-clean','native-export-all-enabled','native-export-disabled','android-artifact-check-all-enabled','android-artifact-check-disabled','ios-artifact-check-all-enabled','ios-artifact-check-disabled-clean','rollback-dry-run']
for name in required:assert json.loads((out/(name+'.json')).read_text())['exit_code']==0,name
for name in ['npm-audit','shipping-trivy','android-lint-xml-gate']:assert json.loads((out/(name+'.json')).read_text())['exit_code']==1,name
source=json.loads((out/'source-manifest.json').read_text());assert all(hashlib.sha256((root/p).read_bytes()).hexdigest()==h for p,h in source['tracked_source_sha256'].items())
for mode in ('all-enabled','disabled'):
 data=json.loads((out/('android-artifacts-'+mode+'.json')).read_text())
 for row in data['apks']:assert hashlib.sha256((root/row['file']).read_bytes()).hexdigest()==row['sha256']
 for config in ('debug','release'):
  for entry in json.loads((out/('ios-'+mode+'-'+config+'-files.json')).read_text()):
   p=out/'artifacts'/('ios-'+mode+'-'+config)/'Biteflow.app'/entry['path'];assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256']
assert not (root/'mobile/android/app/src/main/java/io/github/ophbra22/foodlogger/Rc02LintProbe.kt').exists()
assert not (out/'postgres-url').exists() and not (out/'postgres-id').exists()
records=[]
for p in out.glob('*.json'):
 try:d=json.loads(p.read_text())
 except ValueError:continue
 if isinstance(d,dict) and all(k in d for k in ('command','exit_code','started_at')):records.append(d)
(out/'commands-final.json').write_text(json.dumps(sorted(records,key=lambda d:d['started_at']),indent=2)+'\n')
result={'source_commit':source['source_commit'],'required_successful_checks':len(required),'expected_open_gate_failures':['npm audit50 High nodes','Trivy164 OS occurrences','full-tree native XML7 SVG Errors'],'app_and_native_builds':8,'test_database_removed':True,'temporary_probe_removed':True,'artifact_hashes_verified':True,'source_unchanged_after_review_fixes':True,'overall_RC02':'BLOCKED','production_ready':False}
(out/'final-check-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
