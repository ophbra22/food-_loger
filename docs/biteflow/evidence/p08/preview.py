"""Render actual RN components with synthetic API fixtures; not physical-device E2E."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path(__file__).parent
entry=Path('mobile/p08-preview.tsx')
assert not entry.exists() or entry.read_text()==(out/"preview-entry.tsx").read_text()
entry.write_text((out/'preview-entry.tsx').read_text())
try:
 with sync_playwright() as p:
  browser=p.chromium.launch()
  for language in ('en','he'):
   for feature in ('insight','recommendation'):
    page=browser.new_page(viewport={'width':430,'height':932},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('http://127.0.0.1:8918/p08-review*',lambda r:r.fulfill(content_type='text/html',body='<html><head><meta charset="utf-8"><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/p08-preview.bundle?platform=web&dev=true&minify=false"></script></body></html>'))
    page.goto('http://127.0.0.1:8918/p08-review?'+language+'&'+feature,wait_until='networkidle')
    assert not errors,errors
    if feature=='recommendation':
     expect(page.get_by_test_id('advice-choice-0')).to_be_visible()
     page.get_by_test_id('advice-choice-0').click();expect(page.get_by_test_id('preview-selection')).to_have_text('recipe: 200 g, editable, unsaved')
    else:expect(page.get_by_text('3',exact=False).first).to_be_visible()
    page.screenshot(path=str(out/f'{feature}-{language}.png'),full_page=True)
    assert not errors,errors
    print(f'PASS {language}/{feature}: rendered actual RN panel, runtime errors=0; synthetic fixture, not native E2E.')
    page.close()
  browser.close()
finally:entry.unlink()
