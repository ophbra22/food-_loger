from pathlib import Path
import json,sys
out=Path(__file__).resolve().parent
data=json.loads((out/'root-lint-summary.json').read_text())
print('Root Gradle lint completed, but XML findings determine this gate.')
print('Reports:',len(data['reports']),'errors:',len(data['errors']))
for issue in data['errors']:
 print(issue['severity'],issue['id'],issue['locations'][0]['file'],issue['locations'][0].get('line'))
print('FAIL: unresolved upstream SVG findings; no suppressions/waiver applied.' if data['errors'] else 'PASS: no errors in inspected reports.')
sys.exit(1 if data['errors'] else 0)
