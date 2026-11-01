import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const html='<main><article><header>author</header><video id="video"></video><ul><li id="caption"><a href="/p/sample/">caption</a></li><li id="comment" style="display:flex!important"><a href="/p/sample/c/111/">time</a><span>comment</span></li><li id="reply"><a href="/p/sample/c/111/r/222/">reply</a></li></ul><button id="like" aria-label="Like">like</button><textarea id="editor" placeholder="Add a comment…"></textarea><input id="unrelated" placeholder="Search"></article></main><aside><ul aria-label="Comments" id="dm"><li>message</li></ul></aside><button id="exit" data-focurve-ui>exit</button>';
// Sanitized supplied DIV row: no account, comment text, CDN or class names.
const modern='<div id="modern" style="display:flex!important"><div><span><div role="button"><canvas></canvas><span role="link"><img width="32" height="32"></span></div></span></div><div><h3><div><span><a href="/sample-user/" role="link">author</a></span></div><svg aria-label="Verified"></svg></h3><div><span dir="auto">sample comment</span></div><div><span dir="ltr"><a id="modern-time" href="/p/sample/c/444/" role="link"><time datetime="2026-01-01">time</time></a><button>reply</button><div role="button"><svg aria-label="Comment options"></svg></div></span></div></div></div>';
// Sanitized supplied Reels row: no H3/list role, avatar + author/time/body +
// reply/like role-buttons. Account/CDN/text/classes are deliberately omitted.
const reelRow='<div id="reel-row" style="display:flex!important"><div><a href="/sample-user/" role="link"><img width="32" height="32"></a></div><div><div><div><div><span dir="auto"><a href="/sample-user/" role="link"><div><span dir="auto">author</span></div></a></span><span dir="auto"><a id="reel-time" href="/p/sample/c/555/" role="link"><time datetime="2026-01-01">time</time></a></span></div><div><span dir="auto">sample comment</span></div></div></div><div><div role="button"><span dir="auto">likes</span></div><div role="button"><span dir="auto">reply</span></div></div></div><div><div role="button"><svg aria-label="Like"></svg></div></div></div>';
// Sanitized supplied GIF parent has no time/permalink; the reply group is its
// next sibling and contains DIV rows with mention links, not LI elements.
const gifRow='<div id="gif-row" style="display:flex!important"><div><a href="/sample-user/" role="link"><img id="gif-avatar" width="32" height="32"></a></div><div><a href="/sample-user/" role="link"><span dir="auto">author</span></a><div><img id="gif" width="200" height="100"></div><div role="button"><span>likes</span></div><div role="button"><span id="reply-label">답글 달기</span></div></div><div role="button"><svg aria-label="Like"></svg></div></div>';
const mentionRow=reelRow.replaceAll('reel-row','mention-row').replaceAll('reel-time','mention-time').replace('sample comment','<a href="/parent-user/">@parent</a> reply text');
async function fixture(t,{url='https://www.instagram.com/p/sample/',body=html,adapter=false}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+body});});
  const p=await context.newPage();await p.goto(url);
  await p.evaluate(async adapter=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');const{InstagramCommentsSession}=await import('/content/instagram-comments.mjs');
    window.ledger=new ClaimLedger(document);window.current=true;window.allowed=true;window.observations=[];window.invalidations=[];window.pauses=0;
    document.querySelectorAll('video').forEach(m=>m.pause=()=>pauses++);
    window.opts={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      canObserve:()=>current,isCurrent:()=>current,authorizeNavigation:()=>allowed,onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=o=>new InstagramCommentsSession(document,{...opts,...o});
    if(adapter){const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.session=new ContentSessionAdapter(document,{...opts,features:[{feature_id:'IG-04',enabled:true,required:true}]});}
    else window.session=make();
  },adapter);return p;
}
test('comment permalink rows and editor hide; caption/media/likes/DM/exit survive and originals restore',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>session.start());assert.equal(r.feature_id,'IG-04');assert.equal(r.restricted_target_count,3);
  for(const id of ['#comment','#reply','#editor'])assert.equal(await p.locator(id).evaluate(e=>e.inert),true);
  for(const id of ['#caption','#video','#like','#unrelated','#dm','#exit'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
  assert.equal(await p.evaluate(()=>pauses),0);assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#comment').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display'),e.inert]),['flex','important',false]);
});
test('sanitized modern DIV comment hides avatar and body together while same-author H2 caption stays visible',async t=>{
  const p=await fixture(t,{body:'<main><article><div id="caption"><h2><a href="/sample-user/">author</a></h2><span dir="auto">post caption</span></div>'+modern+'<button id="like">like</button></article></main>'});
  assert.equal((await p.evaluate(()=>session.start())).restricted_target_count,1);
  assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);
  assert.equal(await p.locator('#modern img').evaluate(e=>!!e.closest('[inert]')),true);
  assert.equal(await p.locator('#caption').evaluate(e=>!!e.closest('[inert]')),false);
  assert.equal(await p.locator('#like').evaluate(e=>e.inert),false);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#modern').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['flex','important']);
});
test('modern DIV selector exit retires own claim; mixed rows and protected nested UI are never hidden',async t=>{
  const p=await fixture(t,{body:'<main><article>'+modern+'</article></main>'});
  assert.equal((await p.evaluate(()=>session.start())).restricted_target_count,1);
  await p.evaluate(()=>{ledger.hide('other',document.querySelector('#modern'));document.querySelector('#modern-time').href='/p/sample/';});
  await p.waitForFunction(()=>observations.at(-1).remaining_targets===0);
  assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);await p.evaluate(()=>ledger.release('other'));
  assert.equal(await p.locator('#modern').evaluate(e=>e.inert),false);
  await p.evaluate(()=>{document.querySelector('#modern-time').href='/p/sample/c/444/';document.querySelector('#modern').insertAdjacentHTML('beforeend','<button data-focurve-ui id="protected">exit</button>');});
  await p.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await p.locator('#protected').evaluate(e=>!!e.closest('[inert]')),false);
});
test('supplied Reels DIV row without H3 hides only individual comments, preserving video/caption/close',async t=>{
  const body='<div id="viewer"><video id="video"></video><p id="caption">caption</p></div><div id="panel"><button id="close">close</button><div id="rows">'+reelRow+reelRow.replaceAll('reel-row','second-row').replaceAll('reel-time','second-time').replaceAll('/c/555/','/c/666/')+'</div></div>';
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body});
  const r=await p.evaluate(()=>session.start());assert.equal(r.restricted_target_count,2);
  for(const id of ['#reel-row','#second-row'])assert.equal(await p.locator(id).evaluate(e=>e.inert),true);
  for(const id of ['#video','#caption','#close','#rows','#panel'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
  assert.equal(await p.evaluate(()=>pauses),0);assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#reel-row').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['flex','important']);
});
test('Reels row recycling retires only own claim, dynamically inserted rows restrict without H3',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:'<div id="rows">'+reelRow+'</div>'});
  assert.equal((await p.evaluate(()=>session.start())).restricted_target_count,1);
  await p.evaluate(()=>{ledger.hide('other',document.querySelector('#reel-row'));document.querySelector('#reel-time').href='/p/sample/';});
  await p.waitForFunction(()=>observations.at(-1).remaining_targets===0);assert.equal(await p.locator('#reel-row').evaluate(e=>e.inert),true);
  await p.evaluate(()=>ledger.release('other'));assert.equal(await p.locator('#reel-row').evaluate(e=>e.inert),false);
  await p.evaluate(markup=>document.querySelector('#rows').insertAdjacentHTML('beforeend',markup.replaceAll('reel-row','late-row').replaceAll('reel-time','late-time')),reelRow);
  await p.waitForFunction(()=>document.querySelector('#late-row').inert);
});
test('GIF parent without permalink and its expanded DIV replies hide together including profiles; video and caption survive',async t=>{
  const thread='<div id="thread"><div>'+gifRow+'</div><div id="reply-section"><div role="button">답글 모두 숨기기</div><ul>'+mentionRow+'</ul></div></div>';
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:'<video id="video"></video><h2 id="caption">post author and caption</h2><button id="close">close</button>'+thread});
  await p.evaluate(()=>session.start());
  for(const id of ['#gif','#gif-avatar','#mention-row','#mention-row img','#reply-section'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),true,id);
  for(const id of ['#video','#caption','#close','#thread'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false,id);
  assert.equal(await p.evaluate(()=>pauses),0);assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.equal(await p.locator('#gif-row').evaluate(e=>e.style.display),'flex');assert.equal(await p.locator('#reply-section').evaluate(e=>e.inert),false);
});
test('standalone mention reply is a comment row, not just its body; avatar and author hide too',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:mentionRow});
  assert.equal((await p.evaluate(()=>session.start())).restricted_target_count,1);
  assert.equal(await p.locator('#mention-row img').evaluate(e=>!!e.closest('[inert]')),true);
});
test('collapsed GIF reply controls and late nested replies remain restricted; release preserves another owner',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:'<div><div>'+gifRow+'</div><div id="reply-section"><div role="button">답글 2개 모두 보기</div></div></div>'});
  await p.evaluate(()=>session.start());assert.equal(await p.locator('#reply-section').evaluate(e=>e.inert),true);
  await p.evaluate(markup=>{ledger.hide('other',document.querySelector('#gif-row'));document.querySelector('#reply-section').insertAdjacentHTML('beforeend','<ul>'+markup+'</ul>');},mentionRow);
  await p.waitForFunction(()=>!!document.querySelector('#mention-row').closest('[inert]'));
  assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('#gif-avatar').evaluate(e=>!!e.closest('[inert]')),true);
  assert.equal(await p.locator('#mention-row').evaluate(e=>!!e.closest('[inert]')),false);await p.evaluate(()=>ledger.release('other'));
  assert.equal(await p.locator('#gif-avatar').evaluate(e=>!!e.closest('[inert]')),false);
});
test('GIF reply identity Text.data changes retire and restore the row automatically',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:gifRow});await p.evaluate(()=>session.start());
  assert.equal(await p.locator('#gif-row').evaluate(e=>e.inert),true);
  await p.evaluate(()=>document.querySelector('#reply-label').firstChild.data='share');await p.waitForFunction(()=>!document.querySelector('#gif-row').inert);
  await p.evaluate(()=>document.querySelector('#reply-label').firstChild.data='Reply');await p.waitForFunction(()=>document.querySelector('#gif-row').inert);
});
test('ordinary GIF posts without comment reply evidence, media and protected/DM controls stay untouched',async t=>{
  const body='<div id="ordinary"><a href="/sample-user/"><img></a><img id="ordinary-gif"><div role="button">like</div><div role="button">comment</div></div><aside>'+gifRow+'</aside><div data-focurve-ui>'+gifRow.replaceAll('gif-row','protected-row')+'</div>';
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body});assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
  assert.equal(await p.locator('#ordinary').evaluate(e=>e.inert),false);
});
test('adjacent other-post reply links and unrelated image controls do not become owned reply sections',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:'<div><div>'+gifRow+'</div><div id="other-section"><div role="button">답글 모두 숨기기</div><ul><a href="/p/different/c/111/">other post</a></ul></div></div><div><div>'+gifRow.replaceAll('gif-row','next-gif')+'</div><div id="ordinary-section"><div role="button">답글 모두 숨기기</div><img></div></div>'});
  await p.evaluate(()=>session.start());
  assert.equal(await p.locator('#other-section').evaluate(e=>e.inert),false);
  assert.equal(await p.locator('#ordinary-section').evaluate(e=>e.inert),false);
});
for(const attribute of ['dir','datetime'])test(`modern DIV ${attribute} eligibility changes automatically restore and restrict the same row`,async t=>{
  const p=await fixture(t,{body:'<main><article>'+modern+'</article></main>'});await p.evaluate(()=>session.start());
  await p.evaluate(attribute=>{const node=attribute==='dir'?document.querySelector('#modern span[dir="auto"]'):document.querySelector('#modern time');if(attribute==='dir')node.setAttribute('dir','ltr');else node.removeAttribute('datetime');},attribute);
  await p.waitForFunction(()=>!document.querySelector('#modern').inert);
  await p.evaluate(attribute=>{if(attribute==='dir')document.querySelector('#modern span[dir="ltr"]').setAttribute('dir','auto');else document.querySelector('#modern time').setAttribute('datetime','2026-01-01');},attribute);
  await p.waitForFunction(()=>document.querySelector('#modern').inert);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
});
test('named comment modal on HOME restricts its list without hiding modal close or nested post caption',async t=>{
  const p=await fixture(t,{url:'https://www.instagram.com/',body:'<div role="dialog" aria-label="Comments"><button id="close">close</button><article><p id="caption">caption</p><ul aria-label="Comments" id="list"><li>comment</li></ul></article></div><main><ul id="feed"><li>feed</li></ul></main>'});
  assert.equal((await p.evaluate(()=>session.start())).restricted_target_count,1);
  assert.equal(await p.locator('#list').evaluate(e=>e.inert),true);
  for(const id of ['#close','#caption','#feed'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
});
test('unlabelled lists without exact comment URLs and mixed protected/media containers are never hidden',async t=>{
  const p=await fixture(t,{body:'<main><article><ul id="caption"><li><a href="/p/sample/">caption</a></li></ul><ul aria-label="Comments" id="mixed"><video></video><li>text</li></ul><ul aria-label="Comments" id="protected"><button data-focurve-ui>exit</button></ul><li id="foreign"><a href="https://example.com/p/sample/c/id/">foreign</a></li><li id="other-post"><a href="/p/different/c/id/">other</a></li></article></main>'});
  assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
  assert.equal(await p.evaluate(()=>ledger.inspect().remaining_targets),0);
});
test('neutral HOME/profile/DM/Stories and foreign hosts do not gain comment effects',async t=>{
  for(const path of ['/','/sample/','/direct/inbox/','/stories/sample/1/']){
    const p=await fixture(t,{url:'https://www.instagram.com'+path});assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
  }
  const p=await fixture(t,{url:'https://example.com/p/sample/'});assert.equal(await p.evaluate(()=>{try{session.start();return false;}catch{return true;}}),true);
});
test('late comments, href selector exit and placeholder changes automatically reconcile',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();document.querySelector('#comment a').href='/p/sample/';document.querySelector('#editor').placeholder='Search';document.querySelector('article ul').insertAdjacentHTML('beforeend','<li id="late"><a href="/p/sample/c/333/">late</a></li>');});
  await p.waitForFunction(()=>!document.querySelector('#comment').inert&&!document.querySelector('#editor').inert&&document.querySelector('#late').inert);
  await p.evaluate(()=>document.querySelector('#editor').placeholder='댓글 달기...');await p.waitForFunction(()=>document.querySelector('#editor').inert);
});
test('semantic list identity changes restore only its own claim with another owner retained',async t=>{
  const p=await fixture(t,{body:'<main><ul id="list" aria-label="Comments"><li>comment</li></ul></main>'});
  await p.evaluate(()=>{session.start();ledger.hide('other',document.querySelector('#list'));document.querySelector('#list').setAttribute('aria-label','Caption');});
  await p.waitForFunction(()=>observations.at(-1).remaining_targets===0);
  assert.equal(await p.locator('#list').evaluate(e=>e.inert),true);await p.evaluate(()=>ledger.release('other'));assert.equal(await p.locator('#list').evaluate(e=>e.inert),false);
});
test('multiple owner and stale session release preserve active replacement and page edits',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();window.other=make({binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();});
  assert.equal(await p.locator('#comment').evaluate(e=>e.inert),true);
  await p.evaluate(()=>{other.release();window.next=make();next.start();session.release();document.querySelector('#comment').style.display='grid';next.scan();next.release();});
  assert.equal(await p.locator('#comment').evaluate(e=>e.style.display),'grid');
});
test('SPA to another post cleans old comments; denied navigation and pagehide prevent new effects',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();history.pushState({},'','/p/other/');session.scan();});assert.equal(await p.locator('#comment').evaluate(e=>e.inert),false);
  await p.evaluate(()=>{allowed=false;history.pushState({},'','/p/sample/');session.scan();});assert.equal(await p.evaluate(()=>invalidations.at(-1).reason),'ROUTE_CHANGED');
  await p.evaluate(()=>{dispatchEvent(new Event('pageshow'));document.querySelector('#comment a').href='/p/sample/c/new/';session.scan();});assert.equal(await p.locator('#comment').evaluate(e=>e.inert),false);
});
test('partial restore stays pending; retry and adopted foreign document preserve ownership',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();window.original=ledger.release.bind(ledger);ledger.release=()=>({restored:false,error_count:1});});
  assert.equal((await p.evaluate(()=>session.release())).restored,false);await p.evaluate(()=>ledger.release=original);assert.equal((await p.evaluate(()=>session.release())).restored,true);
  const r=await p.evaluate(()=>{window.next=make();next.start();const node=document.querySelector('#comment'),foreign=document.implementation.createHTMLDocument();foreign.adoptNode(node);node.style.display='grid';return{r:next.release(),display:node.style.display};});
  assert.equal(r.r.restored,false);assert.equal(r.display,'grid');
});
test('IG-04 adapter and actual TEST popup sender gate provide local results and cleanup',async t=>{
  const p=await fixture(t,{adapter:true});const r=await p.evaluate(()=>session.start());assert.equal(r.features[0].observation.feature_id,'IG-04');assert.equal(r.native_verified,false);assert.equal((await p.evaluate(()=>session.release())).cleanup_pending,false);
  await p.evaluate(()=>{window.chrome={runtime:{id:'test',getURL:p=>location.origin+'/'+p,onMessage:{addListener:f=>window.listener=f}}};});
  await p.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const result=await p.evaluate(async()=>{let leaked=false;listener({type:'TEST_IG_COMMENTS_APPLY'},{id:'test',url:location.href},()=>{leaked=true;});const send=type=>new Promise(resolve=>listener({type},{id:'test',url:chrome.runtime.getURL('popup.html')},resolve));return{leaked,applied:await send('TEST_IG_COMMENTS_APPLY'),released:await send('TEST_IG_COMMENTS_RELEASE')};});
  assert.equal(result.leaked,false);assert.equal(result.applied.result.feature_id,'IG-04');assert.equal(result.released.released.restored,true);
});

