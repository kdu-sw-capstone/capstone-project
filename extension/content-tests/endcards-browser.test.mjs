import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const cards='<a id="timed" class="ytp-ce-element" style="display:flex" href="/watch?v=two"><span class="ytp-suggestion-link">end card</span></a><a id="tile" class="ytp-videowall-still" href="/watch?v=two">final grid</a>';
const html='<ytd-masthead><input id="search"></ytd-masthead><ytd-watch-flexy video-id="one"><div id="movie_player">'
  +'<video id="video"></video><div class="ytp-chrome-bottom"><button id="play">play</button><button id="replay">replay</button><button class="ytp-autonav-toggle-button" aria-checked="true">autoplay</button></div>'
  +'<div class="ytp-caption-window-container" id="captions">captions</div>'+cards+'</div><div id="related"><a class="ytp-suggestion-link">right recommendation</a></div></ytd-watch-flexy><main id="description">description</main><aside data-focurve-ui><button id="exit">exit</button></aside>';
async function fixture(t,{body=html,url='https://www.youtube.com/watch?v=one'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/(content\/[a-z-]+\.mjs|ui\/restriction\.mjs)$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body});
  });const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs'),{EndCardsSession}=await import('/content/endcards.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=options=>new EndCardsSession(document,options);window.session=make(settings);
  });return page;
}

test('YT-08 hides timed/final cards only and restores original footprint without media/autoplay mutation',async t=>{
  const page=await fixture(t);const before=await page.locator('#video').evaluate(e=>({paused:e.paused,muted:e.muted,volume:e.volume,currentTime:e.currentTime}));
  const result=await page.evaluate(()=>session.start());assert.equal(result.feature_id,'YT-08');assert.equal(result.status,'OBSERVED');assert.equal(result.native_verified,false);assert.equal(result.restricted_target_count,2);
  for(const selector of ['#timed','#tile']){assert.equal(await page.locator(selector).isVisible(),false);assert.equal(await page.locator(selector).evaluate(e=>e.inert),true);}
  for(const selector of ['#search','#play','#replay','#captions','#related','#description','#exit'])assert.equal(await page.locator(selector).isVisible(),true);
  assert.equal(await page.locator('.ytp-autonav-toggle-button').getAttribute('aria-checked'),'true');
  assert.deepEqual(await page.locator('#video').evaluate(e=>({paused:e.paused,muted:e.muted,volume:e.volume,currentTime:e.currentTime})),before);
  await page.evaluate(()=>{window.clicks=0;document.querySelector('#play').onclick=()=>{clicks++;};});await page.click('#play');assert.equal(await page.evaluate(()=>clicks),1);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#timed').evaluate(e=>e.style.display),'flex');assert.equal(await page.locator('#timed').evaluate(e=>e.inert),false);assert.equal(await page.locator('#tile').isVisible(),true);
});

test('late cards/replacement are observed, with no self-trigger loop and detached cleanup preserved',async t=>{
  const page=await fixture(t,{body:'<ytd-watch-flexy video-id="one"><div id="movie_player"></div></ytd-watch-flexy>'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(cards=>document.querySelector('#movie_player').insertAdjacentHTML('beforeend',cards),cards);
  await page.waitForFunction(()=>observations.at(-1).restricted_target_count===2);
  await page.evaluate(cards=>{window.old=document.querySelector('#timed');document.querySelector('#movie_player').innerHTML=cards;},cards);
  await page.waitForFunction(()=>old.style.display==='flex'&&document.querySelector('#timed').style.display==='none');
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
});

test('selector exit removes own claim and preserves an independent owner',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session.start();ledger.hide('other',document.querySelector('#tile'));document.querySelector('#timed .ytp-suggestion-link').className='';document.querySelector('#timed').className='';document.querySelector('#tile').className='';});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');assert.equal(await page.locator('#timed').isVisible(),true);assert.equal(await page.locator('#tile').isVisible(),false);
  await page.evaluate(()=>ledger.release('other'));assert.equal(await page.locator('#tile').isVisible(),true);
});

