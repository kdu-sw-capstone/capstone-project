import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<ytd-masthead><a id="logo" href="/">logo</a><input id="search"></ytd-masthead>'
  +'<ytd-guide-entry-renderer id="home"><a href="/">home</a></ytd-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="subscriptions"><a href="/feed/subscriptions">subscriptions</a></ytd-guide-entry-renderer>'
  +'<ytd-mini-guide-entry-renderer id="mini"><a href="https://www.youtube.com/feed/subscriptions">subscriptions</a></ytd-mini-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="history"><a href="/feed/history">history</a></ytd-guide-entry-renderer>'
  +'<ytd-browse page-subtype="subscriptions" style="display:grid">subscribed videos</ytd-browse>'
  +'<ytd-browse page-subtype="home">home feed</ytd-browse><ytd-search>results</ytd-search>'
  +'<ytd-watch-flexy><video id="video"></video><button id="account-subscribe">subscribed</button><div id="related">related</div></ytd-watch-flexy>';
async function fixture(t,{body=html,url='https://www.youtube.com/feed/subscriptions'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body});
  });
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');const{SubscriptionsSession}=await import('/content/subscriptions.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];window.accountChanges=0;
    const button=document.querySelector('#account-subscribe');if(button)button.onclick=()=>{accountChanges++;};
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:value=>observations.push(value),onInvalidated:value=>invalidations.push(value)};
    window.make=options=>new SubscriptionsSession(document,options);window.session=make(settings);
  });return page;
}

test('sidebar subscription section includes subscribed channels and expands without hiding other menus',async t=>{
  const body='<ytd-guide-section-renderer id="main"><ytd-guide-entry-renderer><a href="/">home</a></ytd-guide-entry-renderer><a href="/shorts/x">Shorts</a></ytd-guide-section-renderer>'
    +'<ytd-guide-section-renderer id="subscribed-section"><ytd-guide-entry-renderer><a href="/feed/subscriptions">subscriptions</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer><a href="/@channel-one">channel</a></ytd-guide-entry-renderer><button id="more">more</button></ytd-guide-section-renderer>'
    +'<ytd-guide-section-renderer id="personal"><a href="/feed/history">history</a></ytd-guide-section-renderer><main><a id="video-channel" href="/@channel-one">video channel</a></main>';
  const page=await fixture(t,{body,url:'https://www.youtube.com/'});await page.evaluate(()=>session.start());
  assert.equal(await page.locator('#subscribed-section').isVisible(),false);
  assert.equal(await page.locator('#main').isVisible(),true);assert.equal(await page.locator('#personal').isVisible(),true);
  assert.equal(await page.locator('#video-channel').isVisible(),true);
  await page.evaluate(()=>document.querySelector('#subscribed-section').insertAdjacentHTML('beforeend','<ytd-guide-entry-renderer id="late-channel"><a href="/channel/channel-two">late</a></ytd-guide-entry-renderer>'));
  await page.waitForFunction(()=>observations.length>1);
  assert.equal(await page.locator('#late-channel').isVisible(),false);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal(await page.locator('#subscribed-section').isVisible(),true);assert.equal(await page.locator('#late-channel').isVisible(),true);
});

test('mixed navigation preserves unrelated entries and reusing a subscriptions section restores its claim',async t=>{
  const body='<ytd-guide-section-renderer id="mixed"><ytd-guide-entry-renderer id="home"><a href="/">home</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="subs"><a href="/feed/subscriptions">subs</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="channel"><a href="/@followed">channel</a></ytd-guide-entry-renderer><a id="foreign" href="https://example.test/@other">external</a></ytd-guide-section-renderer>';
  const page=await fixture(t,{body,url:'https://www.youtube.com/'});await page.evaluate(()=>session.start());
  assert.equal(await page.locator('#mixed').isVisible(),true);assert.equal(await page.locator('#home').isVisible(),true);
  assert.equal(await page.locator('#subs').isVisible(),false);assert.equal(await page.locator('#channel').isVisible(),false);
  assert.equal(await page.locator('#foreign').isVisible(),true);
  await page.evaluate(()=>document.querySelector('#subs a').href='/feed/history');
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await page.locator('#subs').isVisible(),true);assert.equal(await page.locator('#channel').isVisible(),true);
});

test('YT-05 hides subscription entries/list only, never changes account or search/video',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>session.start());
  assert.equal(result.feature_id,'YT-05');assert.equal(result.status,'OBSERVED');assert.equal(result.native_verified,false);
  assert.equal(result.eligible_target_count,3);assert.equal(result.restricted_target_count,3);
  for(const selector of ['#subscriptions','#mini','ytd-browse[page-subtype="subscriptions"]'])assert.equal(await page.locator(selector).isVisible(),false);
  for(const selector of ['#home','#history','#logo','#search','ytd-search','#related','#account-subscribe'])assert.equal(await page.locator(selector).isVisible(),true);
  assert.equal(await page.evaluate(()=>accountChanges),0);assert.equal(await page.locator('#video').evaluate(e=>e.style.display),'');
  await page.fill('#search','query');assert.equal(await page.inputValue('#search'),'query');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal(await page.locator('ytd-browse[page-subtype="subscriptions"]').evaluate(e=>e.style.display),'grid');
});

