"""Smoke only on the task-owned blank emulator. No account or Health records."""
import subprocess, json, time
from pathlib import Path
adb='/Users/braude/Library/Android/sdk/platform-tools/adb'
serial='emulator-5580'
def run(*args):
 r=subprocess.run([adb,'-s',serial,*args],text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=60)
 print(json.dumps({'argv':list(args),'exit':r.returncode,'output':r.stdout.strip()}));r.check_returncode();return r.stdout.strip()
assert 'BiteflowP11' in run('emu','avd','name')
assert run('shell','getprop','sys.boot_completed')=='1'
for key in ('ro.build.version.release','ro.build.version.sdk','ro.product.cpu.abi','ro.build.fingerprint'):run('shell','getprop',key)
run('install','-r','mobile/android/app/build/outputs/apk/release/app-release.apk')
run('shell','am','start','-W','-n','io.github.ophbra22.foodlogger/.MainActivity')
time.sleep(3)
pid=run('shell','pidof','io.github.ophbra22.foodlogger')
assert pid, 'App process did not survive startup'
logs=run('logcat','-d','--pid='+pid,'-t','60')
assert 'FATAL EXCEPTION' not in logs
run('shell','am','start','-W','-n','io.github.ophbra22.foodlogger/expo.modules.biteflowhealth.HealthPrivacyActivity')
run('shell','uiautomator','dump','/sdcard/biteflow-p11-ui.xml')
xml=run('exec-out','cat','/sdcard/biteflow-p11-ui.xml')
assert 'Health Connect privacy' in xml
Path('docs/biteflow/evidence/p11/android-rationale-ui.xml').write_text(xml)
run('shell','am','force-stop','io.github.ophbra22.foodlogger')
print('PASS: blank task-owned API37 emulator, Release variant app launch/process survives, native privacy rationale renders. No sign-in or Health data accessed. Not permission/sync E2E or physical-device acceptance.')
