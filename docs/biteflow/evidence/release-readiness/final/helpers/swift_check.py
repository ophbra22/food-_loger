from pathlib import Path
import subprocess
root=Path(__file__).resolve().parents[2]
out=Path(__file__).resolve().parent
cases=[('widget-policy','biteflow-widgets',['ios/WidgetPolicy.swift','tests/PolicyTests.swift']),('widget-file','biteflow-widgets',['ios/WidgetPolicy.swift','ios/WidgetFile.swift','tests/FileTests.swift']),('health-policy','biteflow-health',['ios/HealthPolicy.swift','tests/PolicyTests.swift'])]
for name,module,files in cases:
 command=['swiftc',*[str(root/'mobile/modules'/module/f) for f in files],'-o',str(out/name)]
 print(command,flush=True);subprocess.run(command,check=True);subprocess.run([str(out/name)],check=True)
