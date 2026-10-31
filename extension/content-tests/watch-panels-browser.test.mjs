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

test('same-scope live sessions are rejected before effects; retired session cannot release its successor', async t => {
  const page = await fixture(t);
  const result = await page.evaluate(() => {
    session.start(); const second = newSession(settings);
    let rejection=''; try { second.start(); } catch(error) { rejection=error.message; }
    session.release();
    const successor=newSession(settings); successor.start();
    session.releaseFeature('YT-03');
    const hidden=getComputedStyle(document.querySelector('ytd-comments')).display==='none';
    successor.release(); return {rejection,hidden};
  });
  assert.equal(result.rejection,'WATCH_SCOPE_ALREADY_ACTIVE');
  assert.equal(result.hidden,true);
});

test('selector exit restores reused panels and recommendations while preserving another owner', async t => {
  const page=await fixture(t,'<ytd-watch-flexy><ytd-engagement-panel-section-list-renderer target-id="engagement-panel-comments-section">comments</ytd-engagement-panel-section-list-renderer><div id="related">recommended</div></ytd-watch-flexy>');
  const result=await page.evaluate(() => {
    session.start(); const panel=document.querySelector('ytd-engagement-panel-section-list-renderer');
    const related=document.querySelector('#related'); ledger.hide('other',related);
    panel.setAttribute('target-id','transcript'); related.id='reused';
    const scan=session.scan(); const panelRestored=panel.style.display===''&&!panel.inert;
    const otherPreserved=related.style.display==='none'&&related.inert;
    ledger.release('other'); const relatedRestored=related.style.display===''&&!related.inert;
    return {scan,panelRestored,otherPreserved,relatedRestored,remaining:ledger.inspect().remaining_targets};
  });
  assert.equal(result.panelRestored,true); assert.equal(result.otherPreserved,true);
  assert.equal(result.relatedRestored,true); assert.equal(result.remaining,0);
  assert.deepEqual(result.scan.map(x=>x.status),['NO_TARGET','NO_TARGET']);
});

test('selector-exit restore failure retains debt and fences replacement until retry succeeds', async t => {
  const page=await fixture(t);
  const result=await page.evaluate(() => {
    session.start(); const element=document.querySelector('ytd-comments');
    const write=element.style.setProperty.bind(element.style);
    element.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid')throw Error('restore denied');write(name,value,priority);};
    document.body.append(element); // Same document, outside the eligible watch tree.
    const scan=session.scan(); const failed=session.releaseFeature('YT-03');
    session.releaseFeature('YT-04');
    let blocked='';try{newSession(settings).start();}catch(error){blocked=error.message;}
    element.style.setProperty=write;
    const retried=session.release(); const next=newSession(settings);next.start();next.release();
    return {scan,failed,blocked,retried,display:element.style.display};
  });
  assert.equal(result.scan[0].status,'FAILED'); assert.equal(result.failed.restored,false);
  assert.equal(result.failed.remaining_targets,1);assert.equal(result.blocked,'WATCH_SCOPE_ALREADY_ACTIVE');
  assert.equal(result.retried.every(x=>x.restored),true);assert.equal(result.display,'grid');
});

test('selector-exit adoption preserves the new document owner and unresolved old scope', async t => {
  const page=await fixture(t);
  const result=await page.evaluate(() => {
    session.start();const element=document.querySelector('ytd-comments');
    const frame=document.createElement('iframe');document.body.append(frame);
    const doc=frame.contentDocument;doc.body.append(doc.adoptNode(element));
    const next=new ledger.constructor(doc);next.hide('new-document',element);
    const scan=session.scan(),released=session.release();
    let blocked='';try{newSession(settings).start();}catch(error){blocked=error.message;}
    return {scan,released,blocked,display:element.style.display,inert:element.inert,remaining:next.inspect().remaining_targets};
  });
  assert.equal(result.scan[0].status,'FAILED');assert.equal(result.released[0].restored,false);
  assert.equal(result.blocked,'WATCH_SCOPE_ALREADY_ACTIVE');assert.equal(result.display,'none');
  assert.equal(result.inert,true);assert.equal(result.remaining,1);
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

test('merged TEST harness shares one ledger and releases watch independently of navigation options', async t => {
  const body='<ytd-masthead><input id="search"></ytd-masthead>'
    +'<ytd-guide-entry-renderer id="home"><a href="/">home</a></ytd-guide-entry-renderer>'
    +'<ytd-guide-entry-renderer id="subs"><a href="/feed/subscriptions">subscriptions</a></ytd-guide-entry-renderer>'
    +'<ytd-guide-entry-renderer id="explore"><a href="/feed/trending">explore</a></ytd-guide-entry-renderer>'
    +'<ytd-watch-flexy><video></video><ytd-comments>comments</ytd-comments><div id="related">recommendations</div></ytd-watch-flexy>';
  const page=await fixture(t,body);
  await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    for(const type of ['TEST_HOME_APPLY','TEST_SUBSCRIPTIONS_APPLY','TEST_EXPLORE_APPLY','TEST_MASTHEAD_APPLY'])await send(type);
    const applied=await send('TEST_WATCH_PANELS_APPLY');const released=await send('TEST_WATCH_PANELS_RELEASE');
    const preserved=['#home','#subs','#explore','ytd-masthead'].map(selector=>document.querySelector(selector).style.display);
    for(const type of ['TEST_HOME_RELEASE','TEST_SUBSCRIPTIONS_RELEASE','TEST_EXPLORE_RELEASE','TEST_MASTHEAD_RELEASE'])await send(type);
    const final=await send('TEST_WATCH_PANELS_STATE');return{applied,released,preserved,final};
  });
  assert.equal(result.applied.ledger.remaining_targets,6);assert.equal(result.released.ledger.remaining_targets,4);
  assert.deepEqual(result.preserved,['none','none','none','none']);assert.equal(result.final.ledger.remaining_targets,0);
  assert.equal(await page.locator('ytd-comments').isVisible(),true);assert.equal(await page.locator('#related').isVisible(),true);
});

test('watch uses latest pending-restore ledger after partial setter mutation', async t => {
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const node=document.querySelector('ytd-comments'),write=node.style.setProperty.bind(node.style);
    node.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial restoration');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{newSession(settings).start();}catch(error){blocked=error.message;}
    node.style.setProperty=write;const retry=session.release();return{failed,blocked,retry,display:node.style.display};
  });
  assert.equal(result.failed.find(value=>value.feature_id==='YT-03').restored,false);
  assert.equal(result.blocked,'WATCH_SCOPE_ALREADY_ACTIVE');assert.equal(result.retry.every(value=>value.restored),true);assert.equal(result.display,'grid');
});
