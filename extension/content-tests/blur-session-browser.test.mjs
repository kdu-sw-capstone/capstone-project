import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>browser?.close());
async function fixture(t){const p=await browser.newPage();t.after(()=>p.close());
  await p.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    await route.fulfill({contentType:path.endsWith('.mjs')?'text/javascript':'text/html',body:path.endsWith('.mjs')?await readFile(new URL('..'+path,import.meta.url)):'<!doctype html><body><h1>page</h1></body>'});});
  await p.goto('https://example.test/');await p.evaluate(async()=>{
    const {BlurSession}=await import('/content/blur-session.mjs');window.BlurSession=BlurSession;window.allowed=true;window.verdict='SENSITIVE';window.calls=0;
    window.profile={id:'fixture',sha256:'b'.repeat(64),level:'HIGH'};
    window.add=async()=>{const canvas=document.createElement('canvas');canvas.width=100;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='red';ctx.fillRect(0,0,100,80);
      const img=document.createElement('img');img.style.cssText='width:100px;height:80px;filter:grayscale(1)!important';img.src=canvas.toDataURL();document.body.append(img);await img.decode();return img;};
    await add();window.make=(extra={})=>new BlurSession(document,{profile,canApply:()=>allowed,classify:async()=>{calls++;return {verdict,profile_sha256:profile.sha256};},...extra});window.session=make();
  });return p;}
