import hashlib,io,json,os,subprocess,sys,tarfile,venv,zipfile
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
dest=out/'package-source-final';dest.mkdir()
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
archive=subprocess.check_output(['git','archive',source],cwd=root)
with tarfile.open(fileobj=io.BytesIO(archive)) as t:t.extractall(dest,filter='data')
subprocess.run([sys.executable,'-m','build','--no-isolation'],cwd=dest,check=True)
wheel=next((dest/'dist').glob('*.whl'));sdist=next((dest/'dist').glob('*.tar.gz'))
expected=[p for p in (dest/'src/foodlogger').rglob('*') if p.is_file()]
with zipfile.ZipFile(wheel) as z:
 for p in expected:
  name=p.relative_to(dest/'src').as_posix()
  assert z.read(name)==p.read_bytes(),name
with tarfile.open(sdist) as t:
 for p in expected:
  name='foodlogger-2.1.0/'+p.relative_to(dest).as_posix()
  assert t.extractfile(name).read()==p.read_bytes(),name
target=out/'installed-package-final';venv.EnvBuilder(with_pip=True).create(target)
env=dict(os.environ);env.pop('PYTHONPATH',None)
python=str(target/'bin/python')
subprocess.run([python,'-m','pip','install','--disable-pip-version-check','--no-index','--no-deps',str(wheel)],cwd=out,env=env,check=True)
report_output=out/'installed-report-final';assert not report_output.exists()
subprocess.run([python,'-m','foodlogger.measurement_report','--output',str(report_output)],cwd=out,env=env,check=True)
report=json.loads((report_output/'report.json').read_text())
assert report['acceptance']=='BLOCKED' and report['evidence_kind']=='none'
result={'source_commit':source,'files_verified_in_wheel_and_sdist':len(expected),'artifacts':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in (wheel,sdist)],'installed_module_smoke':'PASS; fresh venv, no dependencies or network installed, source PYTHONPATH removed','fresh_output':str(report_output.relative_to(root)),'p14_acceptance':'BLOCKED','real_metrics':'NONE'}
(out/'package-manifest-final.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
