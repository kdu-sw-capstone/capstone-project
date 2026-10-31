import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const youtube='<ytd-app style="filter:sepia(0.2)"><ytd-masthead>search</ytd-masthead><ytd-watch-flexy><ytd-comments id="comments" style="display:flex!important">comments</ytd-comments><div id="related">related</div><button class="ytp-autonav-toggle-button" aria-checked="true">autoplay</button></ytd-watch-flexy></ytd-app>';
const instagram='<div style="width:300px;height:600px"><img id="photo" alt="" draggable="false" style="display:flex!important"></div><article id="post">post</article>';
async function fixture(t,{html=youtube,url='https://www.youtube.com/watch?v=sample',features=['YT-03','YT-04','YT-09','YT-10']}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html>'+html});});
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async features=>{
    const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');
    const{ClaimLedger}=await import('/content/claim-ledger.mjs');window.ledger=new ClaimLedger(document);
    window.current=true;window.navigationAllowed=false;window.events=[];window.invalidations=[];
    window.options={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      features:features.map(feature_id=>({feature_id,enabled:true,required:true})),isCurrent:()=>current,
      authorizeNavigation:()=>navigationAllowed,onObservation:r=>events.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=override=>new ContentSessionAdapter(document,{...options,...override});window.adapter=make();
    const toggle=document.querySelector('.ytp-autonav-toggle-button');toggle?.addEventListener('click',()=>toggle.setAttribute('aria-checked',toggle.getAttribute('aria-checked')==='true'?'false':'true'));
  },features);return page;
}
test('frozen feature copy composes existing watch, grayscale and autoplay; each releases independently',async t=>{
  const page=await fixture(t);
  const result=await page.evaluate(()=>{options.features[0].enabled=false;const r=adapter.start();r.features.length=0;return adapter.inspect();});
  assert.equal(result.features.length,4);assert.equal(result.native_verified,false);
  assert.equal(await page.locator('#comments').evaluate(e=>e.style.display),'none');
  assert.equal(await page.locator('.ytp-autonav-toggle-button').getAttribute('aria-checked'),'false');
  assert.equal((await page.evaluate(()=>adapter.releaseFeature('YT-03'))).restored,true);
  assert.deepEqual(await page.locator('#comments').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]),['flex','important']);
  assert.equal(await page.locator('#related').evaluate(e=>e.style.display),'none');
  assert.match(await page.locator('ytd-app').evaluate(e=>e.style.filter),/grayscale/);
  await page.evaluate(()=>adapter.releaseFeature('YT-09'));
  assert.equal(await page.locator('ytd-app').evaluate(e=>e.style.filter),'sepia(0.2)');
  assert.equal(await page.locator('#related').evaluate(e=>e.style.display),'none');
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
  assert.equal(await page.locator('.ytp-autonav-toggle-button').getAttribute('aria-checked'),'true');
});
test('two owners preserve last claims; retired adapter cannot release a new binding',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{adapter.start();window.other=make({binding_id:'00000000-0000-4000-8000-000000000003'});other.start();adapter.release();});
  assert.equal(await page.locator('#comments').evaluate(e=>e.style.display),'none');
  assert.match(await page.locator('ytd-app').evaluate(e=>e.style.filter),/grayscale/);
  await page.evaluate(()=>{other.release();window.next=make();next.start();adapter.release();});
  assert.equal(await page.locator('#comments').evaluate(e=>e.style.display),'none');
  assert.equal((await page.evaluate(()=>next.release())).cleanup_pending,false);
});
test('malformed/duplicate/unsupported/cross-host options and absent authority fail before any DOM effect',async t=>{
  const page=await fixture(t);
  const errors=await page.evaluate(()=>[
    {isCurrent:null},{features:[{feature_id:'YT-02',enabled:true,required:true}]},
    {features:[options.features[0],options.features[0]]},
    {features:[{feature_id:'YT-03',enabled:'true',required:true}]},
    {features:[{feature_id:'IG-01',enabled:true,required:true}]},
  ].map(o=>{try{make(o);return null;}catch(e){return e.message;}}));
  assert.ok(errors.every(Boolean));assert.equal(await page.locator('#comments').evaluate(e=>e.style.display),'flex');
  for(const check of ['false','throw','promise'])assert.equal(await page.evaluate(check=>{try{make({isCurrent:()=>{if(check==='throw')throw Error('no');return check==='promise'?Promise.resolve(true):false;}}).start();return false;}catch(e){return e.message==='CURRENT_AUTHORITY_REJECTED';}},check),true);
});
test('authority generation changes fence automatic mutations across watch/grayscale/autoplay without cleanup erasure',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{adapter.start();current=false;document.body.insertAdjacentHTML('beforeend','<ytd-app id="late-app">late</ytd-app>');document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend','<ytd-comments id="late-comments">late</ytd-comments>');});
  await page.waitForFunction(()=>adapter.inspect().closed);
  assert.equal(await page.locator('#late-comments').evaluate(e=>e.style.display),'');
  assert.equal(await page.locator('#late-app').evaluate(e=>e.style.filter),'');
  const stale=await page.evaluate(()=>{current=true;document.querySelector('.ytp-autonav-toggle-button').setAttribute('aria-checked','true');return adapter.inspect();});
  assert.equal(stale.cleanup_pending,true);await page.waitForTimeout(40);
  assert.equal(await page.locator('.ytp-autonav-toggle-button').getAttribute('aria-checked'),'true');
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
});
test('pagehide/pageshow never revives old document authority and a fresh adapter waits for cleanup',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{adapter.start();window.dispatchEvent(new Event('pagehide'));window.dispatchEvent(new Event('pageshow'));let duplicate;try{make().start();}catch(e){duplicate=e.message;}return{state:adapter.inspect(),duplicate};});
  assert.equal(r.state.closed,true);assert.equal(r.duplicate,'CONTENT_SCOPE_CLEANUP_REQUIRED');
  await page.evaluate(()=>document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend','<ytd-comments id="new">new</ytd-comments>'));
  await page.waitForTimeout(30);assert.equal(await page.locator('#new').evaluate(e=>e.style.display),'');
  await page.evaluate(()=>{adapter.release();window.fresh=make();fresh.start();});
  assert.equal(await page.locator('#new').evaluate(e=>e.style.display),'none');
});
test('partial restore is feature-specific and retryable and prevents scope replacement',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{adapter.start();const c=document.querySelector('#comments');window.set=c.style.setProperty.bind(c.style);c.style.setProperty=(n,v,p)=>{if(n==='display'&&v==='flex')throw Error('restore');set(n,v,p);};});
  const failed=await page.evaluate(()=>adapter.release());assert.deepEqual(failed.pending_features,['YT-03']);
  assert.equal(await page.locator('ytd-app').evaluate(e=>e.style.filter),'sepia(0.2)');
  assert.equal(await page.evaluate(()=>{try{make().start();return false;}catch(e){return e.message;}}),'CONTENT_SCOPE_CLEANUP_REQUIRED');
  await page.evaluate(()=>document.querySelector('#comments').style.setProperty=set);
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
});
test('startup failure rolls back prior effects and returns explicit error; failed rollback keeps debt',async t=>{
  const page=await fixture(t,{url:'https://www.youtube.com/results',features:['YT-09','YT-10']});
  const r=await page.evaluate(()=>adapter.start());
  assert.match(r.startup_error,/UNSUPPORTED/);assert.equal(r.cleanup_pending,false);
  assert.equal(await page.locator('ytd-app').evaluate(e=>e.style.filter),'sepia(0.2)');
  const failed=await fixture(t,{url:'https://www.youtube.com/results',features:['YT-09','YT-10']});
  const debt=await failed.evaluate(()=>{const app=document.querySelector('ytd-app'),set=app.style.setProperty.bind(app.style);app.style.setProperty=(n,v,p)=>{if(n==='filter'&&v==='sepia(0.2)')throw Error('restore');set(n,v,p);};return adapter.start();});
  assert.match(debt.startup_error,/UNSUPPORTED/);assert.deepEqual(debt.pending_features,['YT-09']);
});
test('callback errors are reported and cannot strand observers or hide cleanup',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{window.bad=make({onObservation:()=>{throw Error('delivery');},onInvalidated:()=>{throw Error('delivery');}});bad.start();bad.invalidate();return bad.release();});
  assert.ok(r.callback_error_count>0);assert.equal(r.cleanup_pending,false);
});
test('IG adapter reuses stories selector and requires explicit same-document SPA approval',async t=>{
  const page=await fixture(t,{html:instagram,url:'https://www.instagram.com/stories/sample/1/',features:['IG-01']});
  await page.evaluate(()=>{navigationAllowed=true;adapter.start();history.pushState({},'','/profile/');window.dispatchEvent(new Event('popstate'));});
  await page.waitForFunction(()=>document.querySelector('#photo').style.display==='flex');
  assert.equal(await page.evaluate(()=>adapter.inspect().closed),false);
  await page.evaluate(()=>{history.pushState({},'','/stories/another/2/');window.dispatchEvent(new Event('popstate'));});
  await page.waitForFunction(()=>document.querySelector('#photo').style.display==='none');
  await page.evaluate(()=>{navigationAllowed=false;history.pushState({},'','/stories/third/3/');window.dispatchEvent(new Event('popstate'));});
  await page.waitForFunction(()=>adapter.inspect().closed);
  assert.equal(await page.locator('#photo').evaluate(e=>e.style.display),'flex');
  assert.equal(await page.locator('#post').isVisible(),true);
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
});
test('IG replay guard checks current authority even without a DOM mutation',async t=>{
  const page=await fixture(t,{html:'<main><video id="video"></video></main>',url:'https://www.instagram.com/stories/sample/1/',features:['IG-01']});
  const r=await page.evaluate(()=>{const v=document.querySelector('#video');window.pauses=0;v.pause=()=>pauses++;Object.defineProperty(v,'paused',{get:()=>true});adapter.start();const before=pauses;current=false;v.dispatchEvent(new Event('play'));return{before,after:pauses,state:adapter.inspect()};});
  assert.equal(r.after,r.before);assert.equal(r.state.closed,true);assert.equal(r.state.cleanup_pending,true);
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
});
test('foreign-document adopted node retains unresolved cleanup without mutating its new owner',async t=>{
  const page=await fixture(t,{html:instagram,url:'https://www.instagram.com/stories/sample/1/',features:['IG-01']});
  const r=await page.evaluate(()=>{adapter.start();const foreign=document.implementation.createHTMLDocument(),node=document.querySelector('#photo');foreign.adoptNode(node);node.style.display='grid';const state=adapter.release();return{state,display:node.style.display};});
  assert.deepEqual(r.state.pending_features,['IG-01']);assert.equal(r.display,'grid');
});
test('a new browser document has no inherited adapter or automatic reapplication',async t=>{
  const page=await fixture(t);await page.evaluate(()=>adapter.start());await page.reload();
  assert.equal(await page.evaluate(()=>typeof window.adapter),'undefined');
  assert.equal(await page.locator('#comments').evaluate(e=>e.style.display),'flex');
});
test('all nine existing non-Shorts YouTube sessions dispatch through the adapter and disabled options stay off',async t=>{
  const ids=['YT-01','YT-03','YT-04','YT-05','YT-06','YT-07','YT-08','YT-09','YT-10'];
  const page=await fixture(t,{features:ids});const r=await page.evaluate(()=>adapter.start());
  assert.equal(r.startup_error,null);assert.deepEqual(r.features.map(f=>f.feature_id).sort(),ids);
  assert.ok(r.features.every(f=>f.observation?.feature_id===f.feature_id));
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
  await page.evaluate(()=>{window.disabled=make({features:options.features.map(f=>({...f,enabled:false}))});disabled.start();});
  assert.equal(await page.locator('#comments').evaluate(e=>e.style.display),'flex');
  assert.equal(await page.locator('ytd-app').evaluate(e=>e.style.filter),'sepia(0.2)');
});
for(const field of ['session','generation','document'])test(`caller ${field} fence change closes old session; cleanup does not require new authority`,async t=>{
  const page=await fixture(t,{features:['YT-03']});
  const r=await page.evaluate(field=>{
    const issued={session:'s1',generation:1,document};window.liveScope={...issued};
    window.bound=make({isCurrent:()=>Object.keys(issued).every(k=>issued[k]===liveScope[k])});bound.start();
    liveScope[field]=field==='generation'?2:field==='document'?document.implementation.createHTMLDocument():'s2';
    document.querySelector('ytd-watch-flexy').insertAdjacentHTML('beforeend','<ytd-comments id="late">late</ytd-comments>');return true;
  },field);assert.equal(r,true);
  await page.waitForFunction(()=>bound.inspect().closed);
  assert.equal(await page.locator('#late').evaluate(e=>e.style.display),'');
  assert.equal((await page.evaluate(()=>bound.release())).cleanup_pending,false);
});
test('a second ledger cannot bypass the same-document adapter scope fence',async t=>{
  const page=await fixture(t);assert.equal(await page.evaluate(async()=>{const{ClaimLedger}=await import('/content/claim-ledger.mjs');try{make({ledger:new ClaimLedger(document)});return false;}catch(e){return e.message;}}),'SHARED_LEDGER_REQUIRED');
});

