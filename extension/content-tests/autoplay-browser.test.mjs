import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<ytd-watch-flexy><video id="video"></video><button class="ytp-autonav-toggle-button" aria-checked="true">auto</button><ytd-comments>comments</ytd-comments><div id="related">recommended</div><button id="next">next</button></ytd-watch-flexy>';
async function fixture(t,{body=html,url='https://www.youtube.com/watch?v=fixture'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body});
  });
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const {ClaimLedger}=await import('/content/claim-ledger.mjs');
    const {AutoplaySession}=await import('/content/autoplay.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];window.clicks=0;window.rejectToggle=false;
    window.attach=element=>element.addEventListener('click',()=>{clicks++;if(!rejectToggle)element.setAttribute('aria-checked',element.getAttribute('aria-checked')==='true'?'false':'true');});
    document.querySelectorAll('.ytp-autonav-toggle-button').forEach(attach);
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      onObservation:value=>observations.push(value),onInvalidated:value=>invalidations.push(value)};
    window.make=options=>new AutoplaySession(document,options);window.session=make(settings);
  });return page;
}

test('YT-10 switches synthetic control OFF, preserves media/manual next, and restores ON',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    const video=document.querySelector('video');let mediaCalls=0,nextCalls=0;
    video.play=video.pause=()=>{mediaCalls++;};document.querySelector('#next').onclick=()=>{nextCalls++;};
    const applied=session.start();session.scan();document.querySelector('#next').click();
    const before={clicks,checked:document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked'),mediaCalls,nextCalls};
    const release=session.release();return {applied,before,release,clicks,checked:document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked')};
  });
  assert.equal(result.applied.feature_id,'YT-10');assert.equal(result.applied.status,'OBSERVED');
  assert.equal(result.applied.native_verified,false);assert.deepEqual(result.before,{clicks:1,checked:'false',mediaCalls:0,nextCalls:1});
  assert.equal(result.release.restored,true);assert.equal(result.checked,'true');assert.equal(result.clicks,2);
});

test('original OFF is not enabled by cleanup',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{document.querySelector('.ytp-autonav-toggle-button').setAttribute('aria-checked','false');session.start();return {release:session.release(),clicks};});
  assert.equal(result.release.restored,true);assert.equal(result.clicks,0);
});

test('shared owners preserve OFF until final release; duplicate scope and retired cleanup are fenced',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    session.start();let duplicate='';try{make(settings).start();}catch(error){duplicate=error.message;}
    const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();
    const shared=document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked');
    other.release();const next=make(settings);next.start();session.release();
    const successor=document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked');next.release();return {duplicate,shared,successor};
  });
  assert.equal(result.duplicate,'AUTOPLAY_SCOPE_ALREADY_ACTIVE');assert.equal(result.shared,'false');assert.equal(result.successor,'false');
});

test('late toggle is observed, rejected clicks are not hammered, and manual OFF resolves observation',async t=>{
  const page=await fixture(t,{body:'<ytd-watch-flexy></ytd-watch-flexy>'});
  assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(()=>{rejectToggle=true;const e=document.createElement('button');e.className='ytp-autonav-toggle-button';e.setAttribute('aria-checked','true');attach(e);document.querySelector('ytd-watch-flexy').append(e);});
  await page.waitForFunction(()=>observations.at(-1).status==='FAILED');
  assert.equal(await page.evaluate(()=>{session.scan();session.scan();return clicks;}),1);
  await page.evaluate(()=>document.querySelector('.ytp-autonav-toggle-button').setAttribute('aria-checked','false'));
  await page.waitForFunction(()=>observations.at(-1).status==='OBSERVED');
  const result=await page.evaluate(()=>{const failed=session.release();rejectToggle=false;return {failed,retry:session.release()};});
  assert.equal(result.failed.restored,false);assert.equal(result.failed.remaining_targets,1);assert.equal(result.retry.restored,true);
});

test('page ON change is re-restricted; selector exit restores only its resource',async t=>{
  const page=await fixture(t);await page.evaluate(()=>session.start());
  await page.evaluate(()=>document.querySelector('.ytp-autonav-toggle-button').setAttribute('aria-checked','true'));
  await page.waitForFunction(()=>clicks===2);
  await page.evaluate(()=>document.querySelector('.ytp-autonav-toggle-button').className='reused');
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await page.locator('.reused').getAttribute('aria-checked'),'true');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
});

