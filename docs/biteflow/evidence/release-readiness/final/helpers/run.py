import json,os,subprocess,sys,time
from datetime import datetime,timezone
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
name,area,*command=sys.argv[1:]
env={k:v for k,v in os.environ.items() if k!='DATABASE_URL' and not k.startswith(('FOODLOGGER_','GEMINI_','APPLE_','EXPO_','OPENAI_','ANTHROPIC_'))}
env.update(PYTHONPATH=str(root/'src'),PYTHONDONTWRITEBYTECODE='1',CI='1',EXPO_NO_DOTENV='1',EXPO_NO_TELEMETRY='1',EXPO_OFFLINE='1',EXPO_PUBLIC_API_URL='http://127.0.0.1:8765',EXPO_PUBLIC_WIDGETS_ENABLED='0',EXPO_PUBLIC_HEALTH_ENABLED='0',EXPO_PUBLIC_HEALTH_CONNECT_ENABLED='0',EXPO_PUBLIC_VOICE_ENABLED='0',EXPO_PUBLIC_REMINDERS_ENABLED='0')
if name.startswith('backend'):env['FOODLOGGER_TEST_DATABASE_URL']=(out/'postgres-url').read_text().strip()
if name.startswith('browser'):env['FOODLOGGER_RUN_BROWSER_TESTS']='1'
if name.startswith(('android','ios','native')):
 env.update(JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home',ANDROID_HOME='/Users/braude/Library/Android/sdk',TMPDIR=str(out/'native-tmp')+'/')
 env['PATH']=env['JAVA_HOME']+'/bin:'+env['ANDROID_HOME']+'/platform-tools:'+env['PATH']
 if '-enabled' in name:
  env.update(EXPO_PUBLIC_WIDGETS_ENABLED='1',EXPO_PUBLIC_HEALTH_ENABLED='1',EXPO_PUBLIC_HEALTH_CONNECT_ENABLED='1')
if '-all-enabled' in name:
 env.update(EXPO_PUBLIC_VOICE_ENABLED='1',EXPO_PUBLIC_REMINDERS_ENABLED='1')
start=time.monotonic();started_at=datetime.now(timezone.utc).isoformat()
source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
dirty_paths=subprocess.check_output(['git','diff','--name-only'],cwd=root,text=True).splitlines()
with (out/(name+'.log')).open('w') as log:result=subprocess.run(command,cwd=root/area,env=env,stdout=log,stderr=subprocess.STDOUT)
record=dict(name=name,command=command,cwd=str(root/area),exit_code=result.returncode,seconds=round(time.monotonic()-start,2),started_at=started_at,source_commit=source_commit,dirty_tracked_paths=dirty_paths,public_flags={k:v for k,v in env.items() if k.startswith('EXPO_PUBLIC_')})
(out/(name+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record));print('\n'.join((out/(name+'.log')).read_text().splitlines()[-20:]))
sys.exit(result.returncode)
