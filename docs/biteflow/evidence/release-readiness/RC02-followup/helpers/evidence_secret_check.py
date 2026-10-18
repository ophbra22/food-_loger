import gzip,json,subprocess,tempfile
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
source=root/'docs/biteflow/evidence/release-readiness'
with tempfile.TemporaryDirectory(prefix='biteflow-evidence-secrets-') as name:
 temp=Path(name);mapping={};count=0
 for p in source.rglob('*'):
  if not p.is_file():continue
  data=gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes()
  try:text=data.decode('utf8')
  except UnicodeDecodeError:continue
  q=temp/p.relative_to(source);q=q.with_suffix('.uncompressed') if p.suffix=='.gz' else q
  q.parent.mkdir(parents=True,exist_ok=True);q.write_text(text);mapping[str(q)]=str(p.relative_to(source));count+=1
 result=subprocess.run(['uv','--offline','tool','run','--from','detect-secrets','detect-secrets','scan','--no-verify','--all-files',str(temp)],cwd=root,capture_output=True,text=True,check=True)
 data=json.loads(result.stdout);findings=[]
 for name,items in data['results'].items():
  for item in items:findings.append({'path':mapping.get(name,name),'line':item['line_number'],'rule':item['type'],'fingerprint':item['hashed_secret']})
 record={'scope':'all archived evidence, including decompressed build logs and copied verification helpers','files':count,'tool_version':data['version'],'network_verification':False,'candidate_count':len(findings),'findings':findings}
 (out/'evidence-secrets-final.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
