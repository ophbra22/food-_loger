from pathlib import Path
import json,subprocess
out=Path(__file__).resolve().parent;root=out.parents[1]
probe=root/'mobile/android/app/src/main/java/io/github/ophbra22/foodlogger/Rc02LintProbe.kt'
assert not probe.exists()
try:
 probe.write_text('package io.github.ophbra22.foodlogger\nimport android.app.NotificationChannel\nfun rc02LintProbe() = NotificationChannel("rc02-probe", "probe", 3)\n')
 command=['./gradlew',':app:lintDebug','--offline','--console=plain','--max-workers=2']
 print('Negative control command:',command,flush=True)
 completed=subprocess.run(command,cwd=root/'mobile/android',stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
 (out/'kotlin-probe-gradle.log').write_text(completed.stdout)
 report=root/'mobile/android/app/build/reports/lint-results-debug.xml'
 xml=report.read_text();(out/'kotlin-probe-lint.xml').write_text(xml)
 import xml.etree.ElementTree as ET
 issues=ET.fromstring(xml).findall('issue')
 matched=[i for i in issues if i.attrib.get('id')=='NewApi' and any('Rc02LintProbe.kt' in l.attrib.get('file','') for l in i.findall('location'))]
 assert completed.returncode!=0 and matched, completed.stdout[-3000:]
 result={'expected_underlying_exit':completed.returncode,'matched_issues':[i.attrib for i in matched],'kotlin_api26_under_min24_detected':True,'analysis_backend':'K1','temporary_probe_removed':True}
 (out/'kotlin-probe-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
finally:
 probe.unlink(missing_ok=True)
