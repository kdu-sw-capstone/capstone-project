import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<nav><a id="menu" href="/explore/">explore</a><a id="search" href="/explore/search/">search</a><a href="/">home</a></nav><main><a id="photo" href="/p/one/" style="display:flex!important"><img width="100" height="100"></a><a id="reel" href="/reel/two/"><video></video></a><a id="profile" href="/sample/">profile</a><div role="search"><input id="input"><a id="search-result" href="/p/search/"><img></a></div><a id="foreign" href="https://example.com/p/one/"><img></a><a href="/p/protected/" id="protected"><button data-focurve-ui id="exit">exit</button><img></a></main><aside><a id="dm" href="/explore/">message</a></aside>';
async function fixture(t,{url='https://www.instagram.com/explore/',adapter=false}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+html});});
  const p=await context.newPage();await p.goto(url);
  await p.evaluate(async adapter=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');const{InstagramExploreSession}=await import('/content/instagram-explore.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];window.current=true;window.allowed=true;
    window.opts={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      canObserve:()=>current,isCurrent:()=>current,authorizeNavigation:()=>allowed,onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=o=>new InstagramExploreSession(document,{...opts,...o});
    if(adapter){const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.session=new ContentSessionAdapter(document,{...opts,features:[{feature_id:'IG-03',enabled:true,required:true}]});}
    else window.session=make();
  },adapter);return p;
}
test('explore hides exact menu/grid links while retaining search, profile, DM and protected UI',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>session.start());assert.equal(r.feature_id,'IG-03');assert.equal(r.restricted_target_count,3);
  for(const id of ['#menu','#photo','#reel'])assert.equal(await p.locator(id).evaluate(e=>e.style.opacity),'0');
  for(const id of ['#search','#profile','#input','#search-result','#foreign','#dm','#exit'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#photo').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display'),e.inert]),['flex','important',false]);
});
test('home/search results/post/profile routes never treat the main contents as Explore',async t=>{
  for(const path of ['/','/explore/search/','/explore/tags/sample/','/explore/?q=sample','/p/one/','/sample/']){
    const p=await fixture(t,{url:'https://www.instagram.com'+path});await p.evaluate(()=>session.start());
    assert.equal(await p.locator('#photo').evaluate(e=>e.style.display),'flex',path);
    assert.equal(await p.locator('#reel').evaluate(e=>e.inert),false,path);
  }
});
test('shared /explore/ URL does not authorize hiding Search or an unlabeled entry; label changes restore own claim',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/'});
  await p.evaluate(()=>document.querySelector('nav').insertAdjacentHTML('beforeend','<a id="shared-search" href="/explore/" aria-label="검색"><svg><title>검색</title></svg></a><a id="unknown" href="/explore/"><svg></svg></a><a id="svg-explore" href="/explore/"><svg aria-label="Explore"></svg></a>'));
  await p.evaluate(()=>session.start());
  assert.equal(await p.locator('#shared-search').evaluate(e=>e.inert),false);
  assert.equal(await p.locator('#unknown').evaluate(e=>e.inert),false);
  assert.equal(await p.locator('#svg-explore').evaluate(e=>e.inert),true);
  await p.evaluate(()=>document.querySelector('#menu').setAttribute('aria-label','Search'));
  await p.waitForFunction(()=>!document.querySelector('#menu').inert,null,{timeout:2000});
});
test('concealed grid keeps scroll geometry and hides only list progress while restoring both',async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{document.querySelector('main').insertAdjacentHTML('beforeend','<div id="loader" role="progressbar" style="height:24px;opacity:1!important">loading</div>');document.querySelector('[role="search"]').insertAdjacentHTML('beforeend','<div id="search-loader" role="progressbar">search loading</div>');});
  const before=await p.locator('main').evaluate(e=>e.getBoundingClientRect().height);
  await p.evaluate(()=>session.start());assert.equal(await p.locator('main').evaluate(e=>e.getBoundingClientRect().height),before);
  assert.equal(await p.locator('#loader').evaluate(e=>getComputedStyle(e).opacity),'0');
  assert.equal(await p.locator('#search-loader').evaluate(e=>getComputedStyle(e).opacity),'1');
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#loader').evaluate(e=>[e.style.opacity,e.style.getPropertyPriority('opacity'),e.inert]),['1','important',false]);
});
test('conceal preserves another owner, page opacity edits and initial loading before cards exist',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();ledger.conceal('other',document.querySelector('#photo'));session.release();});
  assert.equal(await p.locator('#photo').evaluate(e=>e.style.opacity),'0');await p.evaluate(()=>ledger.release('other'));
  assert.equal(await p.locator('#photo').evaluate(e=>e.style.opacity),'');
  await p.evaluate(()=>{window.next=make();next.start();document.querySelector('#photo').style.opacity='0.5';next.scan();next.release();});
  assert.equal(await p.locator('#photo').evaluate(e=>e.style.opacity),'0.5');
  await p.evaluate(()=>{document.querySelector('main').innerHTML='<div id="initial" role="progressbar">loading</div>';window.last=make();last.start();});
  assert.equal(await p.locator('#initial').evaluate(e=>e.inert),false);
});
test('late cards and href selector exit reconcile automatically without reclaiming another owner',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();ledger.hide('other',document.querySelector('#photo'));document.querySelector('#photo').href='/sample/';document.querySelector('main').insertAdjacentHTML('beforeend','<a id="late" href="/p/late/"><img></a>');});
  await p.waitForFunction(()=>document.querySelector('#late').inert&&observations.at(-1).remaining_targets===3);
  assert.equal(await p.locator('#photo').evaluate(e=>e.inert),true);
  await p.evaluate(()=>ledger.release('other'));assert.equal(await p.locator('#photo').evaluate(e=>e.style.display),'flex');
});
test('explicit SPA authorization cleans grid on search and reapplies on Explore; denied transition stops',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();history.pushState({},'','/explore/search/');session.scan();});
  assert.equal(await p.locator('#photo').evaluate(e=>e.inert),false);
  await p.evaluate(()=>{history.pushState({},'','/explore/');session.scan();});assert.equal(await p.locator('#photo').evaluate(e=>e.inert),true);
  await p.evaluate(()=>{allowed=false;history.pushState({},'','/sample/');session.scan();});assert.equal(await p.evaluate(()=>invalidations.at(-1).reason),'ROUTE_CHANGED');
});
test('multiple owners and retired sessions preserve the active replacement',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();window.other=make({binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();});
  assert.equal(await p.locator('#photo').evaluate(e=>e.inert),true);
  await p.evaluate(()=>{other.release();window.next=make();next.start();session.release();});assert.equal(await p.locator('#photo').evaluate(e=>e.inert),true);
  assert.equal((await p.evaluate(()=>next.release())).restored,true);
});
test('pagehide and current authority revoke fence new effects and BFCache does not resume them',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();dispatchEvent(new Event('pagehide'));dispatchEvent(new Event('pageshow'));document.querySelector('main').insertAdjacentHTML('beforeend','<a id="late" href="/p/late/"><img></a>');session.scan();});
  assert.equal(await p.locator('#late').evaluate(e=>e.inert),false);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('partial restore remains retryable and cannot be confirmed from empty counts',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();window.restore=ledger.release.bind(ledger);ledger.release=()=>({restored:false,error_count:1});});
  const r=await p.evaluate(()=>session.release());assert.equal(r.restored,false);assert.equal(r.remaining_targets,3);
  await p.evaluate(()=>ledger.release=restore);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('IG-03 adapter returns local evidence and the real TEST bootstrap accepts only its popup',async t=>{
  const p=await fixture(t,{adapter:true});const r=await p.evaluate(()=>session.start());assert.equal(r.features[0].observation.feature_id,'IG-03');assert.equal(r.native_verified,false);await p.evaluate(()=>session.release());
  await p.evaluate(()=>{window.chrome={runtime:{id:'test',getURL:p=>location.origin+'/'+p,onMessage:{addListener:f=>window.listener=f}}};});
  await p.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await p.evaluate(async()=>{let leaked=false;listener({type:'TEST_IG_EXPLORE_APPLY'},{id:'test',url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},{id:'test',url:chrome.runtime.getURL('popup.html')},resolve));
    return {leaked,applied:await send('TEST_IG_EXPLORE_APPLY'),released:await send('TEST_IG_EXPLORE_RELEASE')};});
  assert.equal(result.leaked,false);assert.equal(result.applied.result.feature_id,'IG-03');assert.equal(result.released.released.restored,true);
});
