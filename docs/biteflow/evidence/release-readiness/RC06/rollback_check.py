"""Invert only RC06 in an owned temporary Git archive; never reset the checkout."""
import hashlib,io,json,subprocess,tarfile,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parent
base='e70f17ac2e888294aeb2f5402a7474c073d008b3'
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
status=subprocess.check_output(['git','status','--porcelain=v1'],cwd=root)
paths=subprocess.check_output(['git','diff','--name-only',base,head],cwd=root,text=True).splitlines()
patch=subprocess.check_output(['git','diff','--binary',base,head],cwd=root)
archive=subprocess.check_output(['git','archive',head],cwd=root)
with tempfile.TemporaryDirectory(prefix='rc06-rollback-',dir=out) as tmp:
 dest=Path(tmp)
 with tarfile.open(fileobj=io.BytesIO(archive)) as t:t.extractall(dest,filter='data')
 subprocess.run(['git','init','--quiet'],cwd=dest,check=True)
 subprocess.run(['git','apply','--reverse','--check','-'],input=patch,cwd=dest,check=True)
 subprocess.run(['git','apply','--reverse','-'],input=patch,cwd=dest,check=True)
 for path in paths:
  prior=subprocess.run(['git','show',f'{base}:{path}'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
  p=dest/path
  if prior.returncode==0:assert p.read_bytes()==prior.stdout,path
  else:assert not p.exists(),path
 assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==head
 assert subprocess.check_output(['git','status','--porcelain=v1'],cwd=root)==status
result={'base':base,'head':head,'result':'PASS mechanical inverse only','paths_restored':len(paths),'paths':paths,'checkout_changed':False,'database_operations':False,'operational_device_rollback':'NOT RUN','caveat':'Reintroduces RC06 UI/precision defects and widget warnings. Preserve all RC03/RC04/RC05/P13 readers, queues, cleanup and receipts; no downgrade below e70f17a, no data deletion.'}
(out/'rollback-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
