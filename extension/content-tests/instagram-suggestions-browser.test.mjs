import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<main></main>';
const accounts='<section id="suggestions" style="display:grid!important"><h3>회원님을 위한 추천</h3><div><a href="/sample/"><img></a><a href="/sample/">sample</a><button>팔로우</button></div></section>';
const suggestedPost='<article id="suggested-post"><header><span>추천 게시물</span></header><img><p>caption</p><button>Like</button></article>';
const mutualRow='<div id="mutual"><a href="/mutual-user/"><img></a><a href="/mutual-user/">account</a><div><span role="link" style="width:14px;height:14px"><img></span><span>someone follows</span></div><button>팔로우</button></div>';

test('review: recommendation group never expands across a separate Following section',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:'<aside><section id="recommended"><h3>Suggested for you</h3><div><a href="/recommended/"><img></a><button>Follow</button></div></section><section id="following"><h3>Following</h3><div><a href="/ordinary/"><img></a><button>Follow</button></div></section></aside>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#recommended').evaluate(e=>!!e.closest('[inert]')),true);assert.equal(await p.locator('#following').evaluate(e=>!!e.closest('[inert]')),false);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
for(const nested of ['<section><header><span>Suggested posts</span></header><a href="/suggestion/">suggestion</a></section>','<div><section><header><span>Suggested posts</span></header><img></section></div>'])test(`review: nested recommendation header does not own outer post ${nested.startsWith('<section>')?'section':'widget'}`,async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:'<main><article id="ordinary"><header><a href="/author/">author</a></header><img id="photo"><span id="caption">ordinary caption</span><button id="like">Like</button>'+nested+'</article></main>'});await p.evaluate(()=>session.start());
 for(const id of ['#ordinary','#photo','#caption','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false,id);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
async function fixture(t,{url='https://www.instagram.com/p/sample/',body=html,adapter=false}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+body});});
  const p=await context.newPage();await p.goto(url);
  await p.evaluate(async adapter=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');const{InstagramSuggestionsSession}=await import('/content/instagram-suggestions.mjs');
    window.ledger=new ClaimLedger(document);window.current=true;window.allowed=true;window.observations=[];window.invalidations=[];window.pauses=0;
    document.querySelectorAll('video').forEach(m=>m.pause=()=>pauses++);
    window.opts={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      canObserve:()=>current,isCurrent:()=>current,authorizeNavigation:()=>allowed,onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=o=>new InstagramSuggestionsSession(document,{...opts,...o});
    if(adapter){const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.session=new ContentSessionAdapter(document,{...opts,features:[{feature_id:'IG-05',enabled:true,required:true}]});}
    else window.session=make();
  },adapter);return p;
}

test('account suggestions and marked posts hide while following feed, ads and switcher survive; restore originals',async t=>{
 const body='<main><article id="following"><header>following</header><img><p>caption</p></article>'+suggestedPost+suggestedPost.replaceAll('suggested-post','ad').replace('추천 게시물','추천 게시물</span><span>광고')+'</main><aside><div id="switch"><a href="/self/">self</a><button>전환</button></div>'+accounts+'</aside>';
 const p=await fixture(t,{url:'https://www.instagram.com/',body});const r=await p.evaluate(()=>session.start());assert.equal(r.restricted_target_count,2);
 for(const id of ['#suggestions','#suggested-post'])assert.equal(await p.locator(id).evaluate(e=>e.inert),true);
 for(const id of ['#following','#ad','#switch'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.deepEqual(await p.locator('#suggestions').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['grid','important']);
});
test('late region, text identity changes and reinsertion reconcile automatically',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/'});assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
 await p.evaluate(body=>document.body.insertAdjacentHTML('beforeend',body),accounts);await p.waitForFunction(()=>document.querySelector('#suggestions').inert);
 await p.evaluate(()=>document.querySelector('h3').firstChild.data='Following');await p.waitForFunction(()=>!document.querySelector('#suggestions').inert);
 await p.evaluate(()=>document.querySelector('h3').textContent='Suggested for you');await p.waitForFunction(()=>document.querySelector('#suggestions').inert);
});

test('suggestion heading covers all sibling rows including mutual-follow avatars and deep wrappers',async t=>{
 const deep='<div>'.repeat(9)+'<span>회원님을 위한 추천</span>'+'</div>'.repeat(9);
 const p=await fixture(t,{url:'https://www.instagram.com/',body:'<aside><div id="self"><a href="/self/">self</a><button>전환</button></div><div id="group">'+deep+'<div>'+accounts+mutualRow+'</div></div></aside>'});
 await p.evaluate(()=>session.start());for(const id of ['#suggestions','#mutual'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),true,id);
 assert.equal(await p.locator('#self').evaluate(e=>!!e.closest('[inert]')),false);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});

test('later mutual-follow cards without their own recommendation label remain in the proven group',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:'<aside><section><h3>회원님을 위한 추천</h3>'+accounts+mutualRow+'</section></aside>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#mutual').evaluate(e=>!!e.closest('[inert]')),true);
 await p.evaluate(()=>document.querySelector('#mutual').insertAdjacentHTML('afterend','<div id="late"><a href="/late/"><img></a><button>Follow</button></div>'));await p.waitForFunction(()=>!!document.querySelector('#late').closest('[inert]'));
});