test('multi-owner scope fencing and retired object cleanup preserve current restrictions',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();let duplicate='';try{make(settings).start();}catch(e){duplicate=e.message;}
    const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();const shared=document.querySelector('#timed').style.display;other.release();
    const next=make(settings);next.start();session.release();const replacement=document.querySelector('#timed').style.display;next.release();return{duplicate,shared,replacement};
  });assert.equal(result.duplicate,'ENDCARDS_SCOPE_ALREADY_ACTIVE');assert.equal(result.shared,'none');assert.equal(result.replacement,'none');
});

test('page edits and partial restore failures retain the correct retry goal',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const card=document.querySelector('#timed');card.style.display='grid';session.scan();const write=card.style.setProperty.bind(card.style);
    card.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{make(settings).start();}catch(e){blocked=e.message;}
    card.style.setProperty=write;const retried=session.release();return{failed,blocked,retried,display:card.style.display};
  });assert.equal(result.failed.restored,false);assert.equal(result.blocked,'ENDCARDS_SCOPE_ALREADY_ACTIVE');assert.equal(result.retried.restored,true);assert.equal(result.display,'grid');
});

test('stale/hidden watch players and lookalike cards outside the player stay untouched',async t=>{
  const body=html.replace('video-id="one"','video-id="old"')+'<ytd-watch-flexy hidden video-id="one"><div id="movie_player"><a id="hidden-card" class="ytp-ce-element">hidden tree</a></div></ytd-watch-flexy>';
  const page=await fixture(t,{body});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  assert.equal(await page.locator('#timed').isVisible(),true);assert.equal(await page.locator('#hidden-card').evaluate(e=>e.style.display),'');assert.equal(await page.locator('#related').isVisible(),true);
});

test('authorized video SPA waits for matching current player identity; leaving watch closes scope',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();history.pushState({},'','/watch?v=two');dispatchEvent(new Event('yt-navigate-finish'));});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');assert.equal(await page.locator('#timed').isVisible(),true);
  await page.evaluate(()=>document.querySelector('ytd-watch-flexy').setAttribute('video-id','two'));
  await page.waitForFunction(()=>document.querySelector('#timed').style.display==='none');
  await page.evaluate(()=>{history.pushState({},'','/');dispatchEvent(new Event('yt-navigate-finish'));});
  await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.locator('#timed').isVisible(),true);assert.equal(await page.evaluate(()=>session.scan()),null);assert.equal((await page.evaluate(()=>session.release())).restored,true);
});

test('missing navigation authorization and BFCache require explicit new scope',async t=>{
  for(const mode of ['spa','bfcache']){
    const page=await fixture(t);await page.evaluate(()=>session.start());
    await page.evaluate(mode=>{if(mode==='spa'){history.pushState({},'','/watch?v=two');dispatchEvent(new Event('yt-navigate-finish'));}else{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));}},mode);
    await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>session.scan()),null);assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#timed').isVisible(),true);
  }
});

test('SPA restore failure stops new card effects and preserves cleanup retry',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{
    session=make({...settings,authorizeNavigation:()=>true});session.start();const card=document.querySelector('#timed'),write=card.style.setProperty.bind(card.style);window.undo=()=>{card.style.setProperty=write;};
    card.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='flex'){write(name,'block');throw Error('partial');}write(name,value,priority);};
    history.pushState({},'','/watch?v=two');dispatchEvent(new Event('yt-navigate-finish'));
  });await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>invalidations[0].reason),'ROUTE_CLEANUP_FAILED');assert.equal(await page.evaluate(()=>session.scan()),null);
  await page.evaluate(()=>undo());assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#timed').evaluate(e=>e.style.display),'flex');
});

test('FOCURVE, media and captions inside a candidate card are never hidden by this adapter',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{document.querySelector('#timed').insertAdjacentHTML('beforeend','<span data-focurve-ui>exit</span>');document.querySelector('#tile').insertAdjacentHTML('beforeend','<div class="ytp-caption-window-container">captions</div>');});
  await page.evaluate(()=>session.start());assert.equal(await page.locator('#timed').isVisible(),true);assert.equal(await page.locator('#tile').isVisible(),true);
  await page.evaluate(()=>{document.querySelector('#timed [data-focurve-ui]').remove();});
  await page.waitForFunction(()=>document.querySelector('#timed').style.display==='none');
  await page.evaluate(()=>document.querySelector('#timed').setAttribute('data-focurve-ui',''));
  await page.waitForFunction(()=>document.querySelector('#timed').style.display!=='none');assert.equal((await page.evaluate(()=>session.release())).restored,true);
});

