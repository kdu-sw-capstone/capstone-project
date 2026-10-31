import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<ytd-masthead><input id="search"></ytd-masthead><ytd-guide-section-renderer>'
  +'<ytd-guide-entry-renderer id="explore"><a href="/feed/explore">explore</a></ytd-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="trending"><a href="https://www.youtube.com/feed/trending">trending</a></ytd-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="home"><a href="/">home</a></ytd-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="subs"><a href="/feed/subscriptions">subscriptions</a></ytd-guide-entry-renderer>'
  +'<ytd-guide-entry-renderer id="foreign"><a href="https://youtube.com.evil.test/feed/explore">foreign</a></ytd-guide-entry-renderer>'
  +'</ytd-guide-section-renderer><ytd-browse page-subtype="trending" style="display:grid">list</ytd-browse><ytd-browse page-subtype="home">home feed</ytd-browse><ytd-search>results</ytd-search><ytd-watch-flexy><video id="video"></video><div id="related">related</div></ytd-watch-flexy>';
async function fixture(t,{body=html,url='https://www.youtube.com/feed/trending'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body});
  });const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');const{ExploreSession}=await import('/content/explore.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:value=>observations.push(value),onInvalidated:value=>invalidations.push(value)};
    window.make=options=>new ExploreSession(document,options);window.session=make(settings);
  });return page;
}

test('YT-06 restricts explore/trending entries and current list, preserving unrelated menus and media',async t=>{
  for(const path of ['/feed/explore','/feed/trending']){
    const page=await fixture(t,{url:'https://www.youtube.com'+path,body:html.replaceAll('page-subtype="trending"','page-subtype="'+path.split('/').at(-1)+'"')});const result=await page.evaluate(()=>session.start());
    assert.equal(result.feature_id,'YT-06');assert.equal(result.status,'OBSERVED');assert.equal(result.native_verified,false);assert.equal(result.restricted_target_count,3);
    for(const selector of ['#explore','#trending','ytd-browse:first-of-type'])assert.equal(await page.locator(selector).isVisible(),false);
    for(const selector of ['#search','#home','#subs','#foreign','ytd-search','#related'])assert.equal(await page.locator(selector).isVisible(),true);
    assert.equal(await page.locator('#video').evaluate(e=>e.style.display),'');
    await page.fill('#search','query');assert.equal(await page.inputValue('#search'),'query');
    assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('ytd-browse').first().evaluate(e=>e.style.display),'grid');
  }
});

test('home/search/watch/subscriptions never hide a stale explore tree or current content',async t=>{
  for(const path of ['/','/results?search_query=x','/watch?v=x','/feed/subscriptions']){
    const page=await fixture(t,{url:'https://www.youtube.com'+path});assert.equal((await page.evaluate(()=>session.start())).eligible_target_count,2);
    assert.equal(await page.locator('ytd-browse[page-subtype="trending"]').isVisible(),true);assert.equal(await page.locator('#related').isVisible(),true);
  }
});

test('shared owners, duplicate scope and retired release are isolated',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();let duplicate='';try{make(settings).start();}catch(error){duplicate=error.message;}
    const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();const shared=document.querySelector('#explore').style.display;
    other.release();const next=make(settings);next.start();session.release();const replacement=document.querySelector('#explore').style.display;next.release();return{duplicate,shared,replacement};
  });assert.equal(result.duplicate,'EXPLORE_SCOPE_ALREADY_ACTIVE');assert.equal(result.shared,'none');assert.equal(result.replacement,'none');
});

