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

async function fixture(t, html = '<ytd-watch-flexy><video id="video"></video><div id="related">recommended</div><ytd-comments style="display:grid">comments</ytd-comments></ytd-watch-flexy>', url = 'https://www.youtube.com/watch?v=fixture') {
  const context = await browser.newContext(); t.after(() => context.close());
  await context.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname;
    if (/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path)) {
      await route.fulfill({ contentType:'text/javascript', body:await readFile(new URL('..' + path, import.meta.url), 'utf8') });
    } else await route.fulfill({contentType:'text/html',body:html});
  });
  const page = await context.newPage(); await page.goto(url);
  await page.evaluate(async () => {
    const {ClaimLedger} = await import('/content/claim-ledger.mjs');
    const {WatchPanelSession} = await import('/content/watch-panels.mjs');
    window.observations = []; window.invalidations = [];
    window.ledger = new ClaimLedger(document);
    window.settings = {ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      features:[{feature_id:'YT-03',enabled:true,required:true},{feature_id:'YT-04',enabled:true,required:true}],
      onObservation:result => observations.push(result),onInvalidated:result => invalidations.push(result)};
    window.session = new WatchPanelSession(document,settings);
    window.newSession = options => new WatchPanelSession(document,options);
  });
  return page;
}

test('watch options use exact YT IDs, preserve video and independently restore comments/recommendations', async t => {
  const page = await fixture(t);
  const results = await page.evaluate(() => session.start());
  assert.deepEqual(results.map(x => [x.feature_id,x.status,x.native_verified]), [['YT-03','OBSERVED',false],['YT-04','OBSERVED',false]]);
  assert.equal(await page.locator('ytd-comments').isVisible(), false);
  assert.equal(await page.locator('#related').isVisible(), false);
  assert.equal(await page.locator('#video').evaluate(e => e.style.display), '');
  await page.evaluate(() => session.releaseFeature('YT-03'));
  assert.equal(await page.locator('ytd-comments').isVisible(), true);
  assert.equal(await page.locator('#related').isVisible(), false);
  await page.evaluate(() => session.release());
  assert.equal(await page.locator('#related').isVisible(), true);
  assert.equal(await page.locator('ytd-comments').evaluate(e => e.style.display), 'grid');
});

test('frozen option input and preflight reject unsupported/duplicate options without applying', async t => {
  const page = await fixture(t);
  const result = await page.evaluate(() => {
    settings.features[0].enabled = false;
    const frozen = session.start(); session.release();
    const errors = [];
    for (const features of [[{feature_id:'YT-01',enabled:true,required:true}], [{feature_id:'YT-03',enabled:true,required:true},{feature_id:'YT-03',enabled:false,required:true}]]) {
      try { newSession({...settings,features}); } catch (error) { errors.push(error.message); }
    }
    return {frozen,errors};
  });
  assert.equal(result.frozen[0].feature_id, 'YT-03');
  assert.deepEqual(result.errors, ['UNSUPPORTED_WATCH_FEATURE','DUPLICATE_WATCH_FEATURE']);
  assert.equal(await page.locator('ytd-comments').isVisible(), true);
});

