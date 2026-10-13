import subprocess
from pathlib import Path
backup=Path(__file__).parent/'postgres-backup.sql'
with backup.open('w') as out:
 subprocess.run(['docker','exec','biteflow-p02-pg','pg_dump','-U','postgres','--no-owner','biteflow_p02_test'],stdout=out,check=True)
subprocess.run(['docker','exec','biteflow-p02-pg','createdb','-U','postgres','biteflow_p02_restore_test'],check=True)
with backup.open() as src:
 subprocess.run(['docker','exec','-i','biteflow-p02-pg','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','biteflow_p02_restore_test'],stdin=src,check=True)
query="SELECT version FROM foodlogger.schema_version; SELECT count(*) FROM foodlogger.meals WHERE protein IS NULL AND grams=0.1 AND calories=0.0014; SELECT count(*) FROM foodlogger.save_receipts;"
result=subprocess.check_output(['docker','exec','biteflow-p02-pg','psql','-X','-t','-A','-U','postgres','-d','biteflow_p02_restore_test','-c',query],text=True)
assert result.split()==['2','1','1'],result
print('Disposable PostgreSQL backup restored: schema v2, exact tiny/partial row and receipt preserved.')