test('late targets are observed and reused hrefs restore only the departing claim',async t=>{
  const page=await fixture(t,{body:'<main></main>',url:'https://www.youtube.com/'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<ytd-guide-entry-renderer id="late"><a href="/feed/trending">late</a></ytd-guide-entry-renderer>'));
  await page.waitForFunction(()=>observations.at(-1).restricted_target_count===1);
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);
  await page.evaluate(()=>{ledger.hide('other',document.querySelector('#late'));document.querySelector('#late a').href='/feed/history';});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');assert.equal(await page.locator('#late').isVisible(),false);
  await page.evaluate(()=>ledger.release('other'));assert.equal(await page.locator('#late').isVisible(),true);
});

test('partial restore failure and page edits retain correct original goals',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const entry=document.querySelector('#explore');entry.style.display='flex';session.scan();
    const list=document.querySelector('ytd-browse[page-subtype="trending"]'),write=list.style.setProperty.bind(list.style);
    list.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{make(settings).start();}catch(error){blocked=error.message;}
    list.style.setProperty=write;const retried=session.release();return{failed,blocked,retried,list:list.style.display,entry:entry.style.display};
  });assert.equal(result.failed.restored,false);assert.equal(result.blocked,'EXPLORE_SCOPE_ALREADY_ACTIVE');assert.equal(result.retried.restored,true);assert.equal(result.list,'grid');assert.equal(result.entry,'flex');
});

test('foreign document keeps new owner protection and unresolved prior cleanup',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const e=document.querySelector('#explore'),f=document.createElement('iframe');document.body.append(f);const doc=f.contentDocument;doc.body.append(doc.adoptNode(e));
    const next=new ledger.constructor(doc);next.hide('new',e);return{scan:session.scan(),cleanup:session.release(),display:e.style.display,inert:e.inert};
  });assert.equal(result.scan.status,'FAILED');assert.equal(result.cleanup.restored,false);assert.equal(result.display,'none');assert.equal(result.inert,true);
});

test('SPA/pagehide require reauthorization; unknown route and host are not success',async t=>{
  for(const kind of ['spa','pagehide']){
    const page=await fixture(t);await page.evaluate(()=>session.start());
    await page.evaluate(kind=>{if(kind==='spa'){history.pushState({},'','/watch?v=next');dispatchEvent(new Event('yt-navigate-finish'));}else{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}},kind);
    await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>session.scan()),null);assert.equal((await page.evaluate(()=>session.release())).restored,true);
  }
  for(const url of ['https://youtube.com.evil.test/feed/explore','https://www.youtube.com/shorts/x']){
    const page=await fixture(t,{url});assert.equal(await page.evaluate(()=>{try{session.start();}catch(error){return error.message;}}),'UNSUPPORTED_EXPLORE_DOCUMENT');
    assert.equal(await page.locator('#explore').isVisible(),true);
  }
});

test('TEST popup preserves home/subscription restrictions when explore alone releases',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/'});
  await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;listener({type:'TEST_EXPLORE_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));await send('TEST_HOME_APPLY');await send('TEST_SUBSCRIPTIONS_APPLY');
    const applied=await send('TEST_EXPLORE_APPLY'),released=await send('TEST_EXPLORE_RELEASE');
    const preserved={home:document.querySelector('#home').style.display,subscriptions:document.querySelector('#subs').style.display};
    await send('TEST_HOME_RELEASE');await send('TEST_SUBSCRIPTIONS_RELEASE');return{leaked,applied,released,preserved};
  });assert.equal(result.leaked,false);assert.equal(result.applied.result.feature_id,'YT-06');assert.equal(result.applied.coreConnected,false);assert.equal(result.released.released.restored,true);assert.deepEqual(result.preserved,{home:'none',subscriptions:'none'});
});

test('current music/live/movie destinations restrict exact menus and lists',async t=>{
  const routes=[['/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ','channels'],['/channel/UC4R8DWoMoI7CAwX8_LjQHig','channels'],['/feed/storefront?bp=ogUCKAU%3D','storefront']];
  const menu=routes.map(([href],i)=>`<ytd-guide-entry-renderer id="category${i}"><a href="${href}">category</a></ytd-guide-entry-renderer>`).join('');
  for(const[path,subtype]of routes){
    const page=await fixture(t,{url:'https://www.youtube.com'+path,body:menu+`<ytd-browse page-subtype="${subtype}" browse-id="${path.split('/')[2]}" style="display:grid">list</ytd-browse><a id="external" href="https://music.youtube.com/">service</a><input id="search">`});
    assert.equal((await page.evaluate(()=>session.start())).restricted_target_count,4);
    assert.equal(await page.locator('ytd-browse').isVisible(),false);assert.equal(await page.locator('#external').isVisible(),true);assert.equal(await page.locator('#search').isVisible(),true);
    assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('ytd-browse').isVisible(),true);
  }
});
test('unrelated channels, storefront payloads and external services remain visible',async t=>{
  const links=['/channel/ordinary','/feed/storefront?bp=other','https://music.youtube.com/','https://youtube.com.evil.test/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ'];
  const page=await fixture(t,{url:'https://www.youtube.com/',body:links.map(href=>`<ytd-guide-entry-renderer><a href="${href}">keep</a></ytd-guide-entry-renderer>`).join('')});
  assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  for(const node of await page.locator('ytd-guide-entry-renderer').all())assert.equal(await node.isVisible(),true);
});

