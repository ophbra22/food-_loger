import subprocess,xml.etree.ElementTree as E,re,sys
from pathlib import Path
adb=['/Users/braude/Library/Android/sdk/platform-tools/adb','-s','emulator-5584'];out=Path('docs/biteflow/evidence/p13')
def run(*args):return subprocess.check_output(adb+list(args))
def tree():
 run('shell','uiautomator','dump','/sdcard/p13-ui.xml')
 return E.fromstring(run('shell','cat','/sdcard/p13-ui.xml'))
def show():
 r=tree()
 for n in r.iter('node'):
  label=n.get('text') or n.get('content-desc')
  if label:print(label,n.get('class'),n.get('bounds'))
 return r
if __name__=='__main__':
 action=sys.argv[1]
 if action=='show':show()
 elif action=='tap':
  r=tree();matches=[n for n in r.iter('node') if (n.get('text')==sys.argv[2] or n.get('content-desc')==sys.argv[2]) and n.get('clickable')=='true'];assert len(matches)==1,[(n.get('text'),n.get('content-desc'),n.get('clickable')) for n in r.iter('node') if n.get('text')==sys.argv[2] or n.get('content-desc')==sys.argv[2]]
  a=list(map(int,re.findall(r'\d+',matches[0].get('bounds'))));run('shell','input','tap',str((a[0]+a[2])//2),str((a[1]+a[3])//2))
 elif action=='capture':
  r=tree();E.ElementTree(r).write(out/(sys.argv[2]+'.xml'),encoding='utf-8');(out/(sys.argv[2]+'.png')).write_bytes(run('exec-out','screencap','-p'));print('captured',sys.argv[2])
