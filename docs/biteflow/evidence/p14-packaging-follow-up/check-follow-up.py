import hashlib
import json
import os
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from foodlogger.measurement_report import load_report, render_backlog, render_html

root = Path.cwd()
out = Path(__file__).resolve().parent
source = 'fcc116db8287e58da9f6844ea2c36312d95157ae'
prior = 'd036aaa59046276ae34f14acd80ecca4189b76ec'
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == source
subprocess.run(['git', 'diff', '--exit-code', prior, source, '--', 'src', 'scripts', 'mobile', 'supabase', 'pyproject.toml', '.github', 'docs/biteflow/p14-open-gates.md'], check=True)
assert subprocess.check_output(['git', 'rev-parse', 'codex/biteflow-p13'], text=True).strip() == '6c1825e9b581e0736040f68260d5591f1a2f6a45'
subprocess.run(['git', 'merge-base', '--is-ancestor', '4d97784', '6c1825e'], check=True)
for base in (prior, '6c1825e'):
    patch = subprocess.check_output(['git', 'diff', '--binary', base, source])
    subprocess.run(['git', 'apply', '--reverse', '--check'], input=patch, check=True)
base = root / 'docs/biteflow'
assert (base / 'p14-open-gates.md').read_text().split('## Complete inherited P13 register (verbatim)\n\n', 1)[1] == (base / 'p13-open-gates.md').read_text()
rollback = json.loads((base / 'evidence/p13-rollback/manifest.json').read_text())['artifact']
apk = Path(rollback['path'])
assert hashlib.sha256(apk.read_bytes()).hexdigest() == rollback['sha256']
with zipfile.ZipFile(apk) as z:
    assert z.testzip() is None
    assert hashlib.sha256(z.read('assets/index.android.bundle')).hexdigest() == rollback['bundle_sha256']
for kind in ('empty', 'synthetic'):
    dest = base / 'evidence/p14' / kind
    report = load_report(None if kind == 'empty' else base / 'evidence/p14/synthetic-input.json')
    assert json.loads((dest / 'report.json').read_text()) == report
    assert (dest / 'dashboard.html').read_text() == render_html(report)
    assert (dest / 'backlog.md').read_text() == render_backlog(report)
scratch = root / '.superpowers/sdd/p14-plan'
assert not (scratch / 'installed-report').exists()
fresh = scratch / 'installed-report-reviewed'
report = json.loads((fresh / 'report.json').read_text())
assert report['evidence_kind'] == 'none' and report['acceptance'] == 'BLOCKED'
assert len(report['metrics']) == 22 and all(row['value'] is None for row in report['metrics'])
assert sorted(p.name for p in fresh.iterdir()) == ['backlog.md', 'dashboard.html', 'report.json']
manifest = json.loads((scratch / 'package-manifest.json').read_text())
assert manifest['source_commit'] == source
artifacts = out / 'artifacts'
artifacts.mkdir()
for item in manifest['artifacts']:
    artifact = scratch / 'package-source-reviewed/dist' / item['name']
    assert artifact.stat().st_size == item['bytes']
    assert hashlib.sha256(artifact.read_bytes()).hexdigest() == item['sha256']
    kept = artifacts / artifact.name
    shutil.copyfile(artifact, kept)
    item['path'] = str(kept)
manifest['source_tree'] = subprocess.check_output(['git', 'rev-parse', source + ':src'], text=True).strip()
manifest['tests_tree'] = subprocess.check_output(['git', 'rev-parse', source + ':tests'], text=True).strip()
(out / 'package-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
shutil.copytree(fresh, out / 'fresh-installed-report')
env = dict(os.environ)
env.pop('PYTHONPATH', None)
env.pop('PYTHONHOME', None)
probe = "from foodlogger.measurement_report import _display; assert _display(99.9999999)=='99.9999999'; assert _display(99.499995)=='99.499995'; print('Installed precision boundary probes: 2 passed')"
subprocess.run([str(scratch / 'installed-package-reviewed/bin/python'), '-c', probe], cwd=out, env=env, check=True)
xml = ET.parse(out / 'backend.xml')
def counts(classname):
    cases = [c for c in xml.iter('testcase') if c.get('classname') == classname]
    return dict(passed=sum(c.find('failure') is None and c.find('error') is None and c.find('skipped') is None for c in cases), failed=sum(c.find('failure') is not None or c.find('error') is not None for c in cases), skipped=sum(c.find('skipped') is not None for c in cases))
result = dict(source_commit=source, unchanged_app_native_schema_and_gates=True, inherited_p13_register_verbatim=True, rollback_apk_and_bundle_hashes='PASS', reverse_follow_up_and_p14_patches='PASS; check only, not applied', physical_rollback='NOT RUN', fresh_output_verified=True, stale_output_absent=True, report_rows=22, installed_precision_cases=2, reports_reproduce=True, tests={name:counts('tests.' + name) for name in ('test_postgres', 'test_privacy', 'test_measurement', 'test_measurement_report', 'test_packaging_evidence')}, p14_acceptance='BLOCKED')
(out / 'follow-up-evidence.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
