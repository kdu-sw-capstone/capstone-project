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

for(const loss of ['false','throw','promise'])test(`observed ${loss} authority loss retires pending blur across later permission recovery`,async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{
    window.authorityMode='current';window.analysisCalls=0;
    session=make({canApply:()=>{
      if(authorityMode==='throw')throw Error('AUTHORITY_LOOKUP_FAILED');
      if(authorityMode==='promise')return Promise.resolve(true);
      return authorityMode==='current';
    },classify:()=>{analysisCalls++;return new Promise(resolve=>window.finishOld=resolve);}});
    session.start();
  });
  await p.waitForFunction(()=>typeof finishOld==='function');
  await p.evaluate(loss=>{authorityMode=loss;finishOld({verdict:'SAFE',profile_sha256:profile.sha256});},loss);
  // Let the old completion observe the missing synchronous authority.
  await p.waitForTimeout(60);
  const retired=await p.evaluate(()=>session.inspect());
  await p.evaluate(async()=>{authorityMode='current';await add();session.scan();});
  const result=await p.evaluate(()=>({state:session.inspect(),calls:analysisCalls,covers:document.querySelectorAll('[data-focurve-ui="blur"]').length}));
  assert.equal(retired.active,false);
  assert.equal(retired.cleanup_pending,true);
  assert.equal(result.state.active,false);
  assert.equal(result.calls,1);
  assert.equal(result.covers,1);
  assert.equal(await p.evaluate(()=>session.release().restored),true);
});

test('authority retirement keeps failed cleanup and a separately authorized successor layer',async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(()=>{
    const own=document.querySelector('[data-focurve-ui="blur"]');
    allowed=false;own.click();
    const retired=session.inspect();
    own.remove=()=>{};
    const failed=session.release();
    allowed=true;window.successor=make();successor.start();
    delete own.remove;
    const retry=session.release();
    return {retired,failed,retry,covers:document.querySelectorAll('[data-focurve-ui="blur"]').length,successor:successor.inspect(),style:document.querySelector('img').style.cssText};
  });
  assert.equal(result.retired.active,false);
  assert.equal(result.failed.cleanup_pending,true);
  assert.equal(result.retry.restored,true);
  assert.equal(result.covers,1);
  assert.equal(result.successor.active,true);
  assert.match(result.style,/grayscale\(1\).*important/);
  assert.equal(await p.evaluate(()=>successor.release().restored),true);
});

test('authority callback release cannot return true to restart its own retired session',async t=>{
  const p=await fixture(t);
  const result=await p.evaluate(()=>{
    let checks=0;
    session=make({canApply:()=>{if(++checks===2)session.release();return true;}});
    session.start();
    return {state:session.inspect(),calls,covers:document.querySelectorAll('[data-focurve-ui="blur"]').length};
  });
  assert.equal(result.state.active,false);
  assert.equal(result.state.cleanup_pending,false);
  assert.equal(result.calls,0);
  assert.equal(result.covers,0);
});

for(const method of ['pushState','replaceState'])test(`SPA ${method} round trip retires the old analysis even when URL returns before its reply`,async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{session=make({classify:()=>new Promise(resolve=>window.oldRouteReply=resolve)});session.start();});
  await p.waitForFunction(()=>typeof oldRouteReply==='function');
  const transition=await p.evaluate(method=>{
    if(!window.navigation)throw Error('NAVIGATION_API_REQUIRED_FOR_FIXTURE');
    const before=location.href;
    history[method]({},'','/other-route');
    const afterLeaving=session.inspect();
    history[method]({},'',before);
    oldRouteReply({verdict:'SAFE',profile_sha256:profile.sha256});
    return afterLeaving;
  },method);
  await p.waitForTimeout(60);
  const result=await p.evaluate(()=>({state:session.inspect(),image:session.inspectImage(document.querySelector('img')),cleanup:session.release()}));
  assert.equal(transition.active,false);
  assert.equal(transition.cleanup_pending,true);
  assert.equal(result.state.active,false);
  assert.notEqual(result.image.status,'SAFE');
  assert.equal(result.cleanup.restored,true);
});

