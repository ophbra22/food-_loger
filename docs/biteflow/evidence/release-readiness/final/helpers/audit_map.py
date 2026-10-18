from pathlib import Path
import json,xml.etree.ElementTree as E
out=Path(__file__).resolve().parent;root=out.parents[1]
s=(out/'audit-initial.log').read_text();audit=json.JSONDecoder().raw_decode(s[s.index('{'):])[0]
prev=(root/'docs/biteflow/evidence/p13/dependency-npm.log').read_text();old=json.JSONDecoder().raw_decode(prev[prev.index('{'):])[0]
rows=['# Dependency and native-warning disposition','', 'Original severity is retained. No development/build dependency is treated as harmless solely by category. These are dependency nodes, not 67 distinct root vulnerabilities. Final audit is recorded separately.','', '| Dependency | Severity | Root exposure | Installed nodes | Historical P13 | Disposition |','|---|---|---|---|---|---|']
def roots(name,seen=None):
 seen=set() if seen is None else seen
 if name in seen:return []
 seen.add(name);vs=audit['vulnerabilities'][name]['via'];return sorted(set([v['name'] for v in vs if isinstance(v,dict)]+[r for v in vs if isinstance(v,str) for r in roots(v,seen)]))
for name,v in sorted(audit['vulnerabilities'].items()):
 r=roots(name);decision='OPEN — no compatible patched upstream release for '+', '.join(x for x in r if x in ['braces','node-forge','sprintf-js'])
 if r==['uuid']:decision='Candidate scoped xcode→uuid11.1.1; final audit/build evidence required'
 elif r==['decode-uri-component']:decision='OPEN — patched0.5 ESM export incompatible with query-string7 CommonJS callable; no forced Expo58 upgrade'
 rows.append('| '+ ' | '.join([name,v['severity'],', '.join(r),'<br>'.join(v['nodes']), 'present' if name in old['vulnerabilities'] else 'new',decision])+' |')
rows+=['','## Eight inherited native warnings','', '| Rule | Location | Original finding | Closure task |','|---|---|---|---|']
for i in E.parse(root/'docs/biteflow/evidence/p12/android-lint-focused.xml').getroot().findall('issue'):
 l=i.find('location');p=l.get('file').split('/food-_loger/')[-1]
 rows.append('| '+' | '.join([i.get('id'),p+':'+l.get('line'),i.get('message').replace('|','/'),'RC06, remains open; no lint exclusion counts as closure'])+' |')
p=root/'docs/biteflow/release-readiness/dependency-disposition.md';p.write_text('\n'.join(rows)+'\n')
print('mapped',len(audit['vulnerabilities']),'dependency nodes;',len(E.parse(root/'docs/biteflow/evidence/p12/android-lint-focused.xml').getroot().findall('issue')),'inherited warnings')
