import hashlib,json,subprocess,zipfile
from pathlib import Path
root=Path.cwd(); base=Path('docs/biteflow')
old=(base/'p13-open-gates.md').read_text()
assert (base/'p14-open-gates.md').read_text().split('## Complete inherited P13 register (verbatim)\n\n',1)[1]==old
subprocess.run(['git','diff','--exit-code','6c1825e','--','mobile','src','tests',':(exclude)src/foodlogger/measurement.py',':(exclude)src/foodlogger/measurement_report.py',':(exclude)tests/test_measurement.py',':(exclude)tests/test_measurement_report.py'],check=True)
manifest=json.loads((base/'evidence/p13-rollback/manifest.json').read_text())
artifact=Path(manifest['artifact']['path'])
assert hashlib.sha256(artifact.read_bytes()).hexdigest()==manifest['artifact']['sha256']
with zipfile.ZipFile(artifact) as z:
    assert z.testzip() is None
    bundled=z.read('assets/index.android.bundle')
assert hashlib.sha256(bundled).hexdigest()==manifest['artifact']['bundle_sha256']
from foodlogger.measurement_report import load_report,render_html,render_backlog
for mode in ('empty','synthetic'):
    path=base/'evidence/p14'/mode
    report=load_report(None if mode=='empty' else base/'evidence/p14/synthetic-input.json')
    assert json.loads((path/'report.json').read_text())==report
    assert (path/'dashboard.html').read_text()==render_html(report)
    assert (path/'backlog.md').read_text()==render_backlog(report)
print('PASS: inherited register verbatim; existing app/mobile/schema/security sources unchanged; P13 APK/ZIP/bundle hashes retained; both P14 reports reproduce exactly.')
