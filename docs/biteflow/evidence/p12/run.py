import os,sys,subprocess,json,time
from pathlib import Path
root=Path(__file__).resolve().parents[4]
name,area,*cmd=sys.argv[1:]
env={k:v for k,v in os.environ.items() if k!='DATABASE_URL' and not k.startswith(('FOODLOGGER_','GEMINI_','APPLE_','EXPO_'))}
env.update(PYTHONPATH=str(root/'src'),PYTHONDONTWRITEBYTECODE='1',CI='1',EXPO_NO_DOTENV='1',EXPO_NO_TELEMETRY='1',EXPO_OFFLINE='1',EXPO_PUBLIC_API_URL='http://127.0.0.1:8765')
if name.startswith(('android','ios','export')):
 tmp=root/'.superpowers/sdd/p12-plan/native-tmp';tmp.mkdir(parents=True,exist_ok=True);env['TMPDIR']=str(tmp)+'/'
if name.startswith('postgres'): env['FOODLOGGER_TEST_DATABASE_URL']=(Path(__file__).parent/'postgres-url').read_text().strip()
if name.startswith(('prebuild','pods','ios-')): env['EXPO_PUBLIC_HEALTH_ENABLED']='1'
env['EXPO_PUBLIC_WIDGETS_ENABLED']='1'
if name.startswith('android'):
 env['JAVA_HOME']='/Applications/Android Studio.app/Contents/jbr/Contents/Home'
 env['ANDROID_HOME']='/Users/braude/Library/Android/sdk'
 env['EXPO_PUBLIC_HEALTH_CONNECT_ENABLED']='1'
 env['PATH']=env['JAVA_HOME']+'/bin:'+env['ANDROID_HOME']+'/platform-tools:'+env['PATH']
if name.startswith('voice'): env['EXPO_PUBLIC_VOICE_ENABLED']='1'
if name.startswith('metro'): env['NODE_OPTIONS']='--dns-result-order=ipv4first'
if name.startswith('browser'): env['FOODLOGGER_RUN_BROWSER_TESTS']='1'
out=Path(__file__).parent/(name+'.log')
started=time.time()
with out.open('w') as f: result=subprocess.run(cmd,cwd=root/area,env=env,stdout=f,stderr=subprocess.STDOUT)
record={'name':name,'command':cmd,'cwd':str(root/area),'exit_code':result.returncode,'seconds':round(time.time()-started,2)}
with (Path(__file__).parent/'commands.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
print(json.dumps(record));print('\n'.join(out.read_text().splitlines()[-16:]))
sys.exit(result.returncode)
