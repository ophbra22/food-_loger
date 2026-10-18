import json,subprocess,sys
from pathlib import Path
out=Path(__file__).resolve().parent;root=out.parents[1]
required=['native-prebuild-disabled','ios-pods-disabled','ios-source-debug-disabled','ios-source-release-disabled','android-build-disabled-final','ios-final-debug-disabled','ios-final-release-disabled-serial','android-final-disabled','native-prebuild-all-enabled-final','ios-pods-all-enabled-final','ios-final-debug-all-enabled','ios-final-release-all-enabled','android-final-all-enabled','native-export-disabled-final','native-export-all-enabled-final','native-apk-signing-final','rc01-swift-final']
for name in required:
 data=json.loads((out/(name+'.json')).read_text());assert data['exit_code']==0,name
for mode in ('disabled','all-enabled'):
 # Re-read the compiled application/extension metadata and actual APK manifests.
 subprocess.run([sys.executable,str(out/'native_manifest.py'),mode],cwd=root,check=True)
subprocess.run([sys.executable,str(out/'swift_check.py')],cwd=root,check=True)
rows=json.loads((out/'android-jvm-final.json').read_text())
assert sum(x['tests'] for x in rows)==22 and all(x['failures']==x['errors']==x['skipped']==0 for x in rows)
assert json.loads((out/'native-artifacts-disabled.json').read_text())['mode']=='disabled'
assert json.loads((out/'native-artifacts-all-enabled.json').read_text())['mode']=='all-enabled'
print('PASS: completed native build records, compiled two-mode flags/permissions, extension, four debug-signed APKs,22 JVM and29 fresh Swift checks. No physical/runtime/release claim.')
