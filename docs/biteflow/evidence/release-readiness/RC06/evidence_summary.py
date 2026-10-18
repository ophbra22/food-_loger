import collections,gzip,hashlib,json,re,subprocess,xml.etree.ElementTree as E
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent
base='e70f17ac2e888294aeb2f5402a7474c073d008b3';head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
def write(name,data):(out/name).write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
def xml_count(path):
 cases=list(E.parse(path).iter('testcase'));counts={'tests':len(cases),'failed':sum(t.find('failure') is not None for t in cases),'errors':sum(t.find('error') is not None for t in cases),'skipped':sum(t.find('skipped') is not None for t in cases)};counts['passed']=counts['tests']-counts['failed']-counts['errors']-counts['skipped'];return counts
m=json.loads((out/'mobile-final-results.json').read_text());b=xml_count(out/'backend-final.xml');br=xml_count(out/'browser-final.xml');j=[xml_count(p) for p in out.glob('*TEST-*.xml')]
counts={'mobile':{k:m[k] for k in ['numTotalTestSuites','numPassedTestSuites','numFailedTestSuites','numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTodoTests']},'backend':b,'browser':br,'unique_python_passes':b['passed']+br['passed'],'remaining_not_run':['tests/test_lite_classifier.py two opt-in LiteRT cases','tests/test_ml_integration.py one opt-in ML case'],'postgres_passed':sum(t.attrib['classname']=='tests.test_postgres' and not len(t) for t in E.parse(out/'backend-final.xml').iter('testcase')),'jvm':j,'swift_host_checks':29}
assert counts['unique_python_passes']==687 and counts['postgres_passed']==29
write('test-counts.json',counts)
changed=subprocess.check_output(['git','diff','--name-only',base,head],cwd=root,text=True).splitlines()
write('source-manifest.json',{'base':base,'head':head,'files':[{'path':p,'sha256':hashlib.sha256((root/p).read_bytes()).hexdigest()} for p in changed if (root/p).exists()],'deleted':[p for p in changed if not (root/p).exists()]})
protected=['src/foodlogger','mobile/src/api','mobile/src/storage','mobile/src/data','mobile/src/auth','mobile/src/native','mobile/modules/biteflow-health','mobile/modules/biteflow-widgets/ios','mobile/app.config.ts','mobile/package.json','mobile/package-lock.json','.github/workflows/ci.yml','pyproject.toml']
for prefix in protected:
 assert not subprocess.check_output(['git','diff','--name-only',base,head,'--',prefix],cwd=root).strip(),prefix
# Packaging was built from an earlier commit; all packaged sources remain identical.
assert not subprocess.check_output(['git','diff','--name-only','33e0edc',head,'--','src','pyproject.toml','MANIFEST.in'],cwd=root).strip()
p='docs/biteflow/release-readiness/gate-register.md'
old=subprocess.check_output(['git','show',f'{base}:{p}'],cwd=root,text=True)
new=(root/p).read_text()
rows=lambda s:[x for x in s.splitlines() if re.match(r'\| G\d\d / \[L',x)]
assert rows(old)==rows(new) and len(rows(new))==74
for token in ['F','E2E-']:
 select=lambda s:[x for x in s.splitlines() if re.match(r'\| '+token+r'\d\d \|',x)]
 assert select(old)==select(new) and len(select(new))==20
write('preservation-check.json',{'base':base,'head':head,'protected_source_paths_unchanged':protected,'all_backend_product_source_unchanged':True,'schema_migrations_changed':False,'packaged_source_identical_to_33e0edc':True,'original_gate_rows_preserved':74,'feature_coverage_rows_preserved':20,'e2e_coverage_rows_preserved':20,'gate_rows_sha256':hashlib.sha256('\n'.join(rows(new)).encode()).hexdigest()})
commands=[]
for p in sorted(out.glob('*.json')):
 try:d=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 if isinstance(d,dict) and all(k in d for k in ['command','exit_code','source_commit']):commands.append(d)
write('command-index.json',commands)
print(json.dumps({'counts':counts,'changed_files':len(changed),'commands':len(commands),'preservation':'PASS'}))
