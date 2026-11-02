import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>browser?.close());
async function fixture(t,path='/results?search_query=gaming'){
  const page=await browser.newPage();t.after(()=>page.close());
  await page.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(p))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+p,import.meta.url))});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><body style="display:flex!important"><main>content gaming</main><video></video><audio></audio><input value="gaming"></body>'});
  });
  await page.goto('https://www.youtube.com'+path);
  await page.evaluate(async()=>{
    const [{ClaimLedger},{KeywordSession}]=await Promise.all([import('/content/claim-ledger.mjs'),import('/content/keyword-session.mjs')]);
    window.ledger=new ClaimLedger(document);window.pauses=0;window.replay=false;window.allowed=true;window.approved=true;
    for(const media of document.querySelectorAll('video,audio')){
      Object.defineProperty(media,'paused',{configurable:true,get:()=>!window.replay});
      media.pause=()=>{window.pauses++;window.replay=false;};
    }
    window.create=()=>new KeywordSession(document,{ledger,owner_binding_id:crypto.randomUUID(),binding_id:crypto.randomUUID(),canApply:()=>allowed,authorizeNavigation:()=>approved,
      policy:{enabled:true,match_profile:'URL_BOUNDARY_1',scope:'FOCUS_FROZEN',terms:['gaming'],exceptions:[]}});
    window.session=create();
  });return page;
}
test('matching URL hides content and stops media; release restores priority without autoplay',async t=>{
  const p=await fixture(t);const result=await p.evaluate(()=>{const r=session.start();const hidden=getComputedStyle(document.body).display==='none'&&document.body.inert;
    const before=pauses,cleanup=session.release();return {r,hidden,before,after:pauses,cleanup,display:document.body.style.display,priority:document.body.style.getPropertyPriority('display'),inert:document.body.inert,notice:!!document.querySelector('[data-focurve-ui="keyword"]')};});
  assert.equal(result.r.status,'RESTRICTED_LOCAL');assert.equal(result.hidden,true);assert.equal(result.before,2);assert.equal(result.after,2);assert.equal(result.cleanup.restored,true);
  assert.equal(result.display,'flex');assert.equal(result.priority,'important');assert.equal(result.inert,false);assert.equal(result.notice,false);
});
test('body/title/input alone cannot block',async t=>{
  const p=await fixture(t,'/watch?v=ordinary');const r=await p.evaluate(()=>{document.title='gaming';session.start();return session.inspect();});
  assert.equal(r.result.matched,false);assert.equal(r.cleanup_pending,false);
});
test('authorized SPA match and unmatch reconcile automatically, another owner remains hidden',async t=>{
  const p=await fixture(t,'/watch?v=ordinary');await p.evaluate(()=>{session.start();history.pushState({},'','/results?search_query=gaming');dispatchEvent(new Event('yt-navigate-finish'));});
  await p.waitForFunction(()=>session.inspect().result?.status==='RESTRICTED_LOCAL');
  await p.evaluate(()=>{ledger.hide('other-owner',document.body);history.pushState({},'','/watch?v=ordinary');dispatchEvent(new Event('yt-navigate-finish'));});
  await p.waitForFunction(()=>session.inspect().result?.matched===false);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.body).display),'none');
  assert.equal(await p.evaluate(()=>session.inspect().cleanup_pending),false);
  assert.equal(await p.evaluate(()=>{session.release();return ledger.release('other-owner').restored;}),true);
});
test('late media is restricted, replay guard is removed on release',async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());
  await p.evaluate(()=>{const v=document.createElement('video');v.id='late';v.pause=()=>{window.latePaused=true;};document.body.append(v);});
  await p.waitForFunction(()=>window.latePaused===true);
  const r=await p.evaluate(()=>{window.replay=true;document.querySelector('video').dispatchEvent(new Event('play'));const blocked=!replay;session.release();window.replay=true;document.querySelector('video').dispatchEvent(new Event('play'));return {blocked,released:replay};});
  assert.deepEqual(r,{blocked:true,released:true});
});
test('body replacement retains old restoration obligations and releases both bodies',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();window.oldBody=document.body;const next=document.createElement('body');next.style.display='grid';document.body.replaceWith(next);});
  await p.waitForFunction(()=>document.body.inert===true);
  const r=await p.evaluate(()=>{const cleanup=session.release();return {cleanup,old:oldBody.style.display,next:document.body.style.display};});
  assert.equal(r.cleanup.restored,true);assert.equal(r.old,'flex');assert.equal(r.next,'grid');
});
test('invalid URL encoding retains old restriction and replay protection until explicit release',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>{session.start();history.pushState({},'','/results?q=%FF');session.scan();window.replay=true;document.querySelector('video').dispatchEvent(new Event('play'));return {r:session.inspect(),replay,hidden:getComputedStyle(document.body).display,cleanup:session.release()};});
  assert.equal(r.r.result.status,'UNCONFIRMED');assert.equal(r.replay,false);assert.equal(r.hidden,'none');assert.equal(r.cleanup.restored,true);
});
test('invalidation never auto-restores; original cleanup remains and new effects stop',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>{session.start();allowed=false;session.scan();const state=session.inspect();return {state,hidden:getComputedStyle(document.body).display,cleanup:session.release()};});
  assert.equal(r.state.active,false);assert.equal(r.state.cleanup_pending,true);assert.equal(r.hidden,'none');assert.equal(r.cleanup.restored,true);
});
test('unapproved navigation and pagehide fence old session; explicit cleanup still works',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>{session.start();approved=false;history.pushState({},'','/watch?v=new');session.scan();const state=session.inspect();allowed=true;session.scan();return {state,cleanup:session.release()};});
  assert.equal(r.state.active,false);assert.equal(r.state.cleanup_pending,true);assert.equal(r.cleanup.restored,true);
  const next=await p.evaluate(()=>{session=create();history.replaceState({},'','/results?search_query=gaming');session.start();dispatchEvent(new Event('pagehide'));return {active:session.inspect().active,cleanup:session.release()};});
  assert.equal(next.active,false);assert.equal(next.cleanup.restored,true);
});
test('failed media pause is FAILED, and reentrant release stops all later pauses',async t=>{
  const p=await fixture(t);let r=await p.evaluate(()=>{document.querySelector('video').pause=()=>{throw Error('DENIED');};return session.start();});assert.equal(r.status,'FAILED');
  r=await p.evaluate(()=>{session.release();session=create();window.nextPaused=0;document.querySelector('video').pause=()=>session.release();document.querySelector('audio').pause=()=>window.nextPaused++;session.start();return {nextPaused,active:session.inspect().active,remaining:session.inspect().cleanup_pending};});
  assert.equal(r.nextPaused,0);assert.equal(r.active,false);assert.equal(r.remaining,false);
});
test('restore setter failure retains debt and original restoration goal for retry',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>{session.start();const set=document.body.style.setProperty.bind(document.body.style);document.body.style.setProperty=(k,v,priority)=>{if(k==='display'&&v==='flex'){set(k,'grid',priority);throw Error('PARTIAL');}return set(k,v,priority);};
    const failed=session.release();document.body.style.setProperty=set;const retry=session.release();return {failed,retry,display:document.body.style.display,priority:document.body.style.getPropertyPriority('display')};});
  assert.equal(r.failed.restored,false);assert.equal(r.failed.cleanup_pending,true);assert.equal(r.retry.restored,true);assert.equal(r.display,'flex');assert.equal(r.priority,'important');
});
test('foreign document adoption cannot remove another document notice; cleanup remains pending',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>{session.start();const foreign=document.implementation.createHTMLDocument('foreign');const notice=document.querySelector('[data-focurve-ui="keyword"]');foreign.body.append(foreign.adoptNode(notice));const cleanup=session.release();return {cleanup,noticeKept:notice.parentNode===foreign.body,pending:session.inspect().cleanup_pending};});
  assert.equal(r.cleanup.restored,false);assert.equal(r.noticeKept,true);assert.equal(r.pending,true);
});