for(const method of ['pushState','replaceState'])test(`same-URL ${method} state update preserves the currently authorized session`,async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());
  await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(method=>{
    history[method]({ui:'only'},'',location.href);
    return {state:session.inspect(),cleanup:session.release()};
  },method);
  assert.equal(result.state.active,true);
  assert.equal(result.state.counts.SENSITIVE,1);
  assert.equal(result.cleanup.restored,true);
});

test('persisted pagehide/pageshow never resumes old blur; cleanup retry preserves a new session',async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{session=make({classify:()=>new Promise(resolve=>window.bfcacheReply=resolve)});session.start();});
  await p.waitForFunction(()=>typeof bfcacheReply==='function');
  const state=await p.evaluate(()=>{
    const oldCover=document.querySelector('[data-focurve-ui="blur"]');
    dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
    oldCover.remove=()=>{};const failed=session.release();
    dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));
    window.successor=make();successor.start();
    bfcacheReply({verdict:'SAFE',profile_sha256:profile.sha256});
    delete oldCover.remove;
    const retry=session.release();
    return {failed,retry,old:session.inspect(),style:document.querySelector('img').style.cssText};
  });
  await p.waitForFunction(()=>successor.inspect().counts.SENSITIVE===1);
  assert.equal(state.failed.cleanup_pending,true);
  assert.equal(state.retry.restored,true);
  assert.equal(state.old.active,false);
  assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),1);
  assert.match(state.style,/grayscale\(1\).*important/);
  assert.equal(await p.evaluate(()=>successor.release().restored),true);
});

test('generation fence change retires old blur while the new generation keeps its own layer',async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{window.generation=1;session=make({canApply:()=>generation===1,classify:()=>new Promise(resolve=>window.generationReply=resolve)});session.start();});
  await p.waitForFunction(()=>typeof generationReply==='function');
  await p.evaluate(()=>{generation=2;session.scan();window.successor=make({canApply:()=>generation===2});successor.start();generationReply({verdict:'SAFE',profile_sha256:profile.sha256});});
  await p.waitForFunction(()=>successor.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(()=>({old:session.inspect(),cleanup:session.release(),count:document.querySelectorAll('[data-focurve-ui="blur"]').length}));
  assert.equal(result.old.active,false);assert.equal(result.cleanup.restored,true);assert.equal(result.count,1);
  assert.equal(await p.evaluate(()=>successor.release().restored),true);
});

test('late model result cannot alter an image adopted by another document',async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{session=make({classify:()=>new Promise(resolve=>window.foreignReply=resolve)});session.start();});
  await p.waitForFunction(()=>typeof foreignReply==='function');
  await p.evaluate(()=>{
    const frame=document.createElement('iframe');document.body.append(frame);
    window.foreignDocument=frame.contentDocument;
    foreignDocument.body.append(foreignDocument.adoptNode(document.querySelector('img')));
    foreignReply({verdict:'SENSITIVE',profile_sha256:profile.sha256});
    session.scan();
  });
  const result=await p.evaluate(()=>({
    ownCovers:document.querySelectorAll('[data-focurve-ui="blur"]').length,
    foreignCovers:foreignDocument.querySelectorAll('[data-focurve-ui="blur"]').length,
    style:foreignDocument.querySelector('img').style.cssText,
    cleanup:session.release()
  }));
  assert.equal(result.ownCovers,0);assert.equal(result.foreignCovers,0);
  assert.match(result.style,/grayscale\(1\).*important/);assert.equal(result.cleanup.restored,true);
});