test('nested Reels comment owns avatar and comment heart, preserving external video like and close',async t=>{
 const nested=reelRow.replace('<div><a href="/sample-user/"','<div><div><a href="/sample-user/"').replace('</a></div><div><div><div><div>','</a></div></div><div><div><div><div>');
 const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:'<video id="video"></video><button id="video-like">Like</button><div><button id="close">close</button>'+nested+'</div>'});
 await p.evaluate(()=>session.start());
 assert.equal(await p.locator('#reel-row').evaluate(e=>e.inert),true);
 assert.equal(await p.locator('#reel-row svg').evaluate(e=>!!e.closest('[inert]')),true);
 for(const id of ['#video','#video-like','#close'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);
 assert.equal(await p.locator('#reel-row').evaluate(e=>e.inert),false);
});
test('standalone Korean count reply toggles hide dynamically and restore without touching post actions',async t=>{
 const p=await fixture(t,{body:'<main><article><h2>caption</h2><button id="toggle">답글 보기(4개)</button><button id="like">Like</button></article></main>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#toggle').evaluate(e=>e.inert),true);
 await p.evaluate(()=>document.querySelector('#toggle').firstChild.data='Share');await p.waitForFunction(()=>!document.querySelector('#toggle').inert);
 await p.evaluate(()=>document.querySelector('#toggle').firstChild.data='답글 보기(1개)');await p.waitForFunction(()=>document.querySelector('#toggle').inert);
 assert.equal(await p.locator('#like').evaluate(e=>e.inert),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);
});

