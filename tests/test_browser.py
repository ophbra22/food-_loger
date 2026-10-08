"""Opt-in browser regressions; run FOODLOGGER_RUN_BROWSER_TESTS=1 pytest -m browser."""

import os
import socket
import subprocess
import sys
import time
import urllib.request

import pytest

pytestmark = [
    pytest.mark.browser,
    pytest.mark.skipif(
        os.getenv("FOODLOGGER_RUN_BROWSER_TESTS") != "1", reason="Opt-in browser tests"
    ),
]


@pytest.fixture
def browser_page(tmp_path):
    playwright = pytest.importorskip("playwright.sync_api")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = {**os.environ, "FOODLOGGER_DB": str(tmp_path / "browser.sqlite3")}
    process = subprocess.Popen(
        [sys.executable, "-m", "foodlogger.cli", "--port", str(port)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    url = f"http://127.0.0.1:{port}"
    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(url + "/api/health", timeout=0.2).close()
                break
            except OSError:
                time.sleep(0.05)
        else:
            raise RuntimeError("Browser-test server did not start")
        with playwright.sync_playwright() as p:
            options = {"headless": True}
            if executable := os.getenv("FOODLOGGER_CHROMIUM"):
                options["executable_path"] = executable
            browser = p.chromium.launch(**options)
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            page.goto(url, wait_until="networkidle")
            yield page
            browser.close()
    finally:
        process.terminate()
        process.wait(timeout=5)


def test_save_locks_form_until_request_finishes(browser_page):
    from playwright.sync_api import expect

    page = browser_page
    pending = []
    page.route("**/api/meals", lambda route: pending.append(route))
    page.locator("#food-select").select_option("banana")
    page.locator("#save-meal").click()
    expect(page.locator("#food-photo")).to_be_disabled()
    expect(page.locator("#food-select")).to_be_disabled()
    expect(page.locator("#grams")).to_be_disabled()
    assert len(pending) == 1
    pending[0].continue_()
    expect(page.locator("#food-photo")).to_be_enabled()
    expect(page.locator("#meal-count")).to_have_text("1")


def test_empty_date_clears_stale_results_and_disables_export(browser_page):
    from playwright.sync_api import expect

    page = browser_page
    page.locator("#food-select").select_option("banana")
    page.locator("#save-meal").click()
    expect(page.locator("#meal-count")).to_have_text("1")
    page.locator("#journal-date").fill("")
    page.locator("#journal-date").dispatch_event("change")
    expect(page.locator("#total-calories")).to_have_text("—")
    expect(page.locator("#journal-entries")).to_be_empty()
    expect(page.locator("#export-button")).not_to_have_attribute("href")


def test_manual_journal_round_trip_and_mobile_layout(browser_page):
    from playwright.sync_api import expect

    page = browser_page
    page.locator("#food-select").select_option("banana")
    page.locator("#grams").fill("150")
    page.locator("#save-meal").click()
    expect(page.locator("#total-calories")).to_have_text("133.5")
    page.reload(wait_until="networkidle")
    expect(page.locator("#meal-count")).to_have_text("1")
    with page.expect_download() as download:
        page.locator("#export-button").click()
    assert download.value.suggested_filename.startswith("foodlogger-")
    page.set_viewport_size({"width": 390, "height": 844})
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    page.get_by_role("button", name="Delete Banana").click()
    expect(page.locator("#meal-count")).to_have_text("0")
    expect(page.locator("#empty-journal")).to_be_visible()
