import hashlib,json,subprocess,tempfile
from pathlib import Path
out=Path(__file__).resolve().parent
root=out.parents[1]
entries=subprocess.check_output(['git','rev-list','--objects','--all'],cwd=root,text=True).splitlines()
report={'scope':'all reachable Git refs plus tracked working tree; text blobs only','verification':'disabled; no credential validation','skipped':{},'scanned':0,'findings':[]}
with tempfile.TemporaryDirectory(prefix='biteflow-secret-scan-') as tmp:
 base=Path(tmp);mapping={}
 for entry in entries:
  oid,*paths=entry.split(' ',1)
  if not paths:continue
  kind=subprocess.check_output(['git','cat-file','-t',oid],cwd=root,text=True).strip()
  if kind!='blob':continue
  data=subprocess.check_output(['git','cat-file','blob',oid],cwd=root)
  try:text=data.decode('utf8')
  except UnicodeDecodeError:report['skipped']['binary']=report['skipped'].get('binary',0)+1;continue
  if '\0' in text:report['skipped']['binary']=report['skipped'].get('binary',0)+1;continue
  p=base/'history'/oid/paths[0];p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
  mapping[str(p)]={'path':paths[0],'blob':oid};report['scanned']+=1
 for name in subprocess.check_output(['git','ls-files'],cwd=root,text=True).splitlines():
  try:text=(root/name).read_text()
  except (UnicodeDecodeError,IsADirectoryError,FileNotFoundError):continue
  if '\0' in text:continue
  p=base/'current'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text);mapping[str(p)]={'path':name,'blob':'working-tree'};report['scanned']+=1
 result=subprocess.run(['uv','--offline','tool','run','--from','detect-secrets','detect-secrets','scan','--no-verify','--all-files',str(base)],cwd=root,capture_output=True,text=True,check=True)
 data=json.loads(result.stdout);report['tool_version']=data['version']
 for filename,findings in data['results'].items():
  for finding in findings:report['findings'].append({**mapping.get(filename,{'path':'UNKNOWN'}),'line':finding['line_number'],'rule':finding['type'],'fingerprint':finding['hashed_secret']})
 report['candidate_count']=len(report['findings'])
 (out/'secret-scan.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k!='findings'}))
 print('No candidate values emitted; review candidate metadata in secret-scan.json.')
