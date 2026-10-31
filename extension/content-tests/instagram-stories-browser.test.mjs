import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
test('IG portrait frame becomes eligible when its descendant leaves editable mode without a manual scan',async t=>{
  const html='<div style="width:300px;height:600px"><img id="editable-photo" alt="" draggable="false" style="display:flex!important"><span id="editor" contenteditable="true">caption</span></div>';
  const page=await fixture(t,{html,url:'https://www.instagram.com/stories/sample/1/'});
  assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.locator('#editor').evaluate(e=>e.setAttribute('contenteditable','false'));
  await page.waitForFunction(()=>document.querySelector('#editable-photo').style.display==='none',null,{timeout:2000});
  assert.equal(await page.evaluate(()=>observations.at(-1).restricted_target_count),1);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.deepEqual(await page.locator('#editable-photo').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['flex','important']);
});
test('IG portrait frame becoming editable retires only its own claim and preserves another owner',async t=>{
  const html='<div style="width:300px;height:600px"><img id="editable-photo" alt="" draggable="false" style="display:flex!important"><span id="editor" contenteditable="false">caption</span></div>';
  const page=await fixture(t,{html,url:'https://www.instagram.com/stories/sample/1/'});
  assert.equal((await page.evaluate(()=>session.start())).restricted_target_count,1);
  await page.evaluate(()=>ledger.hide('other-owner',document.querySelector('#editable-photo')));
  await page.locator('#editor').evaluate(e=>e.setAttribute('contenteditable','true'));
  await page.waitForFunction(()=>observations.at(-1).remaining_targets===0,null,{timeout:2000});
  assert.equal(await page.evaluate(()=>observations.at(-1).status),'NO_TARGET');
  assert.equal(await page.locator('#editable-photo').evaluate(e=>e.style.display),'none');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal((await page.evaluate(()=>ledger.release('other-owner'))).restored,true);
  assert.deepEqual(await page.locator('#editable-photo').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['flex','important']);
});
for(const [attribute,ineligible,eligible]of [['alt','loading',''],['draggable','true','false']]){
  test(`IG-01 observes ${attribute} eligibility changes without manual scan and restores display priority`,async t=>{
    const html='<div style="width:300px;height:600px"><img id="dynamic-photo" alt="" draggable="false" style="display:flex!important"></div>';
    const page=await fixture(t,{html,url:'https://www.instagram.com/stories/sample/1/'});
    await page.evaluate(({attribute,ineligible})=>document.querySelector('#dynamic-photo').setAttribute(attribute,ineligible),{attribute,ineligible});
    assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
    await page.evaluate(({attribute,eligible})=>document.querySelector('#dynamic-photo').setAttribute(attribute,eligible),{attribute,eligible});
    await page.waitForFunction(()=>document.querySelector('#dynamic-photo').style.display==='none',null,{timeout:2000});
    assert.equal(await page.evaluate(()=>observations.at(-1).restricted_target_count),1);
    await page.evaluate(({attribute,ineligible})=>document.querySelector('#dynamic-photo').setAttribute(attribute,ineligible),{attribute,ineligible});
    await page.waitForFunction(()=>document.querySelector('#dynamic-photo').style.display==='flex',null,{timeout:2000});
    assert.equal(await page.locator('#dynamic-photo').evaluate(e=>e.style.getPropertyPriority('display')),'important');
    assert.equal(await page.evaluate(()=>observations.at(-1).remaining_targets),0);

    // Re-entry, then selector exit while an independent owner still hides the node.
    await page.evaluate(({attribute,eligible})=>document.querySelector('#dynamic-photo').setAttribute(attribute,eligible),{attribute,eligible});
    await page.waitForFunction(()=>document.querySelector('#dynamic-photo').style.display==='none');
    await page.evaluate(()=>ledger.hide('independent-owner',document.querySelector('#dynamic-photo')));
    await page.evaluate(({attribute,ineligible})=>document.querySelector('#dynamic-photo').setAttribute(attribute,ineligible),{attribute,ineligible});
    await page.waitForFunction(()=>observations.at(-1).remaining_targets===0,null,{timeout:2000});
    assert.equal(await page.locator('#dynamic-photo').evaluate(e=>e.style.display),'none');
    assert.equal((await page.evaluate(()=>session.release())).restored,true);
    assert.equal(await page.locator('#dynamic-photo').evaluate(e=>e.style.display),'none');
    assert.equal((await page.evaluate(()=>ledger.release('independent-owner'))).restored,true);
    assert.deepEqual(await page.locator('#dynamic-photo').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['flex','important']);
  });
}
test('authorized intermediate story index/profile alias must not close observation before a valid story',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();});
  for(const path of ['/stories/','/_u/sample/','/explore/']){
    await page.evaluate(path=>{history.pushState({},'',path);session.scan();},path);
    assert.equal(await page.evaluate(()=>invalidations.length),0);
    assert.equal(await page.evaluate(()=>observations.at(-1).status),'NO_TARGET');
  }
  await page.evaluate(html=>{history.pushState({},'','/stories/another/123/');document.body.innerHTML=html;session.scan();},viewer);
  assert.equal(await page.evaluate(()=>observations.at(-1).media_stopped_if_route_block),true);assert.equal(await page.locator('#story-video').evaluate(e=>e.style.display),'none');
});
test('TEST invalidation errors retain reason/build/document identity instead of hiding the failure stage',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:p=>location.origin+'/'+p,onMessage:{addListener:fn=>{window.listener=fn;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const send=type=>page.evaluate(type=>new Promise(resolve=>listener({type},{id:'test-extension',url:chrome.runtime.getURL('popup.html')},resolve)),type);
  const before=await send('TEST_IG_STORIES_APPLY');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  const after=await send('TEST_IG_STORIES_APPLY');assert.match(after.error,/OLD_SCOPE_CLEANUP_REQUIRED/);assert.equal(after.invalidated.reason,'PAGEHIDE');assert.equal(after.test_build,'ig-stories-nav-3');assert.equal(after.document_instance_id,before.document_instance_id);assert.equal(after.page_kind,'HOME');
  assert.equal((await send('TEST_IG_STORIES_RELEASE')).released.restored,true);
});
test('one activation survives home to profile to another story without another APPLY',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session=make({...settings,authorizeNavigation:()=>true});session.start();});
  await page.evaluate(()=>{history.pushState({},'','/sample/');document.body.innerHTML='<main><article id="profile-post">post<video id="profile-video"></video></article></main>';window.dispatchEvent(new Event('popstate'));});
  await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET',null,{timeout:3000});
  assert.equal(await page.evaluate(()=>invalidations.length),0);assert.equal(await page.locator('#profile-post').isVisible(),true);
  await page.evaluate(html=>{history.pushState({},'','/stories/sample/123/');document.body.innerHTML=html;window.dispatchEvent(new Event('popstate'));},viewer);
  await page.waitForFunction(()=>document.querySelector('#story-video').style.display==='none');
  await page.evaluate(html=>{history.pushState({},'','/stories/another/456/');document.body.innerHTML=html;window.dispatchEvent(new Event('popstate'));},viewer);
  await page.waitForFunction(()=>document.querySelector('#story-video').style.display==='none');
  assert.equal(await page.evaluate(()=>observations.at(-1).media_stopped_if_route_block),true);assert.equal(await page.evaluate(()=>invalidations.length),0);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#story-video').evaluate(e=>e.style.display),'block');
});
test('TEST popup retains one active scope through profile and does not require cleanup before story APPLY',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:p=>location.origin+'/'+p,onMessage:{addListener:fn=>{window.listener=fn;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const send=type=>page.evaluate(type=>new Promise(resolve=>listener({type},{id:'test-extension',url:chrome.runtime.getURL('popup.html')},resolve)),type);
  assert.equal((await send('TEST_IG_STORIES_APPLY')).result.status,'OBSERVED');
  await page.evaluate(()=>{history.pushState({},'','/sample/');document.body.innerHTML='<main><article>profile post</article></main>';window.dispatchEvent(new Event('popstate'));});
  await page.waitForTimeout(30);const neutral=await send('TEST_IG_STORIES_STATE');assert.equal(neutral.invalidated,null);assert.equal(neutral.result.status,'NO_TARGET');
  assert.equal((await send('TEST_IG_STORIES_APPLY')).error,undefined);
  await page.evaluate(html=>{history.pushState({},'','/stories/another/');document.body.innerHTML=html;window.dispatchEvent(new Event('popstate'));},viewer);
  await page.waitForFunction(()=>document.querySelector('#story-video').style.display==='none');
  const active=await send('TEST_IG_STORIES_APPLY');assert.equal(active.error,undefined);assert.equal(active.result.media_stopped_if_route_block,true);assert.equal(active.invalidated,null);
  assert.equal((await send('TEST_IG_STORIES_RELEASE')).released.restored,true);
});
test('a failed restore while leaving home still closes new effects and retains cleanup obligation',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{
    session=make({...settings,authorizeNavigation:()=>true});session.start();const node=document.querySelector('#story');window.restoreWrite=node.style.setProperty.bind(node.style);node.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='inline')throw Error('failure');restoreWrite(name,value,priority);};
    history.pushState({},'','/sample/');window.dispatchEvent(new Event('popstate'));
  });await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>invalidations[0].reason),'ROUTE_CLEANUP_FAILED');
  await page.evaluate(html=>{history.pushState({},'','/stories/another/');document.body.insertAdjacentHTML('beforeend',html);window.dispatchEvent(new Event('popstate'));},viewer);
  assert.equal(await page.locator('#story-video').evaluate(e=>e.style.display),'block');
  assert.equal((await page.evaluate(()=>session.release())).restored,false);await page.evaluate(()=>document.querySelector('#story').style.setProperty=restoreWrite);assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
