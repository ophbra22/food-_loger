from pathlib import Path
from playwright.sync_api import sync_playwright
base=Path('docs/biteflow/evidence/p14').resolve()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':1280,'height':900})
    external=[]
    def request(route):
        external.append(route.request.url);route.abort()
    page.route('http://**',request);page.route('https://**',request)
    for mode in ('empty','synthetic'):
        page.goto((base/mode/'dashboard.html').as_uri())
        assert page.locator('tbody tr').count()==22
        assert 'BLOCKED' in page.locator('.notice').inner_text()
        assert ('No observations' if mode=='empty' else 'SYNTHETIC VALIDATION ONLY') in page.locator('.notice').inner_text()
        page.screenshot(path=str(base/(mode+'-dashboard.png')),full_page=True)
        page.set_viewport_size({'width':375,'height':812})
        assert page.locator('table').is_visible()
        page.set_viewport_size({'width':1280,'height':900})
    assert not external
    browser.close()
print('PASS:2 local dashboards,22 rows each,blocked notices,desktop/narrow layout,0 external requests. Not a device/accessibility audit.')
