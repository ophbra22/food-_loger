"""Local emulator driver. Reads actual Android accessibility nodes before acting."""
import subprocess, xml.etree.ElementTree as ET, re, sys, os
from pathlib import Path
ADB = os.environ.get('ADB', str(Path.home() / 'Library/Android/sdk/platform-tools/adb'))
def adb(*args):
    return subprocess.check_output([ADB, *args])
def nodes():
    adb('shell','uiautomator','dump','/sdcard/fl-window.xml')
    return list(ET.fromstring(adb('shell','cat','/sdcard/fl-window.xml')).iter('node'))
def visible():
    return [{'id': n.get('resource-id'), 'text': n.get('text'), 'label': n.get('content-desc'), 'bounds': n.get('bounds'), 'class':n.get('class')} for n in nodes() if n.get('text') or n.get('content-desc') or n.get('resource-id') in ('username','password')]
def find(key):
    matches=[n for n in nodes() if key in (n.get('resource-id'), n.get('text'), n.get('content-desc'))]
    if not matches: raise RuntimeError('Not visible: '+key)
    return matches[0]
def tap(key):
    n=find(key); x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def fill(key,value):
    tap(key)
    adb('shell','input','keyevent','KEYCODE_MOVE_END')
    adb('shell','input','keyevent','--longpress','KEYCODE_DEL')
    adb('shell','input','text',value.replace(' ','%s'))
def back(): adb('shell','input','keyevent','4')
def scroll(up=True): adb('shell','input','swipe','640','1450' if up else '700','640','650' if up else '1450','450')
def screenshot(name):
    from pathlib import Path
    Path('mobile/docs/screenshots/stabilization/'+name+'.png').write_bytes(adb('exec-out','screencap','-p'))
if __name__=='__main__':
    import json
    if len(sys.argv)>1: exec(sys.argv[1])
    print(json.dumps(visible(),ensure_ascii=False))