test('empty Reels comment still hides its complete avatar/time/like/reply row and restores',async t=>{
 const empty=reelRow.replace('<span dir="auto">sample comment</span>','');
 const p=await fixture(t,{url:'https://www.instagram.com/reels/sample/',body:'<video id="video"></video><h2 id="caption">caption</h2><button id="like">Like</button>'+empty});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#reel-row').evaluate(e=>e.inert),true);
 for(const id of ['#video','#caption','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);
 assert.equal(await p.locator('#reel-row').evaluate(e=>e.style.display),'flex');
});

for(const tag of ['li','div role="listitem"']){
 const end=tag.startsWith('li')?'li':'div';
 test(`mixed post ${tag} is not a comment row when its permalink lacks narrower evidence`,async t=>{
  const p=await fixture(t,{body:`<main><${tag} id="post" style="display:grid!important"><img id="photo"><a href="/post-author/" id="author">author</a><p id="caption">post caption</p><button id="like">Like</button><div><a href="/p/sample/c/1/">time</a><span>comment</span></div></${end}></main>`});
  assert.equal((await p.evaluate(()=>session.start())).status,'NO_TARGET');
  for(const id of ['#post','#photo','#author','#caption','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false,id);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.equal(await p.locator('#post').evaluate(e=>e.style.display),'grid');
 });
 test(`mixed post ${tag} restricts only a verified nested comment and restores it`,async t=>{
  const p=await fixture(t,{body:`<main><${tag} id="post"><a href="/post-author/" role="link"><img id="post-avatar"></a><h2 id="author">post author</h2><img id="photo"><p id="caption">post caption</p><button id="like">Like</button>${modern}</${end}></main>`});
  await p.evaluate(()=>session.start());assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);
  for(const id of ['#post','#photo','#post-avatar','#author','#caption','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false,id);
  assert.equal((await p.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await p.locator('#modern').evaluate(e=>[e.style.display,e.inert]),['flex',false]);
 });
}

for(const mode of ['text','hashtag','empty'])test(`preserve baseline structured LI ${mode} comments inside a mixed post`,async t=>{
 let row=modern.replace('<div id="modern"','<li id="modern"').replace(/<\/div>$/,'</li>');
 if(mode==='hashtag')row=row.replace('sample comment','<a href="/explore/tags/sample/">#sample</a>');
 if(mode==='empty')row=row.replace('<span dir="auto">sample comment</span>','');
 const p=await fixture(t,{body:'<main><div role="listitem" id="post"><img id="photo"><h2 id="author">author</h2><p id="caption">caption</p><button id="like">Like</button><ul>'+row+'</ul></div></main>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);
 for(const id of ['#post','#photo','#author','#caption','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 await p.evaluate(()=>ledger.hide('other',document.querySelector('#modern')));assert.equal((await p.evaluate(()=>session.release())).restored,true);
 assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);await p.evaluate(()=>ledger.release('other'));
 assert.deepEqual(await p.locator('#modern').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display'),e.inert]),['flex','important',false]);
});

test('review: a verified LI GIF comment hides the full row without hiding the post image',async t=>{
 const row='<li id="gif-li" style="display:flex!important"><a href="/sample-user/" role="link"><img id="avatar"></a><a href="/sample-user/">author</a><img id="gif-body"><a href="/p/sample/c/901/"><time datetime="2026-01-01">time</time></a><button>Reply</button><button aria-label="Like">Like</button></li>';
 const p=await fixture(t,{body:'<main><div role="listitem" id="post"><h2 id="author">post author</h2><img id="photo"><p id="caption">caption</p><button id="like">Like</button><ul>'+row+'</ul></div></main>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#gif-li').evaluate(e=>e.inert),true);
 for(const id of ['#post','#author','#photo','#caption','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('#gif-li').evaluate(e=>e.style.display),'flex');
});
test('review: hashtag-only DIV comments retain exact row ownership and restore',async t=>{
 const row=modern.replace('sample comment','<a href="/explore/tags/sample/">#sample</a>');
 const p=await fixture(t,{body:'<main><article><h2 id="caption">post caption</h2><img id="photo">'+row+'</article></main>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);
 for(const id of ['#caption','#photo'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('#modern').evaluate(e=>e.style.display),'flex');
});
test('review: unsafe external post ancestor stops expansion without discarding the verified comment',async t=>{
 const p=await fixture(t,{body:'<main><div id="outer"><a role="link" href="/post-user/"><img id="post-avatar"></a><h2 id="caption">post caption</h2><img id="photo"><button id="like">Like</button>'+modern+'</div></main>'});
 await p.evaluate(()=>session.start());assert.equal(await p.locator('#modern').evaluate(e=>e.inert),true);
 for(const id of ['#outer','#post-avatar','#caption','#photo','#like'])assert.equal(await p.locator(id).evaluate(e=>!!e.closest('[inert]')),false);
 assert.equal((await p.evaluate(()=>session.release())).restored,true);assert.equal(await p.locator('#modern').evaluate(e=>e.style.display),'flex');
});
