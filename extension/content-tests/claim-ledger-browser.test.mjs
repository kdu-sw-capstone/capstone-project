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

for (const [variable, expected] of [['none', 'grayscale(1)'], ['brightness(.8)', 'brightness(0.8) grayscale(1)']]) {
  test(`Chrome regression: variable filter ${variable} has a computed grayscale effect and restores declaration`, async t => {
    const page = await pageFor(t);
    const result = await page.evaluate(async variable => {
      const { ClaimLedger } = await import('/content/claim-ledger.mjs');
      const ledger = new ClaimLedger(document), element = document.querySelector('#target');
      element.style.setProperty('--page-filter', variable);
      element.style.setProperty('filter', 'var(--page-filter)', 'important');
      const verified = ledger.grayscale('A', element);
      const computed = getComputedStyle(element).filter;
      ledger.grayscale('B', element); ledger.release('A');
      const shared = getComputedStyle(element).filter;
      const cleanup = ledger.release('B');
      return { verified, computed, shared, cleanup, original: element.style.filter,
        priority: element.style.getPropertyPriority('filter') };
    }, variable);
    assert.equal(result.verified, true);
    assert.equal(result.computed, expected);
    assert.equal(result.shared, expected);
    assert.equal(result.cleanup.restored, true);
    assert.equal(result.original, 'var(--page-filter)');
    assert.equal(result.priority, 'important');
  });
}

for (const suspended of [false, true]) {
  test(`Chrome regression: adopted node preserves new document effects and old cleanup debt (suspended=${suspended})`, async t => {
    const page = await pageFor(t);
    const result = await page.evaluate(async suspended => {
      const { ClaimLedger } = await import('/content/claim-ledger.mjs');
      const element = document.querySelector('#target'), old = new ClaimLedger(document);
      old.hide('old', element);
      const frame = document.createElement('iframe'); document.body.append(frame);
      const nextDocument = frame.contentDocument;
      nextDocument.body.append(nextDocument.adoptNode(element));
      const next = new ClaimLedger(nextDocument); next.hide('next', element);
      if (suspended) old.suspend();
      const cleanup = old.release('old');
      return { cleanup, remaining: old.inspect('old'),
        display: nextDocument.defaultView.getComputedStyle(element).display, inert: element.inert,
        next: next.inspect('next') };
    }, suspended);
    assert.equal(result.cleanup.restored, false);
    assert.equal(result.remaining.remaining_targets, 1);
    assert.ok(result.cleanup.error_count > 0);
    assert.equal(result.display, 'none'); assert.equal(result.inert, true);
    assert.equal(result.next.remaining_targets, 1);
  });
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
