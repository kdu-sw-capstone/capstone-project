import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const ids={owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002'};
const viewer='<main><article><video id="reel" style="display:block!important"></video><button id="close">close</button></article></main><aside><video id="dm"></video></aside><button data-focurve-ui id="exit">exit</button>';
async function fixture(t,{html=viewer,url='https://www.instagram.com/reel/sample/',adapter=false}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+html});});
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async({ids,adapter})=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');window.ledger=new ClaimLedger(document);
    window.current=true;window.allowed=true;window.observations=[];window.invalidations=[];window.pauses=0;
    window.prepare=()=>document.querySelectorAll('video,audio').forEach(m=>{if(m.prepared)return;m.prepared=true;m.stopped=false;
      Object.defineProperty(m,'paused',{get(){return this.stopped;}});m.pause=function(){pauses++;this.stopped=true;};});prepare();
    window.opts={...ids,ledger,canObserve:()=>current,isCurrent:()=>current,authorizeNavigation:()=>allowed,
      onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    const{InstagramReelsSession}=await import('/content/instagram-reels.mjs');window.make=o=>new InstagramReelsSession(document,{...opts,...o});
    if(adapter){const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.session=new ContentSessionAdapter(document,{...opts,features:[{feature_id:'IG-02',enabled:true,required:true}]});}
    else window.session=make();
  },{ids,adapter});return page;
}
test('direct Reels media is hidden/inert/paused; controls and protected DM stay intact; release restores manual control',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>session.start());
  assert.equal(r.status,'OBSERVED');assert.equal(r.media_stopped_if_route_block,true);
  assert.deepEqual(await p.locator('#reel').evaluate(m=>[m.style.display,m.inert,m.paused]),['none',true,true]);
  for(const id of ['#close','#exit'])assert.equal(await p.locator(id).isVisible(),true);
  assert.equal(await p.locator('#dm').evaluate(m=>m.paused),false);
  await p.evaluate(()=>{const m=document.querySelector('#reel');m.stopped=false;m.dispatchEvent(new Event('play'));});
  assert.equal(await p.locator('#reel').evaluate(m=>m.paused),true);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#reel').evaluate(m=>[m.style.display,m.style.getPropertyPriority('display'),m.inert]),['block','important',false]);
  await p.evaluate(()=>{const m=document.querySelector('#reel');m.stopped=false;m.dispatchEvent(new Event('play'));});
  assert.equal(await p.locator('#reel').evaluate(m=>m.paused),false);
});
test('home/explore links and preview media only; ordinary post video, story, foreign URL and DM links preserved',async t=>{
  const html='<nav><a id="menu" href="/reels/">Reels</a></nav><main><a id="preview" href="/reel/one/"><video></video></a><article><video id="ordinary"></video></article><a id="story" href="/stories/sample/">story</a><a id="foreign" href="https://example.com/reel/x/">foreign</a><a id="fake" href="/reel/one/extra/">not reel</a></main><aside><a id="message" href="/reel/two/">DM</a></aside>';
  const p=await fixture(t,{html,url:'https://www.instagram.com/'});const r=await p.evaluate(()=>session.start());
  assert.equal(r.restricted_target_count,2);assert.equal(r.media_target_count,1);assert.equal(r.media_stopped_if_route_block,null);
  for(const id of ['#menu','#preview'])assert.equal(await p.locator(id).isVisible(),false);
  for(const id of ['#story','#foreign','#fake','#message'])assert.equal(await p.locator(id).isVisible(),true);
  assert.equal(await p.locator('#ordinary').evaluate(m=>m.paused),false);
});
test('direct viewer without media remains OBSERVING and late dynamic video is restricted automatically',async t=>{
  const p=await fixture(t,{html:'<main id="main"></main>'});const r=await p.evaluate(()=>session.start());
  assert.equal(r.status,'OBSERVING');assert.equal(r.media_stopped_if_route_block,false);
  await p.evaluate(()=>{document.querySelector('main').innerHTML='<video id="late"></video>';prepare();});
  await p.waitForFunction(()=>document.querySelector('#late').inert);
  assert.equal(await p.evaluate(()=>observations.at(-1).media_stopped_if_route_block),true);
});
test('pause failure is FAILED even when the video is hidden',async t=>{
  const p=await fixture(t);await p.evaluate(()=>document.querySelector('#reel').pause=()=>{throw Error('decoder');});
  const r=await p.evaluate(()=>session.start());assert.equal(r.status,'FAILED');assert.equal(r.media_stopped_if_route_block,false);
});
test('failed DOM restriction cannot claim a successful route block merely because pause worked',async t=>{
  const p=await fixture(t);await p.evaluate(()=>ledger.hide=()=>false);
  const r=await p.evaluate(()=>session.start());assert.equal(r.status,'FAILED');assert.equal(r.media_stopped_if_route_block,false);
});
test('release reentered from pause stays pending until the outer scan unwinds',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{document.querySelector('#reel').pause=function(){this.stopped=true;window.early=session.release();};session.start();});
  assert.equal(await p.evaluate(()=>early.restored),false);assert.equal(await p.evaluate(()=>early.cleanup_pending),true);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('#reel').evaluate(m=>m.inert),false);
});
test('same-document home/profile/Reels transitions require reauthorization and preserve neutral pages',async t=>{
  const p=await fixture(t,{html:'<main></main>',url:'https://www.instagram.com/'});await p.evaluate(()=>session.start());
  await p.evaluate(()=>{history.pushState({},'','/sample/');session.scan();history.pushState({},'','/reels/sample/');document.querySelector('main').innerHTML='<video id="next"></video>';prepare();session.scan();});
  assert.equal(await p.locator('#next').evaluate(m=>m.paused&&m.inert),true);
  await p.evaluate(()=>{history.pushState({},'','/direct/inbox/');session.scan();});
  assert.equal(await p.locator('#next').evaluate(m=>m.inert),false);assert.equal(await p.evaluate(()=>observations.at(-1).eligible_target_count),0);
});
test('denied transition/pagehide closes new effects; pageshow never resumes authority',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();allowed=false;history.pushState({},'','/reel/next/');session.scan();});
  assert.equal(await p.evaluate(()=>invalidations.at(-1).reason),'ROUTE_CHANGED');
  await p.evaluate(()=>{allowed=true;dispatchEvent(new Event('pageshow'));document.querySelector('main').insertAdjacentHTML('beforeend','<video id="late"></video>');prepare();session.scan();});
  assert.equal(await p.locator('#late').evaluate(m=>m.inert),false);
});
test('two owners restore only last claim and a retired session cannot release the replacement',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();window.other=make({binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();});
  assert.equal(await p.locator('#reel').evaluate(m=>m.inert),true);await p.evaluate(()=>{other.release();window.next=make();next.start();session.release();});
  assert.equal(await p.locator('#reel').evaluate(m=>m.inert),true);assert.equal((await p.evaluate(()=>next.release())).restored,true);
});
test('href eligibility changes retire own claim while another owner is preserved',async t=>{
  const p=await fixture(t,{html:'<a id="entry" href="/reel/one/">reel</a>',url:'https://www.instagram.com/'});
  await p.evaluate(()=>{session.start();ledger.hide('other',document.querySelector('#entry'));document.querySelector('#entry').href='/p/post/';});
  await p.waitForFunction(()=>observations.at(-1).remaining_targets===0);
  assert.equal(await p.locator('#entry').evaluate(m=>m.style.display),'none');
  await p.evaluate(()=>ledger.release('other'));assert.equal(await p.locator('#entry').evaluate(m=>m.style.display),'');
});
test('authority revoked in pause callback stops later media and retains cleanup for retry',async t=>{
  const p=await fixture(t,{html:'<main><video id="first"></video><video id="second"></video></main>'});
  await p.evaluate(()=>{document.querySelector('#first').pause=function(){this.stopped=true;current=false;session.stop();};session.start();});
  assert.equal(await p.locator('#second').evaluate(m=>m.paused),false);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('adapter dispatches IG-02 with explicit current authority and reports local cleanup only',async t=>{
  const p=await fixture(t,{adapter:true});const r=await p.evaluate(()=>session.start());
  assert.equal(r.native_verified,false);assert.equal(r.features[0].observation.feature_id,'IG-02');
  assert.equal((await p.evaluate(()=>session.release())).cleanup_pending,false);
});
test('actual TEST bootstrap accepts only its popup and supports Reels apply/release',async t=>{
  const p=await fixture(t);const source=await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8');
  await p.evaluate(source=>{
    window.chrome={runtime:{id:'test',getURL:path=>location.origin+'/'+path,onMessage:{addListener:f=>window.listener=f}}};
    (0,eval)(source);
  },source);
  const r=await p.evaluate(async()=>{
    const send=(type,sender={id:'test',url:location.origin+'/popup.html'})=>new Promise(resolve=>listener({type},sender,resolve));
    let leaked=false;listener({type:'TEST_IG_REELS_APPLY'},{id:'test',url:location.href},()=>{leaked=true;});
    return {leaked,applied:await send('TEST_IG_REELS_APPLY'),released:await send('TEST_IG_REELS_RELEASE')};
  });
  assert.equal(r.leaked,false);assert.equal(r.applied.result.feature_id,'IG-02');assert.equal(r.applied.coreConnected,false);
  assert.equal(r.released.released.restored,true);
});
