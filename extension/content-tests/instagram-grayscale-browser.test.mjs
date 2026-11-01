import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const body='<main style="--original:none;filter:var(--original)"><ytd-masthead>logo</ytd-masthead><main><video id="video"></video><button id="play">play</button><div id="comments">comments</div><img id="thumb"></main></main><aside data-focurve-ui id="exit">FOCURVE</aside>';
async function fixture(t,{html=body,url='https://www.instagram.com/'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html>'+html});
  });
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs'),{InstagramGrayscaleSession}=await import('/content/instagram-grayscale.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=options=>new InstagramGrayscaleSession(document,options);window.session=make(settings);
  });return page;
}
test('feed and playing media receive computed grayscale without media mutation; original CSS restores',async t=>{
 const p=await fixture(t);const before=await p.locator('video').evaluate(e=>[e.paused,e.muted,e.volume,e.currentTime]);const r=await p.evaluate(()=>session.start());assert.equal(r.feature_id,'IG-06');
 assert.equal(await p.locator('main').first().evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');assert.deepEqual(await p.locator('video').evaluate(e=>[e.paused,e.muted,e.volume,e.currentTime]),before);
 assert.equal(await p.locator('#exit').evaluate(e=>getComputedStyle(e).filter),'none');assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('main').first().evaluate(e=>e.style.filter),'var(--original)');
});
test('portaled post and Reels dialog is grayscale; DM dock and login form are excluded',async t=>{
 for(const path of ['/p/sample/','/reels/sample/']){
  const p=await fixture(t,{url:'https://www.instagram.com'+path,html:'<div role="dialog" id="post"><img id="image"><div aria-label="Messages" id="dm">DM</div><form action="/accounts/login/" id="login"><input type="password"></form></div><aside aria-label="Messages" id="dock">DM</aside>'});await p.evaluate(()=>session.start());
  assert.equal(await p.locator('#image').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');for(const id of ['#dm','#login','#dock'])assert.equal(await p.locator(id).evaluate(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).filter.includes('grayscale'))return false;return true;}),true);
 }
});
test('new protected UI splits an existing root without coloring the notice',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{session.start();document.querySelector('main').insertAdjacentHTML('beforeend','<div data-focurve-ui id="notice">FOCURVE</div>');});await p.waitForFunction(()=>document.querySelector('main').style.filter==='var(--original)');
 assert.equal(await p.locator('#notice').evaluate(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).filter.includes('grayscale'))return false;return true;}),true);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('two owners and independent hide retain their effects until each releases',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{session.start();window.other=make({...settings,binding_id:'00000000-0000-4000-8000-000000000003'});other.start();ledger.hide('hide',document.querySelector('main'));session.release();});assert.equal(await p.locator('main').first().evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');
 await p.evaluate(()=>other.release());assert.equal(await p.locator('main').first().evaluate(e=>e.style.display),'none');await p.evaluate(()=>ledger.release('hide'));
});
test('page filter edits and partial restoration debt survive retry',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{session.start();document.querySelector('main').style.filter='sepia(1)';session.scan();});assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('main').first().evaluate(e=>e.style.filter),'sepia(1)');
 const result=await p.evaluate(()=>{session=make(settings);session.start();const e=document.querySelector('main'),write=e.style.setProperty.bind(e.style);e.style.setProperty=(key,value,priority)=>{if(key==='filter'&&value==='sepia(1)'){write(key,'blur(1px)');throw Error('partial');}write(key,value,priority);};const failed=session.release();e.style.setProperty=write;return{failed,retried:session.release(),filter:e.style.filter};});assert.equal(result.failed.restored,false);assert.equal(result.retried.restored,true);assert.equal(result.filter,'sepia(1)');
});
test('authorized SPA keeps grayscale while DM navigation restores; pagehide never resumes',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();history.pushState({},'','/reels/sample/');window.dispatchEvent(new PopStateEvent('popstate'));});await p.waitForFunction(()=>observations.length>1);
 assert.equal(await p.locator('main').first().evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');await p.evaluate(()=>{history.pushState({},'','/direct/inbox/');window.dispatchEvent(new PopStateEvent('popstate'));});await p.waitForFunction(()=>invalidations.length>0);assert.equal(await p.locator('main').first().evaluate(e=>e.style.filter),'var(--original)');await p.evaluate(()=>session.release());
});
test('DM, login and foreign host cannot acquire grayscale',async t=>{
 for(const url of ['https://www.instagram.com/direct/inbox/','https://www.instagram.com/accounts/login/','https://www.instagram.com/challenge/','https://example.com/']){const p=await fixture(t,{url});assert.equal(await p.evaluate(()=>{try{session.start();return false;}catch{return true;}}),true);}
});

