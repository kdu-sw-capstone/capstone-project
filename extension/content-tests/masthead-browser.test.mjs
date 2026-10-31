import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const bar='<ytd-masthead style="display:flex"><a id="logo" href="/">YouTube</a><input id="search" value="keep query"><button id="account">account</button></ytd-masthead>';
const html=bar+'<ytd-guide-entry-renderer id="subscriptions"><a href="/feed/subscriptions">subscriptions</a></ytd-guide-entry-renderer>'
  +'<ytd-browse page-subtype="home">home list</ytd-browse><ytd-search>search results</ytd-search>'
  +'<ytd-watch-flexy><video id="video"></video><button id="play">play</button><div id="captions">captions</div></ytd-watch-flexy>'
  +'<aside data-focurve-ui><button id="exit">FOCURVE exit</button></aside>';
async function fixture(t,{body=html,url='https://www.youtube.com/watch?v=x'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body});
  });const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs'),{MastheadSession}=await import('/content/masthead.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=options=>new MastheadSession(document,options);window.session=make(settings);
  });return page;
}

test('YT-07 hides masthead including search while preserving content, media state and exit UI',async t=>{
  for(const path of ['/','/results?search_query=x','/watch?v=x','/feed/subscriptions','/shorts/x','/@ordinary/videos']){
    const page=await fixture(t,{url:'https://www.youtube.com'+path});
    const before=await page.locator('#video').evaluate(e=>({paused:e.paused,muted:e.muted,volume:e.volume,currentTime:e.currentTime}));
    const result=await page.evaluate(()=>session.start());
    assert.equal(result.feature_id,'YT-07');assert.equal(result.status,'OBSERVED');assert.equal(result.native_verified,false);assert.equal(result.restricted_target_count,1);
    assert.equal(await page.locator('ytd-masthead').isVisible(),false);assert.equal(await page.locator('ytd-masthead').evaluate(e=>e.inert),true);
    for(const selector of ['#search','#logo','#account'])assert.equal(await page.locator(selector).isVisible(),false);
    for(const selector of ['#subscriptions','ytd-browse','ytd-search','#play','#captions','#exit'])assert.equal(await page.locator(selector).isVisible(),true);
    assert.deepEqual(await page.locator('#video').evaluate(e=>({paused:e.paused,muted:e.muted,volume:e.volume,currentTime:e.currentTime})),before);
    assert.equal((await page.evaluate(()=>session.release())).restored,true);
    assert.equal(await page.locator('ytd-masthead').evaluate(e=>e.style.display),'flex');assert.equal(await page.locator('ytd-masthead').evaluate(e=>e.inert),false);
    assert.equal(await page.inputValue('#search'),'keep query');await page.fill('#search','restored search');assert.equal(await page.inputValue('#search'),'restored search');
  }
});

test('late and replaced mastheads are observed without looping; removed footprints restore',async t=>{
  const page=await fixture(t,{body:'<main>content</main>'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(bar=>document.body.insertAdjacentHTML('afterbegin',bar),bar);
  await page.waitForFunction(()=>observations.at(-1).restricted_target_count===1);
  await page.evaluate(bar=>{window.old=document.querySelector('ytd-masthead');old.remove();document.body.insertAdjacentHTML('afterbegin',bar);},bar);
  await page.waitForFunction(()=>old.style.display==='flex'&&document.querySelector('ytd-masthead').style.display==='none');
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('ytd-masthead').isVisible(),true);
});

test('multiple owners, duplicate scope and retired cleanup cannot release an active replacement',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();let duplicate='';try{make(settings).start();}catch(error){duplicate=error.message;}
    const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();
    const shared=document.querySelector('ytd-masthead').style.display;other.release();
    const next=make(settings);next.start();session.release();const replacement=document.querySelector('ytd-masthead').style.display;next.release();return{duplicate,shared,replacement};
  });assert.equal(result.duplicate,'MASTHEAD_SCOPE_ALREADY_ACTIVE');assert.equal(result.shared,'none');assert.equal(result.replacement,'none');
});

test('home logo claim survives independent masthead release',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/'});
  await page.evaluate(async()=>{const{HomeSession}=await import('/content/home.mjs');window.home=new HomeSession(document,settings);home.start();session.start();session.release();});
  assert.equal(await page.locator('#search').isVisible(),true);assert.equal(await page.locator('#logo').isVisible(),false);assert.equal(await page.locator('ytd-browse').isVisible(),false);
  await page.evaluate(()=>home.release());assert.equal(await page.locator('#logo').isVisible(),true);assert.equal(await page.locator('ytd-browse').isVisible(),true);
});

test('page style edits survive cleanup; partial restoration keeps its original target and scope fence',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const node=document.querySelector('ytd-masthead');node.style.display='grid';session.scan();
    const write=node.style.setProperty.bind(node.style);node.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{make(settings).start();}catch(error){blocked=error.message;}
    node.style.setProperty=write;const retried=session.release();return{failed,blocked,retried,display:node.style.display};
  });assert.equal(result.failed.restored,false);assert.equal(result.blocked,'MASTHEAD_SCOPE_ALREADY_ACTIVE');assert.equal(result.retried.restored,true);assert.equal(result.display,'grid');
});