test('two synthetic owner/binding identities share the same DOM and preserve the last owner', async t => {
  const page = await fixture(t);
  await page.evaluate(() => {
    session.start();
    window.second = newSession({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003',binding_id:'00000000-0000-4000-8000-000000000004'});
    second.start(); session.release();
  });
  assert.equal(await page.locator('ytd-comments').isVisible(), false);
  assert.equal(await page.locator('#related').isVisible(), false);
  await page.evaluate(() => second.release());
  assert.equal(await page.locator('ytd-comments').isVisible(), true);
  assert.equal(await page.locator('#related').isVisible(), true);
});

test('late panels and comment engagement panels are restricted with no self-trigger loop', async t => {
  const page = await fixture(t, '<ytd-watch-flexy><video></video></ytd-watch-flexy>');
  assert.deepEqual((await page.evaluate(() => session.start())).map(x => x.status), ['NO_TARGET','NO_TARGET']);
  await page.evaluate(() => document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend', '<ytd-engagement-panel-section-list-renderer target-id="engagement-panel-comments-section">panel</ytd-engagement-panel-section-list-renderer><div id="related">new</div>'));
  await page.waitForFunction(() => document.querySelector('#related').style.display === 'none');
  assert.equal(await page.locator('ytd-engagement-panel-section-list-renderer').isVisible(), false);
  const count = await page.evaluate(() => observations.length);
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => observations.length), count);
});

test('page style change is preserved after observer reapplies and the option releases', async t => {
  const page = await fixture(t); await page.evaluate(() => session.start());
  await page.evaluate(() => { const e = document.querySelector('ytd-comments');e.style.display='flex';e.inert=false; });
  await page.waitForFunction(() => document.querySelector('ytd-comments').style.display === 'none');
  await page.evaluate(() => session.release());
  assert.equal(await page.locator('ytd-comments').evaluate(e => [e.style.display,e.inert].join(',')), 'flex,false');
});

test('SPA navigation closes this scope, retains cleanup and does not authorize new effects', async t => {
  const page = await fixture(t); await page.evaluate(() => session.start());
  await page.evaluate(() => { history.pushState({},'', '/watch?v=next');window.dispatchEvent(new Event('yt-navigate-finish')); });
  await page.waitForFunction(() => invalidations.length === 1);
  const invalidation = await page.evaluate(() => invalidations[0]);
  assert.equal(invalidation.reason, 'ROUTE_CHANGED'); assert.equal(invalidation.cleanup_pending, true);
  await page.evaluate(() => document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend','<ytd-comments id="new">new comments</ytd-comments>'));
  assert.equal(await page.locator('#new').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => session.scan()), []);
  assert.equal((await page.evaluate(() => session.release())).every(x => x.restored), true);
  assert.equal(await page.locator('ytd-comments').first().isVisible(), true);
});

test('simulated BFCache pagehide cannot auto-reactivate; cleanup and disposed observers stay safe', async t => {
  const page = await fixture(t); await page.evaluate(() => session.start());
  await page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})); });
  assert.equal((await page.evaluate(() => invalidations[0])).reason, 'PAGEHIDE');
  assert.deepEqual(await page.evaluate(() => session.scan()), []);
  await page.evaluate(() => session.release());
  const count = await page.evaluate(() => observations.length);
  await page.evaluate(() => document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend','<ytd-comments id="late">late</ytd-comments>'));
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#late').isVisible(), true);
  assert.equal(await page.evaluate(() => observations.length), count);
});

test('watch adapter rejects another host or Shorts before touching elements', async t => {
  for (const url of ['https://www.youtube.com/shorts/fixture','https://youtube.com.evil.example/watch?v=fixture']) {
    const page = await fixture(t, undefined, url);
    assert.equal(await page.evaluate(() => {try {session.start();} catch(error) {return error.message;}}), 'UNSUPPORTED_WATCH_DOCUMENT');
    assert.equal(await page.locator('ytd-comments').isVisible(), true);
  }
});

test('trusted TEST popup connects watch module; untrusted page cannot command it', async t => {
  const page = await fixture(t);
  await page.evaluate(() => { window.chrome = {runtime:{id:'test-extension',getURL:path => location.origin+'/'+path,onMessage:{addListener:cb => {window.listener=cb;}}}}; });
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result = await page.evaluate(async () => {
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};
    let leaked=false;const rejected=listener({type:'TEST_WATCH_PANELS_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    const applied=await send('TEST_WATCH_PANELS_APPLY');const comments=await send('TEST_WATCH_COMMENTS_RELEASE');
    const recommendationStillHidden=document.querySelector('#related').style.display==='none';
    const partialRetry=await send('TEST_WATCH_PANELS_APPLY');
    const released=await send('TEST_WATCH_PANELS_RELEASE');
    const reapplied=await send('TEST_WATCH_PANELS_APPLY');
    const reapplyHidden=document.querySelector('ytd-comments').style.display==='none';
    const recommendations=await send('TEST_WATCH_RECOMMENDATIONS_RELEASE');
    const recommendationOnly={commentsHidden:document.querySelector('ytd-comments').style.display==='none',
      recommendationsVisible:getComputedStyle(document.querySelector('#related')).display!=='none'};
    const recommendationsAgain=await send('TEST_WATCH_RECOMMENDATIONS_RELEASE');
    await send('TEST_WATCH_PANELS_RELEASE');
    return {rejected:rejected===undefined&&!leaked,applied,comments,recommendationStillHidden,partialRetry,released,reapplied,reapplyHidden,recommendations,recommendationOnly,recommendationsAgain};
  });
  assert.equal(result.rejected, true); assert.equal(result.applied.coreConnected, false);
  assert.equal(result.comments.released.restored, true); assert.equal(result.recommendationStillHidden, true);
  assert.deepEqual(result.comments.results.map(value => value.feature_id), ['YT-04']);
  assert.match(result.partialRetry.error, /FULL_RELEASE_REQUIRED/);
  assert.equal(result.reapplyHidden, true); assert.equal(result.reapplied.results.length, 2);
  assert.equal(result.recommendations.released.restored, true);
  assert.deepEqual(result.recommendations.results.map(value => value.feature_id), ['YT-03']);
  assert.deepEqual(result.recommendationOnly, {commentsHidden:true,recommendationsVisible:true});
  assert.equal(result.recommendationsAgain.released.restored, true);
  assert.equal(result.released.released.every(x => x.restored), true);
  assert.equal(await page.locator('ytd-comments').isVisible(), true);
});
