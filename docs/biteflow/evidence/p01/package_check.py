import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path

with tempfile.TemporaryDirectory(prefix='biteflow-p01-package-') as directory:
    root=Path(directory)
    archive=root/'source.tar'
    with archive.open('wb') as output:
        subprocess.run(['git','archive','HEAD'],stdout=output,check=True)
    source=root/'source';source.mkdir()
    with tarfile.open(archive) as data:data.extractall(source,filter='data')
    subprocess.run([sys.executable,'-m','build','--no-isolation',str(source)],check=True)
    wheel=next((source/'dist').glob('*.whl'))
    with zipfile.ZipFile(wheel) as data:
        assert {'foodlogger/data/foundation.sql','foodlogger/data/ai_gateway.sql','foodlogger/domain.py','foodlogger/ai_gateway.py','foodlogger/meal_service.py'} <= set(data.namelist())
    print('PASS: clean HEAD sdist/wheel include both additive SQL resources and P01 services')
