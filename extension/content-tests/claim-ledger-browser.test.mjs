import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let browser;
before(async () => { browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}) }); });
after(async () => { await browser?.close(); });
async function pageFor(t) {
  const context = await browser.newContext(); t.after(() => context.close());
  await context.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (!/^\/(content\/claim-ledger\.mjs|content-tools\/claims\.(html|mjs))$/.test(path)) { await route.abort(); return; }
    await route.fulfill({ contentType: path.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript',
      body: await readFile(new URL('..' + path, import.meta.url), 'utf8') });
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4178/content-tools/claims.html');
  await page.waitForFunction(() => document.querySelector('#result').textContent.includes('remaining_targets'));
  return page;
}
test('Chrome synthetic DOM: one release preserves another claim and final cleanup restores input', async t => {
  const page = await pageFor(t);
  await page.click('#hide-a'); await page.click('#hide-b'); await page.click('#release-a');
  assert.equal(await page.locator('#target').isVisible(), false);
  assert.equal(await page.locator('#target').evaluate(e => e.inert), true);
  await page.click('#release-b');
  assert.equal(await page.locator('#target').isVisible(), true);
  assert.equal(await page.locator('#target').evaluate(e => e.inert), false);
  await page.click('#target-button');
  assert.equal(await page.locator('#click-count').textContent(), '클릭 1회');
});
test('Chrome synthetic DOM: independent grayscale survives hide release and original filter returns', async t => {
  const page = await pageFor(t);
  const original = await page.locator('#target').evaluate(e => e.style.filter);
  await page.click('#gray'); await page.click('#hide-a'); await page.click('#release-a');
  assert.equal(await page.locator('#target').isVisible(), true);
  assert.match(await page.locator('#target').evaluate(e => getComputedStyle(e).filter), /grayscale\(1\)/);
  await page.click('#ungray');
  assert.equal(await page.locator('#target').evaluate(e => e.style.filter), original);
});
test('Chrome synthetic DOM: page updates are remembered through rescan and cleanup', async t => {
  const page = await pageFor(t);
  await page.click('#hide-a'); await page.click('#page-change'); await page.click('#rescan');
  assert.equal(await page.locator('#target').isVisible(), false);
  await page.click('#release-a');
  assert.equal(await page.locator('#target').evaluate(e => getComputedStyle(e).display), 'flex');
  assert.equal(await page.locator('#target').evaluate(e => e.inert), false);
});
test('Chrome synthetic DOM: closed document prevents new effects while exact cleanup still works', async t => {
  const page = await pageFor(t);
  const outcome = await page.evaluate(async () => {
    const { ClaimLedger } = await import('/content/claim-ledger.mjs');
    const ledger = new ClaimLedger(document), element = document.querySelector('#target');
    ledger.hide('old', element); ledger.suspend();
    let rejection = '';
    try { ledger.hide('new', element); } catch (error) { rejection = error.message; }
    return { rejection, cleanup: ledger.release('old') };
  });
  assert.equal(outcome.rejection, 'DOCUMENT_EFFECTS_CLOSED');
  assert.equal(outcome.cleanup.restored, true);
  assert.equal(await page.locator('#target').isVisible(), true);
});
