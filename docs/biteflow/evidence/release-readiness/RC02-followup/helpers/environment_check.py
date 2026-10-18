from pathlib import Path
import json,subprocess
out=Path(__file__).resolve().parent;root=out.parents[1]
commands=[['node','--version'],['/Users/braude/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node','--version'],['npm','--version'],[str(root/'.venv/bin/python'),'--version'],['xcodebuild','-version'],['swift','--version'],['java','-version'],[str(root/'mobile/android/gradlew'),'--version']]
rows=[]
for command in commands:
 result=subprocess.run(command,cwd=root/'mobile/android',text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,check=True);rows.append({'command':command,'output':result.stdout.strip()})
(out/'environment-final.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps(rows))
