import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const FEATURES=['IG-01'];
async function fixture(t,{feature='IG-01',home=false,features=[feature]}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html><main></main>'});});
  const p=await context.newPage();await p.goto('https://www.instagram.com'+(home?'/':feature==='IG-01'?'/stories/sample/1/':'/reel/sample/'));
  await p.evaluate(async features=>{
    const{ContentSessionAdapter}=await import('/content/session-adapter.mjs');const{ClaimLedger}=await import('/content/claim-ledger.mjs');
    window.ledger=new ClaimLedger(document);window.current=true;window.events=[];window.invalidations=[];
    window.adapter=new ContentSessionAdapter(document,{ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',
      features:features.map(feature_id=>({feature_id,enabled:true,required:true})),isCurrent:()=>current,authorizeNavigation:()=>true,
      onObservation:r=>events.push(r),onInvalidated:r=>invalidations.push(r)});
    adapter.start();window.baseline=events.length;window.calls=[0,0];
    window.media=(id,index)=>{const m=document.createElement('video');m.id=id;m.stopped=true;Object.defineProperty(m,'paused',{get(){return this.stopped;}});m.pause=function(){calls[index]++;this.stopped=true;};return m;};
  },features);return p;
}
for(const feature of FEATURES){
  test(`${feature} releaseFeature during first pause fences next pause and success observation while preserving cleanup/other owner`,async t=>{
    const p=await fixture(t,{feature});
    await p.evaluate(feature=>{const first=media('first',0),second=media('second',1);
      first.pause=function(){calls[0]++;ledger.hide('other-owner',this);window.pending=adapter.releaseFeature(feature);window.returned=true;};
      document.querySelector('main').append(first,second);},feature);
    await p.waitForFunction(()=>window.returned);
    const r=await p.evaluate(()=>({calls,state:adapter.inspect(),pending,events:events.length,baseline,invalidations:invalidations.length}));
    assert.deepEqual(r.calls,[1,0]);assert.equal(r.state.closed,false);assert.equal(r.state.features[0].active,false);
    assert.equal(r.pending.restored,false);assert.equal(r.pending.cleanup_pending,true);assert.equal(r.events,r.baseline);assert.equal(r.invalidations,0);
    assert.equal((await p.evaluate(feature=>adapter.releaseFeature(feature),feature)).restored,true);
    assert.equal(await p.evaluate(()=>ledger.inspect().remaining_targets),1);assert.equal(await p.locator('#first').evaluate(e=>e.style.display),'none');
    await p.evaluate(()=>ledger.release('other-owner'));assert.equal(await p.evaluate(()=>ledger.inspect().remaining_targets),0);
  });
  test(`${feature} release in replay pause is local, retains pending and rejects subsequent replay`,async t=>{
    const p=await fixture(t,{feature});await p.evaluate(()=>document.querySelector('main').append(media('first',0)));
    await p.waitForFunction(()=>calls[0]>0);
    await p.evaluate(feature=>{calls[0]=0;const m=document.querySelector('#first');m.pause=function(){calls[0]++;window.pending=adapter.releaseFeature(feature);};m.dispatchEvent(new Event('play'));m.dispatchEvent(new Event('play'));},feature);
    const r=await p.evaluate(()=>({calls,state:adapter.inspect(),pending,invalidations:invalidations.length}));
    assert.equal(r.calls[0],1);assert.equal(r.state.closed,false);assert.equal(r.pending.restored,false);assert.equal(r.pending.cleanup_pending,true);assert.equal(r.invalidations,0);
    assert.equal((await p.evaluate(feature=>adapter.releaseFeature(feature),feature)).restored,true);
  });
  test(`${feature} failed post-scan cleanup remains pending and retry preserves the original restoration`,async t=>{
    const p=await fixture(t,{feature});await p.evaluate(feature=>{const first=media('first',0);first.style.display='flex';first.pause=()=>{adapter.releaseFeature(feature);window.returned=true;};document.querySelector('main').append(first);},feature);
    await p.waitForFunction(()=>window.returned);
    await p.evaluate(()=>{window.realRelease=ledger.release.bind(ledger);ledger.release=()=>({restored:false,remaining_targets:1,error_count:1});});
    assert.equal((await p.evaluate(feature=>adapter.releaseFeature(feature),feature)).restored,false);
    assert.equal(await p.evaluate(()=>adapter.inspect().cleanup_pending),true);
    await p.evaluate(()=>ledger.release=realRelease);assert.equal((await p.evaluate(feature=>adapter.releaseFeature(feature),feature)).restored,true);
    assert.equal(await p.locator('#first').evaluate(e=>e.style.display),'flex');
  });
}