test('supplied DIV author/time heading identifies suggested video without relying on semantic HEADER',async t=>{
 const heading='<div><a href="/author/"><img></a><div><a href="/author/">author</a><a href="/p/sample/"><time datetime="2026-01-01">time</time></a></div><div><span><div style="height:0;overflow:hidden"><span>회원님을 위한 추천</span></div></span></div><button>Follow</button></div>';
 const body='<main><article id="recommended">'+heading+'<div aria-label="Video player" role="group"><video></video></div><p>caption</p></article><article id="ordinary">'+heading.replace('회원님을 위한 추천','original audio')+'<video></video><p>회원님을 위한 추천</p></article></main>';
 const p=await fixture(t,{url:'https://www.instagram.com/',body});await p.evaluate(()=>session.start());assert.equal(await p.locator('#recommended').evaluate(e=>e.inert),true);assert.equal(await p.locator('#ordinary').evaluate(e=>e.inert),false);assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('ambiguous feed roots, captions, DM and protected UI never become recommendation claims',async t=>{
 const body='<main><h3>추천 계정</h3><article><img></article><a href="/other/">other</a><button>팔로우</button></main><article><p>추천 게시물</p><img></article><div data-focurve-ui>'+accounts+'</div>';
 const p=await fixture(t,{url:'https://www.instagram.com/',body});assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
 for(const path of ['/direct/inbox/','/sample/','/stories/sample/','/reels/sample/']){const q=await fixture(t,{url:'https://www.instagram.com'+path,body:accounts});assert.equal(await q.evaluate(()=>{try{session.start();return false;}catch{return true;}}),true);}
});
test('mixed switcher or unlinked post image cannot authorize a whole account group',async t=>{
 for(const extra of ['<button>전환</button>','<img id="post-image">','<a href="/direct/inbox/">DM</a>']){
  const p=await fixture(t,{url:'https://www.instagram.com/',body:accounts.replace('</section>',extra+'</section>')});assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
 }
});
test('independent owner and page edits survive a feature release',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:accounts});await p.evaluate(()=>{session.start();ledger.hide('other',document.querySelector('#suggestions'));});assert.equal((await p.evaluate(()=>session.release())).restored,true);
 assert.equal(await p.locator('#suggestions').evaluate(e=>e.inert),true);await p.evaluate(()=>ledger.release('other'));assert.equal(await p.locator('#suggestions').evaluate(e=>e.inert),false);
 await p.evaluate(()=>{session=make();session.start();document.querySelector('#suggestions').style.display='flex';session.scan();session.release();});assert.equal(await p.locator('#suggestions').evaluate(e=>e.style.display),'flex');
});
test('SPA requires explicit authority, pagehide cannot reactivate and new profile receives no effects',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:accounts});await p.evaluate(()=>{session.start();history.pushState({},'','/sample/');window.dispatchEvent(new PopStateEvent('popstate'));});await p.waitForFunction(()=>invalidations.length>0);
 assert.equal(await p.locator('#suggestions').evaluate(e=>e.inert),false);await p.evaluate(()=>session.release());
 const q=await fixture(t,{url:'https://www.instagram.com/',body:accounts});await q.evaluate(()=>{session.start();window.dispatchEvent(new Event('pagehide'));});await q.evaluate(()=>{session.release();window.dispatchEvent(new Event('pageshow'));});assert.equal(await q.locator('#suggestions').evaluate(e=>e.inert),false);
});
test('adapter dispatches IG-05 and performs feature-local cleanup',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:accounts,adapter:true});const r=await p.evaluate(()=>session.start());assert.equal(r.startup_error??null,null);assert.equal(await p.locator('#suggestions').evaluate(e=>e.inert),true);
 assert.equal((await p.evaluate(()=>session.releaseFeature('IG-05'))).restored,true);assert.equal(await p.locator('#suggestions').evaluate(e=>e.inert),false);await p.evaluate(()=>session.release());
});

test('TEST popup sender gate rejects page messages and returns local IG-05 state',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:accounts});
 await p.evaluate(()=>{window.chrome={runtime:{id:'test',getURL:p=>location.origin+'/'+p,onMessage:{addListener:f=>window.listener=f}}};});
 await p.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
 const r=await p.evaluate(async()=>{let leaked=false;listener({type:'TEST_IG_SUGGESTIONS_APPLY'},{id:'test',url:location.href},()=>{leaked=true;});const send=type=>new Promise(resolve=>listener({type},{id:'test',url:chrome.runtime.getURL('popup.html')},resolve));return{leaked,applied:await send('TEST_IG_SUGGESTIONS_APPLY'),released:await send('TEST_IG_SUGGESTIONS_RELEASE')};});
 assert.equal(r.leaked,false);assert.equal(r.applied.result.feature_id,'IG-05');assert.equal(r.applied.coreConnected,false);assert.equal(r.released.released.restored,true);
});
test('feature-local adapter release preserves a separately active IG-03 claim',async t=>{
 const p=await fixture(t,{url:'https://www.instagram.com/',body:accounts+'<a href="/explore/" aria-label="Explore" id="explore">Explore</a>'});
 await p.evaluate(async()=>{const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.combo=new ContentSessionAdapter(document,{...opts,features:[{feature_id:'IG-05',enabled:true,required:true},{feature_id:'IG-03',enabled:true,required:true}]});combo.start();combo.releaseFeature('IG-05');});
 assert.equal(await p.locator('#suggestions').evaluate(e=>e.inert),false);assert.equal(await p.locator('#explore').evaluate(e=>e.inert),true);assert.equal((await p.evaluate(()=>combo.release())).cleanup_pending,false);
});