for(const kind of ['watch','navigation','instagram','grayscale'])for(const mode of ['invalidate','immediate-release'])test(`P2 ${kind}: ${mode} during a setter stops next target/property and retains retryable cleanup`,async t=>{
  const ig=kind==='instagram',id=ig?'IG-01':kind==='watch'?'YT-03':kind==='grayscale'?'YT-09':'YT-07';
  const page=await fixture(t,{html:ig?'<main></main>':'<ytd-watch-flexy></ytd-watch-flexy>',url:ig?'https://www.instagram.com/stories/sample/1/':'https://www.youtube.com/watch?v=sample',features:[id]});
  await page.evaluate(({kind,mode})=>{
    window.revoked=false;window.lateWrites=0;window.inner=null;
    adapter=make({onInvalidated:()=>{if(mode==='immediate-release')inner=adapter.release();}});adapter.start();
    const tag=kind==='watch'?'ytd-comments':kind==='navigation'?'ytd-masthead':kind==='grayscale'?'ytd-app':'img';
    window.first=document.createElement(tag);window.second=document.createElement(tag);
    first.style.display='flex';second.style.display='grid';
    if(kind==='grayscale')first.style.filter='brightness(0.8)';
    const property=kind==='grayscale'?'filter':'display';
    const set=first.style.setProperty.bind(first.style);first.style.setProperty=(n,v,p)=>{set(n,v,p);if(n===property&&(kind==='grayscale'?v.includes('grayscale'):v==='none')&&!revoked){revoked=true;adapter.invalidate('CORE_REVOKED');}};
    let inert=false;Object.defineProperty(first,'inert',{get:()=>inert,set:v=>{if(revoked&&v===true)lateWrites++;inert=v;}});
    const setSecond=second.style.setProperty.bind(second.style);second.style.setProperty=(n,v,p)=>{if(revoked&&n===property&&(kind==='grayscale'?v.includes('grayscale'):v==='none'))lateWrites++;setSecond(n,v,p);};
    (kind==='instagram'?document.querySelector('main'):document.querySelector('ytd-watch-flexy')).append(first,second);
  },{kind,mode});
  await page.waitForFunction(()=>revoked);
  const r=await page.evaluate(()=>({state:adapter.inspect(),inner,lateWrites,second:second.style.display,debt:ledger.inspect()}));
  assert.equal(r.lateWrites,0);assert.equal(r.second,'grid');assert.equal(r.state.cleanup_pending,true);assert.equal(r.debt.remaining_targets,1);
  if(mode==='immediate-release'){assert.equal(r.inner.cleanup_pending,true);assert.equal(r.inner.features[0].cleanup.scan_pending,true);}
  const retried=await page.evaluate(()=>({state:adapter.release(),debt:ledger.inspect(),display:first.style.display}));
  assert.equal(retried.state.cleanup_pending,false);assert.equal(retried.debt.remaining_targets,0);assert.equal(retried.display,'flex');
  if(kind==='grayscale')assert.equal(await page.evaluate(()=>first.style.filter),'brightness(0.8)');
});