test('foreign document keeps new owner protection and unresolved old card restoration',async t=>{
  const page=await fixture(t);const result=await page.evaluate(()=>{
    session.start();const node=document.querySelector('#timed'),frame=document.createElement('iframe');document.body.append(frame);const doc=frame.contentDocument;doc.body.append(doc.adoptNode(node));
    const next=new ledger.constructor(doc);next.hide('other',node);return{scan:session.scan(),released:session.release(),display:node.style.display,inert:node.inert};
  });assert.equal(result.scan.status,'FAILED');assert.equal(result.released.restored,false);assert.equal(result.display,'none');assert.equal(result.inert,true);
});

test('only supported top-frame watch URLs can start',async t=>{
  for(const url of ['https://www.youtube.com/','https://www.youtube.com/shorts/one','https://www.youtube.com/watch','https://www.youtube.com/watch?v=one&v=two','http://www.youtube.com/watch?v=one','https://youtube.com.evil.test/watch?v=one']){
    const page=await fixture(t,{url});assert.equal(await page.evaluate(()=>{try{session.start();}catch(e){return e.message;}}),'UNSUPPORTED_ENDCARDS_DOCUMENT');assert.equal(await page.locator('#timed').isVisible(),true);
  }
  const page=await fixture(t);const error=await page.evaluate(async()=>{
    const frame=document.createElement('iframe');document.body.append(frame);const{EndCardsSession}=await import('/content/endcards.mjs');
    try{new EndCardsSession(frame.contentDocument,{...settings,ledger:new ledger.constructor(frame.contentDocument)}).start();}catch(e){return e.message;}
  });assert.equal(error,'UNSUPPORTED_ENDCARDS_DOCUMENT');
});

test('TEST popup validates sender and endcard release leaves masthead restriction intact',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;listener({type:'TEST_ENDCARDS_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));await send('TEST_MASTHEAD_APPLY');const applied=await send('TEST_ENDCARDS_APPLY'),released=await send('TEST_ENDCARDS_RELEASE');const bar=document.querySelector('ytd-masthead').style.display;await send('TEST_MASTHEAD_RELEASE');return{leaked,applied,released,bar};
  });assert.equal(result.leaked,false);assert.equal(result.applied.result.feature_id,'YT-08');assert.equal(result.applied.coreConnected,false);assert.equal(result.released.released.restored,true);assert.equal(result.bar,'none');assert.equal(await page.locator('#timed').isVisible(),true);
});

test('modern post-play grid is hidden alongside timed cards, preserving replay/captions/sidebar',async t=>{
  const modern='<div class="ytp-fullscreen-grid"><div id="post-grid" class="ytp-fullscreen-grid-stills-container" style="display:grid"><a href="/watch?v=two">one</a><a href="/watch?v=three">two</a><a href="/watch?v=four">three</a></div><button id="post-replay">replay</button></div>';
  const body=html.replace('<div id="movie_player">','<div id="movie_player" class="html5-video-player ended-mode">').replace('</video>','</video>'+modern);
  const page=await fixture(t,{body});await page.evaluate(()=>session.start());
  assert.equal(await page.locator('#timed').isVisible(),false);
  assert.equal(await page.locator('#post-grid').isVisible(),false);
  assert.equal(await page.locator('#post-grid').evaluate(e=>e.inert),true);
  for(const selector of ['#post-replay','#play','#captions','#related','#description'])assert.equal(await page.locator(selector).isVisible(),true);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#post-grid').evaluate(e=>e.style.display),'grid');assert.equal(await page.locator('#post-grid').evaluate(e=>e.inert),false);
});