test('profiles and profile Reels/Tagged tabs, Explore and Stories apply and restore',async t=>{
 for(const path of ['/sample/','/sample/reels/','/sample/tagged/','/explore/','/stories/sample/1/']){
  const p=await fixture(t,{url:'https://www.instagram.com'+path});assert.equal((await p.evaluate(()=>session.start())).status,'OBSERVED');assert.equal(await p.locator('main').first().evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('main').first().evaluate(e=>e.style.filter),'var(--original)');
 }
});

test('home to profile to profile Reels stays active with explicit SPA authority',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();});
 for(const path of ['/sample/','/sample/reels/','/sample/tagged/']){await p.evaluate(path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));},path);await p.waitForFunction(()=>observations.length>1);await p.evaluate(()=>session.scan());assert.equal(await p.locator('main').first().evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');assert.equal(await p.evaluate(()=>invalidations.length),0);}
 assert.equal((await p.evaluate(()=>session.release())).restored,true);
});

test('public page without MAIN still colors content while keeping protected UI outside filters',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/stories/sample/1/',html:'<section id="story"><img></section><aside data-focurve-ui id="notice">FOCURVE</aside>'});await p.evaluate(()=>session.start());assert.equal(await p.locator('#story').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');assert.equal(await p.locator('#notice').evaluate(e=>getComputedStyle(e).filter),'none');assert.equal((await p.evaluate(()=>session.release())).restored,true);
});

test('Explore to portaled Reels outside an existing MAIN keeps the new video grayscale',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/explore/',html:'<main><img id="preview"></main><div id="portal"></div>'});
 await p.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();history.pushState({},'','/reels/sample/');document.querySelector('#portal').innerHTML='<section id="viewer"><video id="portal-video"></video><span id="caption">caption</span></section>';window.dispatchEvent(new PopStateEvent('popstate'));});
 await p.waitForFunction(()=>observations.length>1);assert.equal(await p.locator('#portal-video').evaluate(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).filter.includes('grayscale(1)'))return true;return false;}),true);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('#portal-video').evaluate(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).filter.includes('grayscale'))return false;return true;}),true);
});

test('late notification panel outside MAIN is grayscale without coloring a DM dock or FOCURVE UI',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/sample/',html:'<main><img></main><div id="panels"></div><aside aria-label="Messages" id="dm">DM</aside><aside data-focurve-ui id="notice">FOCURVE</aside>'});
 await p.evaluate(()=>{session.start();document.querySelector('#panels').innerHTML='<section aria-label="알림"><img id="notification-avatar"><button>Follow</button></section>';});
 await p.waitForFunction(()=>observations.length>1);assert.equal(await p.locator('#notification-avatar').evaluate(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).filter.includes('grayscale(1)'))return true;return false;}),true);
 for(const id of ['#dm','#notice'])assert.equal(await p.locator(id).evaluate(e=>{for(let n=e;n;n=n.parentElement)if(getComputedStyle(n).filter.includes('grayscale'))return false;return true;}),true);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('actual TEST sender gate returns local effects and restoration only',async t=>{
 const p=await fixture(t);await p.evaluate(()=>{window.chrome={runtime:{id:'test',getURL:p=>location.origin+'/'+p,onMessage:{addListener:f=>window.listener=f}}};});await p.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
 const r=await p.evaluate(async()=>{let leaked=false;listener({type:'TEST_IG_GRAYSCALE_APPLY'},{id:'test',url:location.href},()=>{leaked=true;});const send=type=>new Promise(resolve=>listener({type},{id:'test',url:chrome.runtime.getURL('popup.html')},resolve));return{leaked,on:await send('TEST_IG_GRAYSCALE_APPLY'),off:await send('TEST_IG_GRAYSCALE_RELEASE')};});assert.equal(r.leaked,false);assert.equal(r.on.result.feature_id,'IG-06');assert.equal(r.on.coreConnected,false);assert.equal(r.off.released.restored,true);
});