test('P2 partial cleanup after mid-scan release remains pending until real retry and preserves another owner',async t=>{
  const page=await fixture(t,{html:'<ytd-watch-flexy></ytd-watch-flexy>',features:['YT-03']});
  await page.evaluate(()=>{
    window.revoked=false;adapter=make({onInvalidated:()=>adapter.release()});adapter.start();
    window.first=document.createElement('ytd-comments');first.style.setProperty('display','flex','important');
    const foreign=document.createElement('div');document.body.append(foreign);window.foreign=foreign;ledger.hide('other-owner',foreign);
    const set=first.style.setProperty.bind(first.style);window.failRestore=true;
    first.style.setProperty=(n,v,p)=>{if(n==='display'&&v==='flex'&&failRestore){set(n,'block',p);throw Error('partial cleanup');}set(n,v,p);if(n==='display'&&v==='none'&&!revoked){revoked=true;adapter.invalidate();}};
    document.querySelector('ytd-watch-flexy').append(first);
  });await page.waitForFunction(()=>revoked);
  const failed=await page.evaluate(()=>adapter.release());assert.equal(failed.cleanup_pending,true);assert.equal(failed.features[0].cleanup.restored,false);
  const r=await page.evaluate(()=>{failRestore=false;const state=adapter.release();return{state,debt:ledger.inspect(),foreign:foreign.style.display,display:first.style.display,priority:first.style.getPropertyPriority('display')};});
  assert.equal(r.state.cleanup_pending,false);assert.equal(r.debt.remaining_targets,1);assert.equal(r.foreign,'none');assert.equal(r.display,'flex');assert.equal(r.priority,'important');
});

