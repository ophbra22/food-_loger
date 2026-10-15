"""Browser rendering of real RN components with synthetic local data (not device E2E)."""
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path(__file__).parent
with sync_playwright() as p:
 browser=p.chromium.launch()
 for language in ('en','he'):
  page=browser.new_page(viewport={'width':430,'height':932},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('http://127.0.0.1:8917/p07-review*',lambda r:r.fulfill(content_type='text/html',body='<html><head><style>html,body,#root{height:100%;margin:0}</style></head><body><div id="root"></div><script src="/p07-preview.bundle?platform=web&dev=true&minify=false"></script></body></html>'))
  page.goto('http://127.0.0.1:8917/p07-review?'+language,wait_until='networkidle')
  page.get_by_test_id('water-add-250').click();expect(page.get_by_test_id('water-total')).to_contain_text('250')
  page.get_by_test_id('water-add-500').click();expect(page.get_by_test_id('water-total')).to_contain_text('750')
  page.screenshot(path=str(out/f'water-{language}.png'),full_page=True)
  page.get_by_test_id('delete-00000000000000000000000000000001').click();expect(page.get_by_test_id('water-total')).to_contain_text('500')
  expect(page.get_by_test_id('point-2026-10-12')).to_have_count(0)
  expect(page.get_by_test_id('weight-point-2026-10-12')).to_have_count(0)
  page.get_by_test_id('chart-left-axis').scroll_into_view_if_needed()
  page.screenshot(path=str(out/f'chart-{language}.png'),full_page=True)
  assert not errors,errors
  print(f'PASS {language}: 250+500=750; delete250=500; chart gaps preserved; browser runtime errors=0. Synthetic component harness only.')
  page.close()
 browser.close()