test('sensitive local overlay reveals/reblurs without changing original filter; release restores',async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  assert.equal(await p.locator('[data-focurve-ui="blur"]').evaluate(e=>getComputedStyle(e).backdropFilter),'blur(24px)');
  await p.locator('[data-focurve-ui="blur"]').click();assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),false);
  await p.locator('img').click();assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);
  const r=await p.evaluate(()=>({cleanup:session.release(),style:document.querySelector('img').style.cssText,covers:document.querySelectorAll('[data-focurve-ui="blur"]').length}));
  assert.equal(r.cleanup.restored,true);assert.match(r.style,/grayscale\(1\).*important/);assert.equal(r.covers,0);
});
test('external image classifier preserves release fencing and ignores late SAFE',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session=make({classify:()=>{throw Error('UNEXPECTED_CANVAS_PATH');},classifyImage:async(image,{signal})=>{window.source=image.src;return await new Promise(resolve=>window.finish=()=>resolve({verdict:'SAFE',profile_sha256:profile.sha256}));}});session.start();});
  await p.waitForFunction(()=>typeof window.finish==='function');assert.equal(await p.evaluate(()=>session.release().restored),true);
  await p.evaluate(()=>finish());await p.waitForTimeout(50);assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),0);
});
test('site image read failure stays masked and viewport selection can scan newly eligible image',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{window.eligible=false;session=make({selectImage:()=>eligible,classifyImage:async()=>{throw Error('IMAGE_FETCH_FAILED');}});session.start();});
  assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),0);
  await p.evaluate(()=>{eligible=true;dispatchEvent(new Event('scroll'));});await p.waitForFunction(()=>session.inspect().counts.FAILED===1);
  assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);assert.equal(await p.evaluate(()=>session.inspect().failure_reasons.IMAGE_FETCH_FAILED),1);
  assert.equal(await p.evaluate(()=>session.release().restored),true);
});
test('safe image preserves ordinary page click',async t=>{const p=await fixture(t);await p.evaluate(()=>{verdict='SAFE';document.querySelector('img').onclick=()=>window.clicked=true;session.start();});
  await p.waitForFunction(()=>session.inspect().counts.SAFE===1);await p.locator('img').click();assert.equal(await p.evaluate(()=>clicked),true);
});
test('model missing or wrong profile stays failed masked, retry is explicit',async t=>{const p=await fixture(t);await p.evaluate(()=>{session=make({classify:async()=>({verdict:'SAFE',profile_sha256:'a'.repeat(64)})});session.start();});
  await p.waitForFunction(()=>session.inspect().counts.FAILED===1);assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);
  await p.evaluate(()=>{session.release();session=make({classify:undefined});session.start();});await p.waitForFunction(()=>session.inspect().counts.FAILED===1);
});
test('source replacement clears reveal and stale classification cannot clear new mask',async t=>{const p=await fixture(t);await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  await p.locator('[data-focurve-ui="blur"]').click();await p.evaluate(()=>{const c=document.createElement('canvas');c.width=120;c.height=90;document.querySelector('img').src=c.toDataURL();});
  await p.waitForFunction(()=>document.querySelector('[data-focurve-ui="blur"]')?.hidden===false&&session.inspect().counts.SENSITIVE===1);
});
test('late provider completion after release cannot recreate effect',async t=>{const p=await fixture(t);await p.evaluate(()=>{session=make({classify:()=>{window.waiting=true;return new Promise(resolve=>window.finish=resolve);}});session.start();});
  await p.waitForFunction(()=>window.waiting);await p.evaluate(()=>{session.release();finish({verdict:'SENSITIVE',profile_sha256:profile.sha256});});
  await p.waitForTimeout(60);assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),0);
});
test('independent owner layers preserve other restriction',async t=>{const p=await fixture(t);await p.evaluate(()=>{session.start();window.other=make();other.start();});
  await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1&&other.inspect().counts.SENSITIVE===1);
  await p.evaluate(()=>session.release());assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),1);
  assert.equal(await p.evaluate(()=>other.release().restored),true);
});
for(const action of ['revoke','release'])test(`creation ${action} prevents late cover`,async t=>{const p=await fixture(t);const r=await p.evaluate(action=>{
  const create=document.createElement.bind(document);document.createElement=(...args)=>{const el=create(...args);if(args[0]==='button'){if(action==='release')session.release();else allowed=false;}return el;};session.start();document.createElement=create;
  return {covers:document.querySelectorAll('[data-focurve-ui="blur"]').length,calls,state:session.inspect()};
},action);assert.equal(r.covers,0);assert.equal(r.calls,0);assert.equal(r.state.active,false);assert.equal(r.state.cleanup_pending,false);});
test('append reentry and failed removal retain debt until cleanup retry',async t=>{const p=await fixture(t);const r=await p.evaluate(()=>{
  const append=document.documentElement.append.bind(document.documentElement);document.documentElement.append=cover=>{session.release();cover.remove=()=>{throw Error('REMOVE_FAILED');};append(cover);};
  session.start();document.documentElement.append=append;const pending=session.inspect();delete document.querySelector('[data-focurve-ui="blur"]').remove;
  return {pending,cleanup:session.release()};});assert.equal(r.pending.cleanup_pending,true);assert.equal(r.cleanup.restored,true);
});
test('foreign cover cannot be removed under old document authority',async t=>{const p=await fixture(t);const r=await p.evaluate(()=>{session.start();const foreign=document.implementation.createHTMLDocument('foreign');const el=document.querySelector('[data-focurve-ui="blur"]');foreign.body.append(foreign.adoptNode(el));return session.release();});
  assert.equal(r.restored,false);assert.equal(r.cleanup_pending,true);
});
test('timeout and capacity never become safe; revoked scope cannot add images',async t=>{const p=await fixture(t);await p.evaluate(async()=>{await add();session=make({maxTargets:1,timeoutMs:30,classify:()=>new Promise(()=>{})});session.start();});
  await p.waitForFunction(()=>session.inspect().counts.FAILED===1);assert.equal(await p.evaluate(()=>session.inspect().overflow_count),1);
  await p.evaluate(async()=>{allowed=false;await add();session.scan();});assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),1);
  assert.equal(await p.evaluate(()=>session.release().restored),true);
});
test('dynamic images are covered, no default authority and HIGH is mandatory',async t=>{const p=await fixture(t);await p.evaluate(()=>session.start());await p.evaluate(()=>add());
  await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===2);
  const r=await p.evaluate(()=>{session.release();const denied=new BlurSession(document,{profile});return {state:denied.start(),count:document.querySelectorAll('[data-focurve-ui="blur"]').length};});assert.equal(r.state.active,false);assert.equal(r.count,0);
  assert.equal(await p.evaluate(()=>{try{make({profile:{...profile,level:'LOW'}});return false;}catch{return true;}}),true);
});
test('failed classification retries with same pinned profile, old source result is discarded',async t=>{const p=await fixture(t);
  await p.evaluate(()=>{window.attempt=0;session=make({classify:async()=>{if(++attempt===1)throw Error('FAIL');return {verdict:'SAFE',profile_sha256:profile.sha256};}});session.start();});
  await p.waitForFunction(()=>session.inspect().counts.FAILED===1);await p.evaluate(()=>session.retry());await p.waitForFunction(()=>session.inspect().counts.SAFE===1);
  await p.evaluate(()=>{session.release();window.pending=[];session=make({classify:()=>new Promise(resolve=>pending.push(resolve))});session.start();});
  await p.waitForFunction(()=>pending.length===1);
  await p.evaluate(()=>{const c=document.createElement('canvas');c.width=130;c.height=70;document.querySelector('img').src=c.toDataURL();});
  await p.waitForFunction(()=>session.inspect().counts.PENDING===1);
  await p.evaluate(()=>pending[0]({verdict:'SAFE',profile_sha256:profile.sha256}));await p.waitForFunction(()=>pending.length===2);
  assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);
  await p.evaluate(()=>pending[1]({verdict:'SENSITIVE',profile_sha256:profile.sha256}));await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
});
test('pagehide stops new effects and own cleanup remains available',async t=>{const p=await fixture(t);await p.evaluate(()=>session.start());
  const r=await p.evaluate(()=>{dispatchEvent(new Event('pagehide'));return {state:session.inspect(),cleanup:session.release()};});assert.equal(r.state.active,false);assert.equal(r.state.cleanup_pending,true);assert.equal(r.cleanup.restored,true);
});
test('manual local demo uses fixture decisions and restores all layers',async t=>{
  const p=await browser.newPage();t.after(()=>p.close());
  await p.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;await route.fulfill({contentType:path.endsWith('.html')?'text/html':'text/javascript',body:await readFile(new URL('..'+path,import.meta.url))});});
  await p.goto('http://127.0.0.1:4178/content-tools/blur.html');await p.locator('#apply').click();
  await p.waitForFunction(()=>[...document.querySelectorAll('[data-focurve-ui="blur"]')].some(e=>e.textContent.includes('실패')));
  await p.locator('#state').click();const state=JSON.parse(await p.locator('#result').textContent());assert.equal(state.realModel,false);assert.equal(state.first.counts.SAFE,1);assert.equal(state.first.counts.SENSITIVE,1);assert.equal(state.first.counts.FAILED,1);
  await p.locator('#retry').click();await p.waitForFunction(()=>document.querySelectorAll('[data-focurve-ui="blur"]:not([hidden])').length===1);
  await p.locator('#release').click();assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),0);
});