test('authorized SPA transitions clean old list and preserve search/watch/subscriptions',async t=>{
  const path='/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ';
  const page=await fixture(t,{url:'https://www.youtube.com'+path,body:html+'<ytd-browse id="music-list" page-subtype="channels" browse-id="UC-9-kyTW8ZkZNDHQJ6FgpwQ">music</ytd-browse><ytd-browse id="stale-channel" page-subtype="channels" browse-id="ordinary">keep</ytd-browse>'});
  await page.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();});
  assert.equal(await page.locator('#music-list').isVisible(),false);assert.equal(await page.locator('#stale-channel').isVisible(),true);
  for(const url of ['/results?search_query=x','/watch?v=x','/feed/subscriptions','/']){
    await page.evaluate(url=>{history.pushState({},'',url);dispatchEvent(new Event('yt-navigate-finish'));},url);
    await page.waitForFunction(()=>document.querySelector('#music-list').style.display!=='none');
    assert.equal(await page.locator('#search').isVisible(),true);assert.equal(await page.locator('#subs').isVisible(),true);assert.equal(await page.locator('#related').isVisible(),true);
    assert.equal(await page.evaluate(()=>invalidations.length),0);
  }
  await page.evaluate(path=>{history.pushState({},'',path);dispatchEvent(new Event('yt-navigate-finish'));},path);
  await page.waitForFunction(()=>document.querySelector('#music-list').style.display==='none');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#music-list').isVisible(),true);
});

test('SPA cleanup failure stops new effects and retains original restore obligation',async t=>{
  const page=await fixture(t);
  await page.evaluate(()=>{
    session=make({...settings,authorizeNavigation:()=>true});session.start();
    const list=document.querySelector('ytd-browse'),write=list.style.setProperty.bind(list.style);window.undo=()=>{list.style.setProperty=write;};
    list.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    history.pushState({},'','/watch?v=next');dispatchEvent(new Event('yt-navigate-finish'));
  });
  await page.waitForFunction(()=>invalidations.length===1);
  assert.equal(await page.evaluate(()=>invalidations[0].reason),'ROUTE_CLEANUP_FAILED');assert.equal(await page.evaluate(()=>session.scan()),null);
  assert.equal((await page.evaluate(()=>session.release())).restored,false);
  await page.evaluate(()=>undo());assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal(await page.locator('ytd-browse').first().evaluate(e=>e.style.display),'grid');
});

test('denied SPA authorization cleans old effect but never applies new route',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>false});session.start();history.pushState({},'','/feed/explore');dispatchEvent(new Event('yt-navigate-finish'));});
  await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.locator('#explore').isVisible(),true);assert.equal(await page.evaluate(()=>session.scan()),null);
});

test('reused channel DOM restores old claim until exact browse identity matches',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ',body:'<ytd-browse page-subtype="channels" browse-id="ordinary">ordinary</ytd-browse>'});
  await page.evaluate(()=>session.start());assert.equal(await page.locator('ytd-browse').isVisible(),true);
  await page.evaluate(()=>document.querySelector('ytd-browse').setAttribute('browse-id','UC-9-kyTW8ZkZNDHQJ6FgpwQ'));
  await page.waitForFunction(()=>document.querySelector('ytd-browse').style.display==='none');
  await page.evaluate(()=>document.querySelector('ytd-browse').setAttribute('browse-id','ordinary'));
  await page.waitForFunction(()=>document.querySelector('ytd-browse').style.display!=='none');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
