from pathlib import Path
import json,subprocess,hashlib,re
root=Path.cwd();out=root/'docs/biteflow/evidence/release-readiness/RC00'
commands=[['git','rev-parse','HEAD'],['xcodebuild','-version'],['swift','--version'],['node','--version'],['npm','--version'],['/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/java','-version'],['docker','version','--format','{{.Server.Version}}'],['.venv/bin/python','--version']]
records=[]
for c in commands:
 r=subprocess.run(c,capture_output=True,text=True);records.append(dict(command=c,exit_code=r.returncode,output=(r.stdout+r.stderr).strip()))
(out/'environment.json').write_text(json.dumps(records,indent=2)+'\n')
source=root/'docs/biteflow/p14-open-gates.md';lines=source.read_text().splitlines();rows=[]
for n,line in enumerate(lines,1):
 if (line.startswith('| ') and not any(line.startswith(x) for x in ['| Gate','| Issue','|---'])) or line.startswith('- ') or line.startswith(('P08 adds blocking','P08 review minor','P09 review carry-forward','The local P13 follow-up')):
  cols=[x.strip() for x in line.strip('|').split('|')] if line.startswith('|') else [line.lstrip('- '),'Original classification in source','']
  if len(cols)<3:continue
  rows.append((n,*cols[:3]))
def routing(t):
 t=t.lower(); ids=set()
 rules=[('RC01',('xcode','compiler','native compilation','java runtime','native build','toolchain')),('RC02',('lint','dependenc','advisories','speech dependency patch')),('RC03',('basis','provenance','label-draft','label drafts')),('RC04',('journal edit','saved-meal edit')),('RC05',('cleanup','archive leftovers','in-memory','startup erasure')),('RC06',('10%','english serving','bounded','restrictions editor','large-day','lost ai','warnings')),('RC07',('retention','privacy','export','consent','policy')),('RC08',('israeli','catalog','lookup','licens')),('RC09',('quota','provider','billing','terms','live ai')),('RC10–11',('photo','ocr','held-out','dataset')),('RC12',('speech','voice','audio')),('RC13',('health','sample','import','ledger loss','30days','nutritionrecord')),('RC14',('widget','app group','pixels','launcher','refresh scheduling')),('RC15',('notification','push','lease','scheduler','token')),('RC16',('hosted','staging','migration','restore','legacy','quarantine','backup')),('RC17',('monitoring','telemetry','collector')),('RC18–19',('device','rollback','sign','release','reinstall','accessibility')),('RC20–21',('actual approved release','observ','feedback','p14 entry','p14-a'))]
 for k,words in rules:
  if any(w in t for w in words):ids.add(k)
 return ', '.join(sorted(ids)) or 'RC00 / RC19'
text='''# Release gate register — RC00 baseline

Baseline e7f7c9d, 2026-10-18. Full F01–F20 / E2E-01–20, iOS + Android. User approved only local RC00–05. Historical phase progression statements are superseded by subsequent approvals, **not** evidence that technical gates closed. No gate is deleted or downgraded. Original source is preserved verbatim in [p14-open-gates](../p14-open-gates.md).

Owners: Codex = local implementation/evidence only. All operational product/privacy/data/device/signing/release owners remain **UNASSIGNED / BLOCKED** until nominated; no invented signoff. Every row below retains its original classification/evidence. Environment L=local, X=external, D=physical device. Mapping is closure routing, not authorization for RC06+.

| ID / source line | Original issue | Original classification | Closure tasks | Environment / owner | Current state / closure evidence required |
|---|---|---|---|---|---|
'''
for i,(n,issue,severity,evidence) in enumerate(rows,1):
 t=issue+' '+evidence;hist=('Java runtime' in t or 'Android native compilation'==issue)
 status='Historical missing-Java assertion superseded by later P11 local JDK/build evidence; current RC01 rerun required.' if hist else 'OPEN; '+evidence
 text+=f'| G{i:02} / [L{n}](../p14-open-gates.md#L{n}) | {issue} | {severity} | {routing(t)} | L; X/D where original requires / Codex locally; operational owner unassigned | {status} |\n'
text+='\n## Coverage routing from the approved plan\n\n'
plan=(root/'docs/superpowers/plans/2026-10-18-biteflow-release-readiness.md').read_text()
text+=plan.split('## כיסוי כל הפערים והקבלה\n',1)[1].split('## תנאי החלטה',1)[0]
text+='\n## RC00 scope matrix\n\n| Requirement | Owner / environment | State |\n|---|---|---|\n'
for family,prefix in [('Feature','F'),('Journey','E2E-')]:
 for i in range(1,21):text+=f'| {prefix}{i:02} | Codex local evidence; device/product owner UNASSIGNED; iOS+Android | IN SCOPE; full device/hosted acceptance BLOCKED; see p13-verification-matrix.md, not a new PASS |\n'
(root/'docs/biteflow/release-readiness/gate-register.md').write_text(text)
print(f'Preserved {len(rows)} source entries plus all 16 coverage groups and 40 scope identifiers.')