test('deferred analysis resumes without declaring pending images SAFE',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{window.foreground=false;session=make({canAnalyze:()=>foreground});session.start();});
  await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>calls),0);assert.equal(await p.evaluate(()=>session.inspect().counts.PENDING),1);
  await p.evaluate(()=>{foreground=true;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);assert.equal(await p.evaluate(()=>calls),1);
});
test('release cancels pending frame and scan work',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{session.start();dispatchEvent(new Event('scroll'));session.refresh();session.release();});await p.waitForTimeout(220);assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),0);assert.equal(await p.evaluate(()=>session.inspect().active),false);
});

test('image made eligible during another inference is not stranded pending',async t=>{
  const p=await fixture(t);await p.evaluate(async()=>{window.first=document.querySelector('img');window.second=await add();window.foreground=false;window.allowFirst=true;window.firstCalls=0;
    session=make({canAnalyze:()=>foreground,selectImage:image=>image!==first||allowFirst,classifyImage:async image=>{if(image===second)return await new Promise(resolve=>window.finishSecond=()=>resolve({verdict:'SAFE',profile_sha256:profile.sha256}));firstCalls++;return {verdict:'SENSITIVE',profile_sha256:profile.sha256};}});session.start();allowFirst=false;foreground=true;session.scan();});
  await p.waitForFunction(()=>typeof finishSecond==='function');await p.evaluate(()=>{allowFirst=true;session.scan();});await p.waitForTimeout(250);
  await p.evaluate(()=>finishSecond());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);assert.equal(await p.evaluate(()=>firstCalls),1);
});

test('timed-out provider is aborted; explicit retry uses fresh signal and ignores old reply',async t=>{
  const p=await fixture(t);await p.evaluate(()=>{window.signals=[];window.replies=[];session=make({timeoutMs:300,classify:(_canvas,{signal})=>new Promise(resolve=>{signals.push(signal);replies.push(resolve);})});session.start();});
  await p.waitForFunction(()=>session.inspect().counts.FAILED===1);assert.equal(await p.evaluate(()=>signals[0].aborted),true);
  await p.evaluate(()=>session.retry());await p.waitForFunction(()=>signals.length===2);assert.equal(await p.evaluate(()=>signals[1].aborted),false);
  await p.evaluate(()=>replies[0]({verdict:'SAFE',profile_sha256:profile.sha256}));assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);
  await p.evaluate(()=>replies[1]({verdict:'SENSITIVE',profile_sha256:profile.sha256}));await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
});
test('page removing an active cover restores the same mask without repeating classification',async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(()=>{document.querySelector('[data-focurve-ui="blur"]').remove();session.scan();return {covers:document.querySelectorAll('[data-focurve-ui="blur"]').length,calls,state:session.inspect()};});
  assert.equal(result.covers,1);assert.equal(result.calls,1);assert.equal(result.state.counts.SENSITIVE,1);assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);
});
