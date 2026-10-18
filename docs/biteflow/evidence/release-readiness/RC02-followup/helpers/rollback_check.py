from pathlib import Path
import hashlib,io,json,subprocess,tarfile,tempfile
out=Path(__file__).resolve().parent;root=out.parents[1]
base='4952a63fc78c8ce4f21add2383f6cdd4575a9390';head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
commits=subprocess.check_output(['git','rev-list',base+'..'+head],cwd=root,text=True).splitlines()
paths=subprocess.check_output(['git','diff','--name-only',base,head],cwd=root,text=True).splitlines()
protected=['src/foodlogger','mobile/src','mobile/modules','Dockerfile.free','pyproject.toml']
assert not subprocess.check_output(['git','diff','--name-only',base,head,'--',*protected],cwd=root,text=True).strip()
with tempfile.TemporaryDirectory(prefix='biteflow-rc02-rollback-') as name:
 dest=Path(name)
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',head],cwd=root))) as archive:archive.extractall(dest,filter='data')
 for commit in commits:
  patch=subprocess.check_output(['git','diff',commit+'^',commit],cwd=root)
  subprocess.run(['git','apply','--check','-R','-'],cwd=dest,input=patch,check=True)
  subprocess.run(['git','apply','-R','-'],cwd=dest,input=patch,check=True)
 for name in paths:
  original=subprocess.run(['git','show',base+':'+name],cwd=root,capture_output=True)
  if original.returncode==0:assert (dest/name).read_bytes()==original.stdout,name
  else:assert not (dest/name).exists(),name
record={'base':base,'head':head,'reverse_order':commits,'changed_paths_restored':len(paths),'mechanical_reversal_in_temporary_archive':'PASS','protected_product_native_database_and_container_sources_unchanged':protected,'operational_downgrade':'NOT RUN / NOT APPROVED','security_warning':'Reversal restores fixed vulnerable dependencies and Android lint crash; do not use as a release candidate. Preserve RC03 provenance/readers, schema3 pending drafts and receipts, RC05 cleanup, and P13 security floor. No data or native-device rollback tested.'}
(out/'rollback-result.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
