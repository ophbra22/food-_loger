import hashlib, io, json, os, subprocess, sys, tarfile, zipfile, venv
from pathlib import Path
root=Path.cwd(); scratch=root/'.superpowers/sdd/p14-plan'; dest=scratch/'package-source-final2'; dest.mkdir()
source=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
archive=subprocess.check_output(['git','archive',source])
with tarfile.open(fileobj=io.BytesIO(archive)) as t:t.extractall(dest,filter='data')
subprocess.run([sys.executable,'-m','build','--no-isolation'],cwd=dest,check=True)
wheel=next((dest/'dist').glob('*.whl'));sdist=next((dest/'dist').glob('*.tar.gz'))
with zipfile.ZipFile(wheel) as z:
    for filename in ('foodlogger/measurement.py','foodlogger/measurement_report.py'):
        assert filename in z.namelist()
        assert z.read(filename)==(root/'src'/filename).read_bytes()
target=scratch/'installed-package-final'
venv.EnvBuilder(with_pip=True).create(target)
installed_python=str(target/'bin/python')
env=dict(os.environ);env.pop('PYTHONPATH',None)
subprocess.run([installed_python,'-m','pip','install','--disable-pip-version-check','--no-index','--no-deps',str(wheel)],cwd=scratch,env=env,check=True)
env=dict(os.environ);env.pop('PYTHONPATH',None)
subprocess.run([installed_python,'-m','foodlogger.measurement_report','--output',str(scratch/'installed-report')],cwd=scratch,env=env,check=True)
report=json.loads((scratch/'installed-report/report.json').read_text())
assert report['acceptance']=='BLOCKED' and report['evidence_kind']=='none'
result={'source_commit':source,'artifacts':[{'name':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in (wheel,sdist)],'installed_module_smoke':'PASS; no dependencies or network installed','p14_acceptance':'BLOCKED'}
(scratch/'package-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