test('FOCURVE UI is protected even when inserted inside an already restricted masthead',async t=>{
  const page=await fixture(t);await page.evaluate(()=>session.start());
  await page.evaluate(async()=>{const{createShortsNotice}=await import('/ui/restriction.mjs');document.querySelector('ytd-masthead').append(createShortsNotice(document));});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await page.locator('ytd-masthead').isVisible(),true);assert.equal(await page.locator('[data-focurve-restriction]').isVisible(),true);
  await page.evaluate(()=>document.querySelector('[data-focurve-restriction]').remove());
  await page.waitForFunction(()=>document.querySelector('ytd-masthead').style.display==='none');assert.equal((await page.evaluate(()=>session.release())).restored,true);
  await page.evaluate(()=>document.querySelector('ytd-masthead').setAttribute('data-focurve-ui',''));
  await page.evaluate(()=>{session=make(settings);session.start();});assert.equal(await page.locator('ytd-masthead').isVisible(),true);
});

test('SPA needs explicit reauthorization and preserves content; BFCache does not silently resume',async t=>{
  const page=await fixture(t);
  await page.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();});
  for(const path of ['/results?search_query=x','/feed/subscriptions','/watch?v=next']){
    await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new Event('yt-navigate-finish'));},path);
    await page.waitForFunction(()=>document.querySelector('ytd-masthead').style.display==='none');
    assert.equal(await page.locator('#play').isVisible(),true);assert.equal(await page.locator('ytd-search').isVisible(),true);
  }
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
  assert.equal(await page.evaluate(()=>invalidations.at(-1).reason),'PAGEHIDE');
  await page.evaluate(bar=>document.querySelector('ytd-masthead').outerHTML=bar,bar);
  assert.equal(await page.evaluate(()=>session.scan()),null);assert.equal(await page.locator('ytd-masthead').isVisible(),true);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
});

test('missing or rejected SPA authorization restores old claims without granting new effects',async t=>{
  for(const authorize of ['missing','false','throw','promise']){
    const page=await fixture(t);await page.evaluate(authorize=>{
      const options={...settings};if(authorize!=='missing')options.authorizeNavigation=()=>{if(authorize==='throw')throw Error('denied');return authorize==='promise'?Promise.resolve(true):false;};
      session=make(options);session.start();history.pushState({},'','/results?search_query=next');dispatchEvent(new Event('yt-navigate-finish'));
    },authorize);
    await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.locator('ytd-masthead').isVisible(),true);assert.equal(await page.evaluate(()=>session.scan()),null);
    assert.equal((await page.evaluate(()=>session.release())).restored,true);
  }
});

test('SPA cleanup failure blocks new effects and allows exact restoration retry',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{
    session=make({...settings,authorizeNavigation:()=>true});session.start();const node=document.querySelector('ytd-masthead'),write=node.style.setProperty.bind(node.style);window.undo=()=>{node.style.setProperty=write;};
    node.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='flex'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    history.pushState({},'','/results?search_query=next');dispatchEvent(new Event('yt-navigate-finish'));
  });
  await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>invalidations[0].reason),'ROUTE_CLEANUP_FAILED');
  assert.equal(await page.evaluate(()=>session.scan()),null);await page.evaluate(()=>undo());assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal(await page.locator('ytd-masthead').evaluate(e=>e.style.display),'flex');
});

test('adopted masthead keeps foreign owner protection and old cleanup debt',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const node=document.querySelector('ytd-masthead'),frame=document.createElement('iframe');document.body.append(frame);const doc=frame.contentDocument;doc.body.append(doc.adoptNode(node));
    const next=new ledger.constructor(doc);next.hide('new-owner',node);return{scan:session.scan(),released:session.release(),display:node.style.display,inert:node.inert};
  });assert.equal(result.scan.status,'FAILED');assert.equal(result.released.restored,false);assert.equal(result.display,'none');assert.equal(result.inert,true);
});

test('unsupported documents and subframes never restrict a masthead',async t=>{
  for(const url of ['http://www.youtube.com/','https://youtube.com.evil.test/','https://www.youtube.com/account']){
    const page=await fixture(t,{url});assert.equal(await page.evaluate(()=>{try{session.start();}catch(error){return error.message;}}),'UNSUPPORTED_MASTHEAD_DOCUMENT');
    assert.equal(await page.locator('ytd-masthead').isVisible(),true);
  }
  const page=await fixture(t);const error=await page.evaluate(()=>{const f=document.createElement('iframe');document.body.append(f);return import('/content/masthead.mjs').then(({MastheadSession})=>{try{new MastheadSession(f.contentDocument,{...settings,ledger:new ledger.constructor(f.contentDocument)}).start();}catch(e){return e.message;}});});
  assert.equal(error,'UNSUPPORTED_MASTHEAD_DOCUMENT');
});

test('TEST popup validates sender and masthead release preserves home claims',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/'});
  await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;
    listener({type:'TEST_MASTHEAD_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    listener({type:'TEST_MASTHEAD_APPLY'},{...sender,id:'other-extension'},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));await send('TEST_HOME_APPLY');const applied=await send('TEST_MASTHEAD_APPLY');
    const released=await send('TEST_MASTHEAD_RELEASE');const state={bar:document.querySelector('ytd-masthead').style.display,logo:document.querySelector('#logo').style.display};
    await send('TEST_HOME_RELEASE');return{leaked,applied,released,state};
  });assert.equal(result.leaked,false);assert.equal(result.applied.result.feature_id,'YT-07');assert.equal(result.applied.coreConnected,false);assert.equal(result.released.released.restored,true);
  assert.deepEqual(result.state,{bar:'flex',logo:'none'});
});