for(const entry of ['release','replace-target'])test(`cleanup ${entry} reentry never removes the same cover twice or reports nested completion`,async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(async entry=>{
    const old=document.querySelector('img'),cover=document.querySelector('[data-focurve-ui="blur"]'),remove=cover.remove.bind(cover);
    let calls=0,nested;
    cover.remove=()=>{calls++;if(calls===1)nested=session.release();remove();};
    if(entry==='release')session.release();
    else {old.remove();await add();session.scan();}
    return {calls,nested,state:session.inspect(),covers:document.querySelectorAll('[data-focurve-ui="blur"]').length};
  },entry);
  assert.equal(result.calls,1);
  assert.equal(result.nested.restored,false);
  assert.equal(result.nested.cleanup_pending,true);
  assert.equal(result.state.active,false);
  assert.equal(result.state.cleanup_pending,false);
  assert.equal(result.covers,0);
});

for(const change of ['src','srcset','node'])test(`late SAFE for replaced ${change} cannot clear the replacement mask`,async t=>{
  const p=await fixture(t);
  await p.evaluate(()=>{window.targetReplies=[];session=make({classify:()=>new Promise(resolve=>targetReplies.push(resolve))});session.start();});
  await p.waitForFunction(()=>targetReplies.length===1);
  await p.evaluate(async change=>{
    const old=document.querySelector('img'),canvas=document.createElement('canvas');canvas.width=123;canvas.height=91;
    if(change==='node'){const replacement=old.cloneNode();replacement.src=canvas.toDataURL();old.replaceWith(replacement);await replacement.decode();}
    else {old[change]=canvas.toDataURL();await old.decode();}
    session.scan();
    targetReplies[0]({verdict:'SAFE',profile_sha256:profile.sha256});
  },change);
  await p.waitForFunction(()=>targetReplies.length===2);
  assert.equal(await p.locator('[data-focurve-ui="blur"]').count(),1);
  assert.equal(await p.locator('[data-focurve-ui="blur"]').isVisible(),true);
  await p.evaluate(()=>targetReplies[1]({verdict:'SENSITIVE',profile_sha256:profile.sha256}));
  await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(()=>({cleanup:session.release(),style:document.querySelector('img').style.cssText}));
  assert.equal(result.cleanup.restored,true);assert.match(result.style,/grayscale\(1\).*important/);
});

test('failed reentrant cleanup retries only its own layer after successor starts',async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(()=>{
    const cover=document.querySelector('[data-focurve-ui="blur"]');let calls=0,nested;
    cover.remove=()=>{calls++;if(calls===1){nested=session.release();window.successor=make();successor.start();}throw Error('REMOVE_FAILED');};
    const failed=session.release();delete cover.remove;const retry=session.release();
    return {calls,nested,failed,retry,covers:document.querySelectorAll('[data-focurve-ui="blur"]').length};
  });
  assert.equal(result.calls,1);assert.equal(result.nested.cleanup_pending,true);assert.equal(result.failed.restored,false);
  assert.equal(result.retry.restored,true);assert.equal(result.covers,1);
  await p.waitForFunction(()=>successor.inspect().counts.SENSITIVE===1);
  assert.equal(await p.evaluate(()=>successor.release().restored),true);
});

test('SPA departure and DOM replacement during cleanup never create effects in the old session',async t=>{
  const p=await fixture(t);await p.evaluate(()=>session.start());await p.waitForFunction(()=>session.inspect().counts.SENSITIVE===1);
  const result=await p.evaluate(()=>{
    const old=document.querySelector('img'),cover=document.querySelector('[data-focurve-ui="blur"]'),remove=cover.remove.bind(cover);
    let nested,calls=0;cover.remove=()=>{calls++;if(calls===1){history.pushState({},'','/next');old.replaceWith(old.cloneNode());nested=session.release();}remove();};
    session.release();session.scan();
    return {calls,nested,state:session.inspect(),covers:document.querySelectorAll('[data-focurve-ui="blur"]').length};
  });
  assert.equal(result.calls,1);assert.equal(result.nested.restored,false);assert.equal(result.state.active,false);
  assert.equal(result.state.cleanup_pending,false);assert.equal(result.covers,0);
});