test('foreign-document cleanup retains debt and does not mutate adopted toggle',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    session.start();const e=document.querySelector('.ytp-autonav-toggle-button');const f=document.createElement('iframe');document.body.append(f);f.contentDocument.body.append(f.contentDocument.adoptNode(e));
    const scan=session.scan(),cleanup=session.release();let duplicate='';try{make(settings).start();}catch(error){duplicate=error.message;}
    return {scan,cleanup,duplicate,checked:e.getAttribute('aria-checked'),clicks};
  });
  assert.equal(result.scan.status,'FAILED');assert.equal(result.cleanup.restored,false);assert.equal(result.checked,'false');assert.equal(result.clicks,1);assert.equal(result.duplicate,'AUTOPLAY_SCOPE_ALREADY_ACTIVE');
});

test('SPA and simulated BFCache invalidate effects without inventing release or reauthorization',async t=>{
  for(const kind of ['spa','pagehide']){
    const page=await fixture(t);await page.evaluate(()=>session.start());
    await page.evaluate(kind=>{if(kind==='spa'){history.pushState({},'','/watch?v=other');dispatchEvent(new Event('yt-navigate-finish'));}else{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}},kind);
    await page.waitForFunction(()=>invalidations.length===1);
    assert.equal(await page.evaluate(()=>session.scan()),null);
    assert.equal(await page.evaluate(()=>invalidations[0].cleanup_pending),true);
    assert.equal((await page.evaluate(()=>session.release())).restored,true);
  }
});

test('unsupported document rejects before a click',async t=>{
  for(const url of ['https://www.youtube.com/shorts/fixture','https://youtube.com.evil.test/watch?v=x']){
    const page=await fixture(t,{url});
    assert.equal(await page.evaluate(()=>{try{session.start();}catch(error){return error.message;}}),'UNSUPPORTED_WATCH_DOCUMENT');
    assert.equal(await page.evaluate(()=>clicks),0);
  }
});

test('TEST popup autoplay commands coexist with comment controls and reject page sender',async t=>{
  const page=await fixture(t);
  await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;
    listener({type:'TEST_AUTOPLAY_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    await send('TEST_WATCH_PANELS_APPLY');const applied=await send('TEST_AUTOPLAY_APPLY');
    const released=await send('TEST_AUTOPLAY_RELEASE');const commentsStillHidden=document.querySelector('ytd-comments').style.display==='none';
    await send('TEST_WATCH_PANELS_RELEASE');return {leaked,applied,released,commentsStillHidden};
  });
  assert.equal(result.leaked,false);assert.equal(result.applied.result.status,'OBSERVED');assert.equal(result.applied.coreConnected,false);
  assert.equal(result.released.released.restored,true);assert.equal(result.commentsStillHidden,true);
});

test('merged harness preserves all navigation/watch options when autoplay alone releases',async t=>{
  const body='<ytd-masthead><input id="search"></ytd-masthead><ytd-guide-entry-renderer id="home"><a href="/">home</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="subs"><a href="/feed/subscriptions">subs</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="explore"><a href="/feed/trending">explore</a></ytd-guide-entry-renderer>'+html;
  const page=await fixture(t,{body});await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    for(const type of ['TEST_HOME_APPLY','TEST_SUBSCRIPTIONS_APPLY','TEST_EXPLORE_APPLY','TEST_MASTHEAD_APPLY','TEST_WATCH_PANELS_APPLY'])await send(type);
    const applied=await send('TEST_AUTOPLAY_APPLY'),off=document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked');
    const released=await send('TEST_AUTOPLAY_RELEASE'),on=document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked');
    const preserved=['#home','#subs','#explore','ytd-masthead','ytd-comments','#related'].map(selector=>document.querySelector(selector).style.display);
    for(const type of ['TEST_HOME_RELEASE','TEST_SUBSCRIPTIONS_RELEASE','TEST_EXPLORE_RELEASE','TEST_MASTHEAD_RELEASE','TEST_WATCH_PANELS_RELEASE'])await send(type);
    return{applied,released,off,on,preserved,remaining:(await send('TEST_WATCH_PANELS_STATE')).ledger.remaining_targets};
  });assert.equal(result.applied.coreConnected,false);assert.equal(result.off,'false');assert.equal(result.on,'true');assert.equal(result.released.released.restored,true);assert.deepEqual(result.preserved,Array(6).fill('none'));assert.equal(result.remaining,0);
});
