import json,subprocess,tempfile
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
files=set(subprocess.check_output(['git','diff','--name-only','4952a63'],cwd=root,text=True).splitlines())
files.add('docs/biteflow/release-readiness/RC02-followup.md')
with tempfile.TemporaryDirectory(prefix='biteflow-changed-secrets-') as folder:
 temp=Path(folder)
 for name in sorted(files):
  q=temp/name;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes((root/name).read_bytes())
 result=subprocess.run(['uv','--offline','tool','run','--from','detect-secrets','detect-secrets','scan','--no-verify','--all-files',str(temp)],cwd=root,capture_output=True,text=True,check=True)
 data=json.loads(result.stdout);findings=[]
 for name,items in data['results'].items():
  for item in items:findings.append({'path':str(Path(name).relative_to(temp)), 'line':item['line_number'],'rule':item['type'],'fingerprint':item['hashed_secret']})
 record={'scope':'all changed implementation/config/tests and four checkpoint documents; evidence scanned separately','files':sorted(files),'file_count':len(files),'candidate_count':len(findings),'findings':findings,'tool_version':data['version'],'network_verification':False}
 (out/'changed-files-secrets.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
 assert not findings