test('modern grid waits for ended mode and restores on replay, including late creation',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{
    session.start();document.querySelector('#movie_player').insertAdjacentHTML('beforeend','<div id="post-grid" class="ytp-fullscreen-grid-stills-container" style="display:grid"><a>recommendation</a></div>');
  });
  assert.equal(await page.locator('#post-grid').isVisible(),true);
  await page.evaluate(()=>document.querySelector('#movie_player').classList.add('ended-mode'));
  await page.waitForFunction(()=>document.querySelector('#post-grid').style.display==='none');
  await page.evaluate(()=>document.querySelector('#movie_player').classList.remove('ended-mode'));
  await page.waitForFunction(()=>document.querySelector('#post-grid').style.display==='grid');
  assert.equal(await page.locator('#play').isVisible(),true);
  await page.evaluate(()=>{document.querySelector('#post-grid').remove();document.querySelector('#movie_player').classList.add('ended-mode');});
  await page.evaluate(()=>document.querySelector('#movie_player').insertAdjacentHTML('beforeend','<div id="late-grid" class="ytp-fullscreen-grid-stills-container">late</div>'));
  await page.waitForFunction(()=>document.querySelector('#late-grid').style.display==='none');assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#late-grid').isVisible(),true);
});

test('new post-play grid preserves another owner and failed cleanup goals',async t=>{
  const body=html.replace('<div id="movie_player">','<div id="movie_player" class="ended-mode">').replace('</video>','</video><div id="post-grid" class="ytp-fullscreen-grid-stills-container" style="display:grid">cards</div>');
  const page=await fixture(t,{body});const result=await page.evaluate(()=>{
    session.start();const other=make({...settings,owner_binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();const node=document.querySelector('#post-grid'),shared=node.style.display,write=node.style.setProperty.bind(node.style);
    node.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='grid'){write(name,'block');throw Error('partial grid restore');}write(name,value,priority);};
    const failed=other.release();node.style.setProperty=write;const retried=other.release();return{shared,failed,retried,display:node.style.display};
  });assert.equal(result.shared,'none');assert.equal(result.failed.restored,false);assert.equal(result.retried.restored,true);assert.equal(result.display,'grid');
});

test('combined harness releases endcards without enabling autoplay or removing other options',async t=>{
  const nav='<ytd-guide-entry-renderer id="home"><a href="/">home</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="subs"><a href="/feed/subscriptions">subs</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="explore"><a href="/feed/trending">explore</a></ytd-guide-entry-renderer>';
  const body=nav+html.replace('<div id="movie_player">','<div id="movie_player" class="ended-mode">').replace('</video>','</video><div id="post-grid" class="ytp-fullscreen-grid-stills-container" style="display:grid">post-play</div>').replace('<div id="related">','<ytd-comments>comments</ytd-comments><div id="related">');
  const page=await fixture(t,{body});await page.evaluate(()=>{
    const toggle=document.querySelector('.ytp-autonav-toggle-button');toggle.onclick=()=>toggle.setAttribute('aria-checked',toggle.getAttribute('aria-checked')==='true'?'false':'true');
    window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:cb=>{window.listener=cb;}}}};
  });
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    for(const type of ['TEST_HOME_APPLY','TEST_SUBSCRIPTIONS_APPLY','TEST_EXPLORE_APPLY','TEST_MASTHEAD_APPLY','TEST_WATCH_PANELS_APPLY','TEST_AUTOPLAY_APPLY'])await send(type);
    await send('TEST_ENDCARDS_APPLY');const hidden=document.querySelector('#post-grid').style.display;
    const released=await send('TEST_ENDCARDS_RELEASE');const restored=document.querySelector('#post-grid').style.display;
    const autoStillOff=document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked');
    const preserved=['#home','#subs','#explore','ytd-masthead','ytd-comments','#related'].map(selector=>document.querySelector(selector).style.display);
    const remaining=(await send('TEST_WATCH_PANELS_STATE')).ledger.remaining_targets;
    await send('TEST_AUTOPLAY_RELEASE');const autoRestored=document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-checked');
    for(const type of ['TEST_HOME_RELEASE','TEST_SUBSCRIPTIONS_RELEASE','TEST_EXPLORE_RELEASE','TEST_MASTHEAD_RELEASE','TEST_WATCH_PANELS_RELEASE'])await send(type);
    return{hidden,released,restored,autoStillOff,preserved,remaining,autoRestored,final:(await send('TEST_WATCH_PANELS_STATE')).ledger.remaining_targets};
  });assert.equal(result.hidden,'none');assert.equal(result.released.released.restored,true);assert.equal(result.restored,'grid');assert.equal(result.autoStillOff,'false');assert.deepEqual(result.preserved,Array(6).fill('none'));assert.equal(result.remaining,6);assert.equal(result.autoRestored,'true');assert.equal(result.final,0);
});