test('home/search/watch hide subscription entry but never stale list or home/feed/video',async t=>{
  for(const url of ['https://www.youtube.com/','https://www.youtube.com/results?search_query=x','https://www.youtube.com/watch?v=x']){
    const page=await fixture(t,{url});const result=await page.evaluate(()=>session.start());assert.equal(result.eligible_target_count,2);
    assert.equal(await page.locator('ytd-browse[page-subtype="subscriptions"]').isVisible(),true);
    assert.equal(await page.locator('ytd-browse[page-subtype="home"]').isVisible(),true);
    assert.equal(await page.locator('#home').isVisible(),true);await page.evaluate(()=>session.release());
  }
});

test('home/subscription options with same binding coexist and release independently',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/'});
  const result=await page.evaluate(async()=>{
    const{HomeSession}=await import('/content/home.mjs');const home=new HomeSession(document,settings);
    home.start();session.start();session.release();
    const subscriptionsRestored=document.querySelector('#subscriptions').style.display==='';
    const homeStillHidden=document.querySelector('#home').style.display==='none';home.release();return{subscriptionsRestored,homeStillHidden,remaining:ledger.inspect().remaining_targets};
  });assert.equal(result.subscriptionsRestored,true);assert.equal(result.homeStillHidden,true);assert.equal(result.remaining,0);
});

test('shared owners and retired objects cannot release an active replacement',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();let duplicate='';try{make(settings).start();}catch(error){duplicate=error.message;}
    const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();
    const shared=document.querySelector('#subscriptions').style.display;other.release();
    const next=make(settings);next.start();session.release();const replacement=document.querySelector('#subscriptions').style.display;next.release();return{duplicate,shared,replacement};
  });assert.equal(result.duplicate,'SUBSCRIPTIONS_SCOPE_ALREADY_ACTIVE');assert.equal(result.shared,'none');assert.equal(result.replacement,'none');
});

test('late entries and list are restricted without self-loop; href/subtype exit restores only own resources',async t=>{
  const page=await fixture(t,{body:'<main></main>'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<ytd-browse page-subtype="subscriptions-feed">list</ytd-browse><ytd-guide-entry-renderer><a href="/feed/subscriptions">entry</a></ytd-guide-entry-renderer>'));
  await page.waitForFunction(()=>observations.at(-1).restricted_target_count===2);
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);
  await page.evaluate(()=>{const e=document.querySelector('ytd-browse');ledger.hide('other',e);e.setAttribute('page-subtype','history');document.querySelector('a').href='/feed/history';});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await page.locator('ytd-guide-entry-renderer').isVisible(),true);assert.equal(await page.locator('ytd-browse').isVisible(),false);
  await page.evaluate(()=>ledger.release('other'));assert.equal(await page.locator('ytd-browse').isVisible(),true);
});

test('page edits are preserved and partial cleanup keeps original goal and replacement fence',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    session.start();const entry=document.querySelector('#subscriptions');entry.style.display='flex';entry.inert=false;session.scan();
    const list=document.querySelector('ytd-browse[page-subtype="subscriptions"]'),write=list.style.setProperty.bind(list.style);
    list.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{make(settings).start();}catch(error){blocked=error.message;}
    list.style.setProperty=write;const retried=session.release();return{failed,blocked,retried,listDisplay:list.style.display,entryDisplay:entry.style.display};
  });assert.equal(result.failed.restored,false);assert.equal(result.failed.remaining_targets,1);assert.equal(result.blocked,'SUBSCRIPTIONS_SCOPE_ALREADY_ACTIVE');assert.equal(result.retried.restored,true);assert.equal(result.listDisplay,'grid');assert.equal(result.entryDisplay,'flex');
});

test('adopted node retains old cleanup obligation and new document protection',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const e=document.querySelector('#subscriptions'),f=document.createElement('iframe');document.body.append(f);const doc=f.contentDocument;doc.body.append(doc.adoptNode(e));
    const next=new ledger.constructor(doc);next.hide('new',e);const scan=session.scan(),cleanup=session.release();return{scan,cleanup,display:e.style.display,inert:e.inert};
  });assert.equal(result.scan.status,'FAILED');assert.equal(result.cleanup.restored,false);assert.equal(result.display,'none');assert.equal(result.inert,true);
});

test('SPA and simulated BFCache close stale scope; unsupported host rejected before effects',async t=>{
  for(const kind of ['spa','pagehide']){
    const page=await fixture(t);await page.evaluate(()=>session.start());
    await page.evaluate(kind=>{if(kind==='spa'){history.pushState({},'','/watch?v=next');dispatchEvent(new Event('yt-navigate-finish'));}else{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}},kind);
    await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>session.scan()),null);assert.equal((await page.evaluate(()=>session.release())).restored,true);
  }
  const page=await fixture(t,{url:'https://youtube.com.evil.test/feed/subscriptions'});
  assert.equal(await page.evaluate(()=>{try{session.start();}catch(error){return error.message;}}),'UNSUPPORTED_SUBSCRIPTIONS_DOCUMENT');assert.equal(await page.locator('#subscriptions').isVisible(),true);
});

test('TEST popup validates sender and preserves home restriction when subscriptions release',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/'});
  await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;listener({type:'TEST_SUBSCRIPTIONS_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));await send('TEST_HOME_APPLY');const applied=await send('TEST_SUBSCRIPTIONS_APPLY'),released=await send('TEST_SUBSCRIPTIONS_RELEASE');
    const homeStillHidden=document.querySelector('#home').style.display==='none';await send('TEST_HOME_RELEASE');return{leaked,applied,released,homeStillHidden,accountChanges};
  });assert.equal(result.leaked,false);assert.equal(result.applied.result.feature_id,'YT-05');assert.equal(result.applied.coreConnected,false);assert.equal(result.released.released.restored,true);assert.equal(result.homeStillHidden,true);assert.equal(result.accountChanges,0);
});