test('deeply nested real-viewer shape finds video without treating avatar/control as story media',async t=>{
  // Anonymized structural reproduction of the second user-supplied section.
  const nested='<div>'.repeat(11)+'<video id="deep-video" style="display:block"></video>'+'</div>'.repeat(11);
  const html='<section><div style="height:700.8px;width:394.2px"><a role="link" style="height:32px;width:32px"><img id="avatar" alt="" draggable="false" width="32" height="32"></a><div style="height:700.8px;width:394.2px">'+nested+'<div role="group"></div></div><button id="close">close</button></div></section>';
  const page=await fixture(t,{html,url:'https://www.instagram.com/stories/sample/'});
  const r=await page.evaluate(()=>{const v=document.querySelector('#deep-video');window.deepPaused=false;v.pause=()=>{deepPaused=true;};Object.defineProperty(v,'paused',{get:()=>deepPaused});const result=session.start();deepPaused=false;v.dispatchEvent(new Event('play'));return{result,paused:deepPaused};});
  assert.equal(r.result.eligible_target_count,1);assert.equal(r.result.media_target_count,1);assert.equal(r.result.media_stopped_if_route_block,true);assert.equal(r.paused,true);
  assert.equal(await page.locator('#deep-video').isVisible(),false);assert.equal(await page.locator('#avatar').isVisible(),true);assert.equal(await page.locator('#close').isVisible(),true);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#deep-video').evaluate(e=>e.style.display),'block');
});
test('plain sized div story photo without main/dialog is restricted and restored',async t=>{
  const html='<div style="height:700.8px;width:394.2px"><div style="top:0"><img id="plain-photo" draggable="false" alt="" width="100" height="180"></div></div><nav id="close">close</nav><article><img id="post" alt="post" width="50" height="50"></article>';
  const page=await fixture(t,{html,url:'https://www.instagram.com/stories/sample/'});
  assert.equal((await page.evaluate(()=>session.start())).restricted_target_count,1);
  assert.equal(await page.locator('#plain-photo').isVisible(),false);assert.equal(await page.locator('#post').isVisible(),true);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#plain-photo').isVisible(),true);
});
test('plain sized video viewer pauses/rejects replay while a protected post stays untouched',async t=>{
  const html='<div style="height:700px;width:394px"><div><video id="plain-video"></video></div></div><article><div style="height:700px;width:394px"><video id="post-video"></video></div></article>';
  const page=await fixture(t,{html,url:'https://www.instagram.com/stories/sample/1/'});
  const r=await page.evaluate(()=>{let stopped=false;const v=document.querySelector('#plain-video');Object.defineProperty(v,'paused',{get:()=>stopped});v.pause=()=>{stopped=true;};const result=session.start();stopped=false;v.dispatchEvent(new Event('play'));return{result,stopped,post:document.querySelector('#post-video').style.display};});
  assert.equal(r.result.media_target_count,1);assert.equal(r.result.media_stopped_if_route_block,true);assert.equal(r.stopped,true);assert.equal(r.post,'');assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
const home='<main><div id="tray"><a id="story" href="/stories/alice/123/" style="display:inline"><img></a><a id="other-story" href="https://www.instagram.com/stories/bob/">bob</a></div><article><a id="post-story" href="/stories/post/">post link</a><video id="post-video"></video></article><a id="profile" href="/alice/">profile</a><a id="external" href="https://instagram.com.evil.test/stories/a/">external</a></main><nav><a href="/direct/inbox/" id="dm">DM</a></nav><aside data-focurve-ui><a href="/stories/protected/" id="exit">exit</a></aside>';
const viewer='<main><header><img id="avatar" width="20" height="20"></header><div role="presentation"><img id="photo" width="20" height="20" style="display:block"><video id="story-video" style="display:block"></video></div><button id="close">close</button><article><video id="post-video"></video></article></main><nav id="dm">DM</nav><aside data-focurve-ui id="exit">exit</aside>';
async function fixture(t,{html=home,url='https://www.instagram.com/'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+html});});
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{const{ClaimLedger}=await import('/content/claim-ledger.mjs'),{InstagramStoriesSession}=await import('/content/instagram-stories.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=options=>new InstagramStoriesSession(document,options);window.session=make(settings);
  });return page;
}
test('IG-01 hides home story entries only; DM/posts/profile/FOCURVE remain usable',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>session.start());assert.equal(r.feature_id,'IG-01');assert.equal(r.status,'OBSERVED');assert.equal(r.restricted_target_count,2);assert.equal(r.native_verified,false);
  assert.equal(await page.locator('#story').isVisible(),false);
  for(const s of ['#post-story','#profile','#external','#dm','#exit'])assert.equal(await page.locator(s).isVisible(),true);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('#story').evaluate(e=>e.style.display),'inline');
});
test('direct story media hide/pause while close/navigation and ordinary posts survive',async t=>{
  const page=await fixture(t,{html:viewer,url:'https://www.instagram.com/stories/alice/123/'});
  const r=await page.evaluate(()=>{
    const v=document.querySelector('#story-video');window.stopped=false;window.pauses=0;
    Object.defineProperty(v,'paused',{get:()=>stopped});v.pause=()=>{stopped=true;pauses++;};
    const result=session.start();stopped=false;v.dispatchEvent(new Event('play',{bubbles:false}));
    return{result,stopped,pauses};
  });assert.equal(r.result.status,'OBSERVED');assert.equal(r.result.media_target_count,1);assert.equal(r.result.media_stopped_if_route_block,true);assert.equal(r.stopped,true);assert.equal(r.pauses,2);
  for(const s of ['#photo','#story-video'])assert.equal(await page.locator(s).isVisible(),false);
  for(const s of ['#avatar','#close','#dm','#exit'])assert.equal(await page.locator(s).isVisible(),true);
  assert.equal(await page.locator('#post-video').evaluate(e=>e.style.display),'');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  const released=await page.evaluate(()=>{stopped=false;document.querySelector('#story-video').dispatchEvent(new Event('play'));return{stopped,pauses};});assert.deepEqual(released,{stopped:false,pauses:2});
});
test('media pause failure reports FAILED and never a successful route restriction',async t=>{
  const page=await fixture(t,{html:viewer,url:'https://www.instagram.com/stories/alice/123/'});
  const r=await page.evaluate(()=>{const v=document.querySelector('#story-video');Object.defineProperty(v,'paused',{get:()=>false});v.pause=()=>{};return session.start();});
  assert.equal(r.status,'FAILED');assert.equal(r.media_stopped_if_route_block,false);assert.equal(r.error_count,1);
});
test('late links, reused hrefs and replaced DOM reconcile without observer loop',async t=>{
  const page=await fixture(t,{html:'<main id="main"></main>'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(()=>document.querySelector('main').innerHTML='<a id="late" href="/stories/alice/1/">late</a>');await page.waitForFunction(()=>observations.at(-1).status==='OBSERVED');
  await page.evaluate(()=>document.querySelector('#late').href='/alice/');await page.waitForFunction(()=>document.querySelector('#late').style.display==='');
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
test('shared owners and retired sessions preserve the last active claim',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{
    session.start();let duplicate='';try{make(settings).start();}catch(e){duplicate=e.message;}
    const other=make({...settings,binding_id:'00000000-0000-4000-8000-000000000003'});other.start();session.release();const shared=document.querySelector('#story').style.display;other.release();
    const next=make(settings);next.start();session.release();const retained=document.querySelector('#story').style.display;next.release();return{duplicate,shared,retained,remaining:ledger.inspect()};
  });assert.equal(r.duplicate,'INSTAGRAM_STORIES_SCOPE_ALREADY_ACTIVE');assert.equal(r.shared,'none');assert.equal(r.retained,'none');assert.equal(r.remaining.remaining_targets,0);
});
test('partial restoration keeps original goal and fences a replacement until retry',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{
    session.start();const node=document.querySelector('#story'),write=node.style.setProperty.bind(node.style);
    node.style.setProperty=(name,value,priority)=>{if(name==='display'&&value==='inline'){write(name,'grid');throw Error('partial');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{make(settings).start();}catch(e){blocked=e.message;}node.style.setProperty=write;const retried=session.release();return{failed,blocked,retried,display:node.style.display};
  });assert.equal(r.failed.restored,false);assert.equal(r.blocked,'INSTAGRAM_STORIES_SCOPE_ALREADY_ACTIVE');assert.equal(r.retried.restored,true);assert.equal(r.display,'inline');
});
test('SPA is authorized explicitly and leaving to DM restores old effects without restricting DM',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session.start();history.pushState({},'','/stories/alice/123/');window.dispatchEvent(new Event('popstate'));});
  await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.locator('#story').evaluate(e=>e.style.display),'inline');
  await page.evaluate(html=>{session.release();history.replaceState({},'','/');session=make({...settings,authorizeNavigation:()=>true});session.start();document.querySelector('main').remove();document.body.insertAdjacentHTML('afterbegin',html);history.pushState({},'','/stories/alice/123/');window.dispatchEvent(new Event('popstate'));},viewer);
  await page.waitForFunction(()=>document.querySelector('#photo').style.display==='none');
  await page.evaluate(()=>{history.pushState({},'','/direct/inbox/');window.dispatchEvent(new Event('popstate'));});await page.waitForFunction(()=>observations.at(-1).status==='NO_TARGET');
  assert.equal(await page.locator('#photo').evaluate(e=>e.style.display),'block');assert.equal(await page.locator('#dm').first().isVisible(),true);
  assert.equal(await page.evaluate(()=>invalidations.length),1); // first unapproved transition only
});
test('pagehide prevents automatic BFCache resumption; old document cleanup remains possible',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session.start();window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pageshow'));document.querySelector('main').insertAdjacentHTML('beforeend','<a id="new" href="/stories/new/1/">new</a>');});
  assert.equal(await page.locator('#new').evaluate(e=>e.style.display),'');assert.equal(await page.evaluate(()=>invalidations.at(-1).reason),'PAGEHIDE');assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
test('foreign-document cleanup never removes the new owner protection',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{session.start();const node=document.querySelector('#story'),foreign=document.implementation.createHTMLDocument();foreign.adoptNode(node);node.style.display='grid';const result=session.release();return{result,display:node.style.display};});
  assert.equal(r.result.restored,false);assert.equal(r.display,'grid');
});
test('neutral profile/DM/post pages keep zero effects; login/foreign hosts remain unsupported',async t=>{
  for(const url of ['https://www.instagram.com/sample/','https://www.instagram.com/direct/inbox/','https://www.instagram.com/p/x/']){
    const page=await fixture(t,{url});const r=await page.evaluate(()=>({result:session.start(),remaining:ledger.inspect().remaining_targets}));assert.equal(r.result.status,'NO_TARGET');assert.equal(r.remaining,0);assert.equal((await page.evaluate(()=>session.release())).restored,true);
  }
  for(const url of ['https://www.instagram.com/accounts/login/','https://www.youtube.com/','https://instagram.com.evil.test/']){
    const page=await fixture(t,{url});const r=await page.evaluate(()=>{let error='';try{session.start();}catch(e){error=e.message;}return{error,remaining:ledger.inspect().remaining_targets};});
    assert.equal(r.error,'UNSUPPORTED_INSTAGRAM_STORIES_DOCUMENT');assert.equal(r.remaining,0);
  }
});
test('TEST popup sender gate and release use actual shared ledger without Core success',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:p=>location.origin+'/'+p,onMessage:{addListener:fn=>{window.listener=fn;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const r=await page.evaluate(async()=>{const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;listener({type:'TEST_IG_STORIES_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));const applied=await send('TEST_IG_STORIES_APPLY'),released=await send('TEST_IG_STORIES_RELEASE');return{leaked,applied,released};});
  assert.equal(r.leaked,false);assert.equal(r.applied.coreConnected,false);assert.equal(r.applied.result.feature_id,'IG-01');assert.equal(r.released.released.restored,true);
});

// Sanitized user-supplied DOM shape: no account names, CDN URLs or volatile classes.
const modernTray='<div role="presentation" data-interactable="|click|"><ul><li style="width:1px"></li><li><div id="modern-read" role="button" tabindex="0" aria-label="sample-one님의 스토리, 읽음"><canvas width="112" height="112"></canvas><span role="link"><img width="74" height="74"></span><span>sample-one</span></div></li><li><div id="modern-unread" role="button" tabindex="0" aria-label="sample-two님의 스토리, 확인하지 않음"><canvas width="112" height="112"></canvas><span role="link"><img width="74" height="74"></span><span>sample-two</span></div></li></ul></div>';
test('sanitized modern story buttons without href are restricted and restored',async t=>{
  const page=await fixture(t,{html:modernTray+home});const result=await page.evaluate(()=>session.start());
  assert.equal(result.restricted_target_count,4);
  for(const id of ['#modern-read','#modern-unread'])assert.equal(await page.locator(id).isVisible(),false);
  for(const id of ['#profile','#post-story','#dm','#exit'])assert.equal(await page.locator(id).isVisible(),true);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  for(const id of ['#modern-read','#modern-unread'])assert.equal(await page.locator(id).isVisible(),true);
});
test('modern shape is scoped to story labels/list structure, reacts to reused labels and protects nested UI',async t=>{
  const html=modernTray+'<ul><li><div id="profile-button" role="button" aria-label="sample님의 프로필"><canvas></canvas><span role="link"><img></span>profile</div></li></ul><article>'+modernTray.replaceAll('modern-','post-')+'</article><aside>'+modernTray.replaceAll('modern-','dm-')+'</aside>';
  const page=await fixture(t,{html});await page.evaluate(()=>session.start());
  assert.equal(await page.locator('#modern-read').isVisible(),false);
  assert.equal(await page.locator('#profile-button').isVisible(),true);
  assert.equal(await page.locator('#post-read').isVisible(),true);assert.equal(await page.locator('#dm-read').isVisible(),true);
  await page.evaluate(()=>document.querySelector('#modern-read').setAttribute('aria-label','sample님의 프로필'));
  await page.waitForFunction(()=>document.querySelector('#modern-read').style.display==='');
  await page.evaluate(()=>document.querySelector('#modern-unread').insertAdjacentHTML('beforeend','<button data-focurve-ui id="nested-exit">exit</button>'));
  await page.waitForFunction(()=>document.querySelector('#modern-unread').style.display==='');assert.equal(await page.locator('#nested-exit').isVisible(),true);
});
