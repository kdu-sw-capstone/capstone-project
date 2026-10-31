import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<ytd-masthead><a id="logo" href="/">logo</a><form><input id="search"><button id="search-button">search</button></form></ytd-masthead>'
  +'<ytd-guide-entry-renderer id="home-entry"><a href="/">home</a></ytd-guide-entry-renderer><ytd-mini-guide-entry-renderer id="mini"><a href="https://www.youtube.com/">home</a></ytd-mini-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="subscriptions"><a href="/feed/subscriptions">subscriptions</a></ytd-guide-entry-renderer>'
  +'<ytd-browse page-subtype="home" style="display:grid">home feed</ytd-browse><ytd-search>results</ytd-search><ytd-watch-flexy><video id="video"></video><div id="related">related</div></ytd-watch-flexy>';
async function fixture(t,{body=html,url='https://www.youtube.com/'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body});
  });
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');const{HomeSession}=await import('/content/home.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:value=>observations.push(value),onInvalidated:value=>invalidations.push(value)};
    window.make=options=>new HomeSession(document,options);window.session=make(settings);
  });return page;
}

test('YT-01 hides home feed/entries/logo but preserves search, subscriptions and video controls',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>session.start());
  assert.equal(result.feature_id,'YT-01');assert.equal(result.status,'OBSERVED');assert.equal(result.native_verified,false);
  assert.equal(result.eligible_target_count,4);assert.equal(result.restricted_target_count,4);
  for(const selector of ['ytd-browse','#home-entry','#mini','#logo'])assert.equal(await page.locator(selector).isVisible(),false);
  for(const selector of ['#search','#search-button','#subscriptions','ytd-search','#related'])assert.equal(await page.locator(selector).isVisible(),true);
  assert.equal(await page.locator('#video').evaluate(e=>e.style.display),'');
  await page.fill('#search','query');assert.equal(await page.inputValue('#search'),'query');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal(await page.locator('ytd-browse').evaluate(e=>e.style.display),'grid');
  assert.equal(await page.locator('#home-entry').isVisible(),true);
});

test('search/watch pages keep stale home trees, actual results and current player',async t=>{
  for(const url of ['https://www.youtube.com/results?search_query=x','https://www.youtube.com/watch?v=x']){
    const page=await fixture(t,{url});const result=await page.evaluate(()=>session.start());
    assert.equal(result.eligible_target_count,3);assert.equal(await page.locator('ytd-browse').isVisible(),true);
    assert.equal(await page.locator('ytd-search').isVisible(),true);assert.equal(await page.locator('#related').isVisible(),true);
    await page.evaluate(()=>session.release());
  }
});

test('shared owners preserve last restriction, duplicate scope is fenced and retired release cannot touch successor',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    session.start();let rejected='';try{make(settings).start();}catch(error){rejected=error.message;}
    const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();
    const shared=document.querySelector('ytd-browse').style.display;other.release();
    const successor=make(settings);successor.start();session.release();const next=document.querySelector('ytd-browse').style.display;successor.release();return{rejected,shared,next};
  });
  assert.equal(result.rejected,'HOME_SCOPE_ALREADY_ACTIVE');assert.equal(result.shared,'none');assert.equal(result.next,'none');
});

test('late home targets restrict without self-loop; href/subtype changes release only this claim',async t=>{
  const page=await fixture(t,{body:'<main></main>'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<ytd-browse page-subtype="home">feed</ytd-browse><ytd-guide-entry-renderer><a href="/">entry</a></ytd-guide-entry-renderer>'));
  await page.waitForFunction(()=>observations.at(-1).restricted_target_count===2);
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);
  await page.evaluate(()=>{const e=document.querySelector('ytd-browse');ledger.hide('other',e);e.setAttribute('page-subtype','subscriptions');document.querySelector('a').href='/feed/subscriptions';});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await page.locator('ytd-guide-entry-renderer').isVisible(),true);
  assert.equal(await page.locator('ytd-browse').isVisible(),false);
  await page.evaluate(()=>ledger.release('other'));assert.equal(await page.locator('ytd-browse').isVisible(),true);
});

test('page style edits survive observer reapply and cleanup',async t=>{
  const page=await fixture(t);await page.evaluate(()=>session.start());
  await page.evaluate(()=>{const e=document.querySelector('ytd-browse');e.style.display='flex';e.inert=false;});
  await page.waitForFunction(()=>document.querySelector('ytd-browse').style.display==='none');
  await page.evaluate(()=>session.release());assert.equal(await page.locator('ytd-browse').evaluate(e=>e.style.display),'flex');
});

test('restore partial failure retains target and blocks successor until exact retry',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    session.start();const e=document.querySelector('ytd-browse'),write=e.style.setProperty.bind(e.style);
    e.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    e.setAttribute('page-subtype','other');const scan=session.scan(),failed=session.release();let blocked='';try{make(settings).start();}catch(error){blocked=error.message;}
    e.style.setProperty=write;const retry=session.release();return{scan,failed,blocked,retry,display:e.style.display};
  });
  assert.equal(result.scan.status,'FAILED');assert.equal(result.failed.restored,false);assert.equal(result.failed.remaining_targets,1);
  assert.equal(result.blocked,'HOME_SCOPE_ALREADY_ACTIVE');assert.equal(result.retry.restored,true);assert.equal(result.display,'grid');
});

test('foreign-document adoption preserves old debt and never removes new owner restriction',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{
    session.start();const e=document.querySelector('ytd-browse'),f=document.createElement('iframe');document.body.append(f);const doc=f.contentDocument;doc.body.append(doc.adoptNode(e));
    const next=new ledger.constructor(doc);next.hide('new',e);const scan=session.scan(),cleanup=session.release();return{scan,cleanup,display:e.style.display,inert:e.inert};
  });
  assert.equal(result.scan.status,'FAILED');assert.equal(result.cleanup.restored,false);assert.equal(result.display,'none');assert.equal(result.inert,true);
});

test('URL/pagehide closes stale scope and unsupported hosts never hide a home-looking link',async t=>{
  for(const kind of ['spa','pagehide']){
    const page=await fixture(t);await page.evaluate(()=>session.start());
    await page.evaluate(kind=>{if(kind==='spa'){history.pushState({},'','/results?search_query=x');dispatchEvent(new Event('yt-navigate-finish'));}else{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));}},kind);
    await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>session.scan()),null);
    assert.equal((await page.evaluate(()=>session.release())).restored,true);
  }
  const page=await fixture(t,{url:'https://youtube.com.evil.test/'});
  assert.equal(await page.evaluate(()=>{try{session.start();}catch(error){return error.message;}}),'UNSUPPORTED_HOME_DOCUMENT');
  assert.equal(await page.locator('ytd-browse').isVisible(),true);
});

test('TEST popup exercises actual home adapter and rejects page sender',async t=>{
  const page=await fixture(t);
  await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;
    listener({type:'TEST_HOME_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    const applied=await send('TEST_HOME_APPLY'),released=await send('TEST_HOME_RELEASE');return{leaked,applied,released};
  });
  assert.equal(result.leaked,false);assert.equal(result.applied.result.status,'OBSERVED');assert.equal(result.applied.coreConnected,false);assert.equal(result.released.released.restored,true);
});