test('P2 releaseFeature during scan fences that feature immediately while other features continue',async t=>{
  const page=await fixture(t,{html:'<ytd-watch-flexy></ytd-watch-flexy>',features:['YT-03','YT-04']});
  await page.evaluate(()=>{adapter.start();window.inner=null;const a=document.createElement('ytd-comments'),b=document.createElement('ytd-comments'),related=document.createElement('div');b.id='late-comment';related.id='related';const set=a.style.setProperty.bind(a.style);a.style.setProperty=(n,v,p)=>{set(n,v,p);if(n==='display'&&v==='none'&&!inner)inner=adapter.releaseFeature('YT-03');};document.querySelector('ytd-watch-flexy').append(a,b,related);});
  await page.waitForFunction(()=>inner!==null);assert.equal(await page.evaluate(()=>inner.restored),false);
  assert.equal(await page.evaluate(()=>adapter.inspect().features.find(f=>f.feature_id==='YT-03').active),false);
  assert.equal(await page.locator('#late-comment').evaluate(e=>e.style.display),'');assert.equal(await page.locator('#related').evaluate(e=>e.style.display),'none');
  assert.equal((await page.evaluate(()=>adapter.releaseFeature('YT-03'))).restored,true);
  assert.equal(await page.locator('#related').evaluate(e=>e.style.display),'none');assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);
});

