import json,os,secrets,subprocess,sys,time
from pathlib import Path
out=Path(__file__).resolve().parent
if sys.argv[1]=='start':
    name='biteflow-rc-'+secrets.token_hex(4);password=secrets.token_hex(24)
    env=dict(os.environ,POSTGRES_PASSWORD=password)
    cid=subprocess.check_output(['docker','run','-d','--pull=never','--name',name,'--label','biteflow.verification=rc06-local','-e','POSTGRES_PASSWORD','-e','POSTGRES_DB=biteflow_rc_test','-p','127.0.0.1::5432','postgres:17-alpine'],env=env,text=True).strip()
    (out/'postgres-id').write_text(cid)
    for _ in range(60):
        if subprocess.run(['docker','exec',cid,'pg_isready','-U','postgres'],capture_output=True).returncode==0:break
        time.sleep(.5)
    else:raise RuntimeError('Owned test DB not ready')
    port=subprocess.check_output(['docker','port',cid,'5432/tcp'],text=True).strip().split(':')[-1]
    fd=os.open(out/'postgres-url',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,'w') as f:f.write(f'postgresql://postgres:{password}@127.0.0.1:{port}/biteflow_rc_test')
    print('Owned disposable PostgreSQL17 ready on loopback; credentials withheld.')
else:
    cid=(out/'postgres-id').read_text();info=json.loads(subprocess.check_output(['docker','inspect',cid],text=True))[0]
    assert info['Id']==cid and info['Config']['Labels'].get('biteflow.verification')=='rc06-local'
    subprocess.run(['docker','rm','-f','-v',cid],check=True,capture_output=True)
    (out/'postgres-url').unlink(missing_ok=True);(out/'postgres-id').unlink()
    print('Removed only owned verification container/volume and credential files.')