for(const action of ['revoke','release'])test(`notice creation ${action} fences late overlay and media effects`,async t=>{
  const p=await fixture(t);const r=await p.evaluate(action=>{
    const createElement=document.createElement.bind(document);
    document.createElement=(...args)=>{const element=createElement(...args);if(args[0]==='aside'){
      if(action==='release')session.release();else window.allowed=false;
    }return element;};
    session.start();document.createElement=createElement;
    return {notice:!!document.querySelector('[data-focurve-ui="keyword"]'),pauses,display:document.body.style.display,state:session.inspect()};
  },action);
  assert.equal(r.notice,false);assert.equal(r.pauses,0);assert.equal(r.display,'flex');
  assert.equal(r.state.active,false);assert.equal(r.state.cleanup_pending,false);
});

test('release during append removes late notice; failed removal stays pending until retry',async t=>{
  const p=await fixture(t);const r=await p.evaluate(()=>{
    const append=document.documentElement.append.bind(document.documentElement);
    document.documentElement.append=(notice)=>{session.release();notice.remove=()=>{throw Error('REMOVE_FAILED');};append(notice);};
    session.start();document.documentElement.append=append;
    const state=session.inspect(),notice=document.querySelector('[data-focurve-ui="keyword"]');
    const failed=session.release();delete notice.remove;
    const retry=session.release();
    return {state,failed,retry,pauses,notice:!!document.querySelector('[data-focurve-ui="keyword"]')};
  });
  assert.equal(r.state.active,false);assert.equal(r.state.cleanup_pending,true);
  assert.equal(r.failed.restored,false);assert.equal(r.failed.cleanup_pending,true);
  assert.equal(r.retry.restored,true);assert.equal(r.retry.cleanup_pending,false);
  assert.equal(r.pauses,0);assert.equal(r.notice,false);
});