for(const cancel of ['pagehide','spa','authority'])test(`P2 native autoplay click/${cancel} stops subsequent OFF transitions and supports cleanup retry`,async t=>{
  const page=await fixture(t,{html:'<ytd-watch-flexy></ytd-watch-flexy>',features:['YT-10']});
  await page.evaluate(cancel=>{window.revoked=false;window.afterOff=0;window.inner=null;adapter=make({onInvalidated:()=>{inner=adapter.release();}});adapter.start();
    for(let i=0;i<2;i++){const b=document.createElement('button');b.id='toggle-'+i;b.className='ytp-autonav-toggle-button';b.setAttribute('aria-checked','true');b.addEventListener('click',()=>{
      const next=b.getAttribute('aria-checked')==='true'?'false':'true';b.setAttribute('aria-checked',next);
      if(next==='false'&&revoked)afterOff++;
      if(i===0&&next==='false'&&!revoked){revoked=true;if(cancel==='pagehide')window.dispatchEvent(new Event('pagehide'));else if(cancel==='spa')history.pushState({},'','/watch?v=next');else current=false;}
    });document.querySelector('ytd-watch-flexy').append(b);}
  },cancel);await page.waitForFunction(()=>revoked&&adapter.inspect().closed);
  assert.equal(await page.evaluate(()=>afterOff),0);assert.equal(await page.locator('#toggle-1').getAttribute('aria-checked'),'true');
  assert.equal(await page.evaluate(()=>inner.cleanup_pending),true);
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);assert.equal(await page.locator('#toggle-0').getAttribute('aria-checked'),'true');
});

test('P2 IG pause callback pagehide prevents the next media pause and keeps cleanup pending',async t=>{
  const page=await fixture(t,{html:'<main></main>',url:'https://www.instagram.com/stories/sample/1/',features:['IG-01']});
  await page.evaluate(()=>{window.firstPauses=0;window.secondPauses=0;window.inner=null;adapter=make({onInvalidated:()=>{inner=adapter.release();}});adapter.start();
    for(let i=0;i<2;i++){const v=document.createElement('video');Object.defineProperty(v,'paused',{get:()=>true});v.pause=()=>{if(i===0){firstPauses++;window.dispatchEvent(new Event('pagehide'));}else secondPauses++;};document.querySelector('main').append(v);}
  });await page.waitForFunction(()=>firstPauses===1);
  assert.equal(await page.evaluate(()=>secondPauses),0);assert.equal(await page.evaluate(()=>inner.cleanup_pending),true);
  assert.equal((await page.evaluate(()=>adapter.release())).cleanup_pending,false);assert.equal(await page.evaluate(()=>ledger.inspect().remaining_targets),0);
});
