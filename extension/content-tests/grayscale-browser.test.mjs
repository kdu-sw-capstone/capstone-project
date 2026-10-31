import test,{before,after}from'node:test';
import assert from'node:assert/strict';
import{createRequire}from'node:module';
import{readFile}from'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const body='<ytd-app style="--original:none;filter:var(--original)"><ytd-masthead>logo</ytd-masthead><main><video id="video"></video><button id="play">play</button><div id="comments">comments</div><img id="thumb"></main></ytd-app><aside data-focurve-ui id="exit">FOCURVE</aside>';
async function fixture(t,{html=body,url='https://www.youtube.com/watch?v=x'}={}){
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
    else await route.fulfill({contentType:'text/html',body:'<!doctype html>'+html});
  });
  const page=await context.newPage();await page.goto(url);
  await page.evaluate(async()=>{
    const{ClaimLedger}=await import('/content/claim-ledger.mjs'),{GrayscaleSession}=await import('/content/grayscale.mjs');
    window.ledger=new ClaimLedger(document);window.observations=[];window.invalidations=[];
    window.settings={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
    window.make=options=>new GrayscaleSession(document,options);window.session=make(settings);
  });return page;
}
test('YT-09 applies a real computed filter, preserves media/control and restores CSS variables',async t=>{
  const page=await fixture(t);
  const before=await page.locator('video').evaluate(v=>({paused:v.paused,muted:v.muted,time:v.currentTime,volume:v.volume}));
  const result=await page.evaluate(()=>session.start());assert.equal(result.feature_id,'YT-09');assert.equal(result.status,'OBSERVED');assert.equal(result.native_verified,false);
  assert.equal(await page.locator('ytd-app').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');
  assert.equal(await page.locator('#exit').evaluate(e=>getComputedStyle(e).filter),'none');
  assert.equal(await page.locator('#play').isVisible(),true);
  assert.deepEqual(await page.locator('video').evaluate(v=>({paused:v.paused,muted:v.muted,time:v.currentTime,volume:v.volume})),before);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
  assert.equal(await page.locator('ytd-app').evaluate(e=>e.style.filter),'var(--original)');
});
test('multiple owners and independent hide claims survive each other; duplicates are fenced',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{
    const app=document.querySelector('ytd-app');session.start();let duplicate='';try{make(settings).start();}catch(e){duplicate=e.message;}
    const other=make({...settings,binding_id:'00000000-0000-4000-8000-000000000003'});other.start();ledger.hide('hide',app);session.release();
    const shared=app.style.filter;other.release();const hidden=app.style.display;ledger.release('hide');return{duplicate,shared,hidden,remaining:ledger.inspect()};
  });assert.equal(r.duplicate,'GRAYSCALE_SCOPE_ALREADY_ACTIVE');assert.equal(r.shared,'grayscale(1)');assert.equal(r.hidden,'none');assert.equal(r.remaining.remaining_targets,0);
});
test('late/replaced app is observed and old filter restored without observer loops',async t=>{
  const page=await fixture(t,{html:'<div id="placeholder">loading</div>'});assert.equal((await page.evaluate(()=>session.start())).status,'NO_TARGET');
  await page.evaluate(html=>document.body.insertAdjacentHTML('beforeend',html),body);await page.waitForFunction(()=>observations.at(-1).status==='OBSERVED');
  await page.evaluate(()=>{window.old=document.querySelector('ytd-app');old.remove();const next=document.createElement('ytd-app');next.textContent='replacement';document.body.append(next);});
  await page.waitForFunction(()=>old.style.filter==='var(--original)'&&document.querySelector('ytd-app').style.filter==='grayscale(1)');
  const count=await page.evaluate(()=>observations.length);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>observations.length),count);
  assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
test('nested FOCURVE UI splits ancestor filters and remains outside all owned filters',async t=>{
  const page=await fixture(t);await page.evaluate(()=>session.start());
  await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<aside data-focurve-restriction id="notice">exit</aside>'));
  await page.waitForFunction(()=>document.querySelector('ytd-app').style.filter==='var(--original)'&&document.querySelector('video').style.filter==='grayscale(1)');
  assert.equal(await page.locator('#notice').evaluate(node=>{for(let e=node;e;e=e.parentElement)if(getComputedStyle(e).filter.includes('grayscale'))return false;return true;}),true);
  await page.evaluate(()=>document.querySelector('#notice').remove());await page.waitForFunction(()=>document.querySelector('ytd-app').style.filter==='grayscale(1)');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.evaluate(()=>ledger.inspect().remaining_targets),0);
});
test('page filter changes are composed and preserved on release',async t=>{
  const page=await fixture(t);await page.evaluate(()=>session.start());await page.evaluate(()=>document.querySelector('ytd-app').style.filter='brightness(0.7)');
  await page.waitForFunction(()=>document.querySelector('ytd-app').style.filter==='brightness(0.7) grayscale(1)');
  assert.equal((await page.evaluate(()=>session.release())).restored,true);assert.equal(await page.locator('ytd-app').evaluate(e=>e.style.filter),'brightness(0.7)');
});
test('partial restoration failure retains target and blocks scope replacement until retry',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{
    session.start();const app=document.querySelector('ytd-app'),write=app.style.setProperty.bind(app.style);
    app.style.setProperty=(name,value,priority)=>{if(name==='filter'&&value==='var(--original)'){write(name,'blur(1px)');throw Error('partial');}write(name,value,priority);};
    const failed=session.release();let blocked='';try{make(settings).start();}catch(e){blocked=e.message;}
    app.style.setProperty=write;const retried=session.release();return{failed,blocked,retried,filter:app.style.filter};
  });assert.equal(r.failed.restored,false);assert.equal(r.blocked,'GRAYSCALE_SCOPE_ALREADY_ACTIVE');assert.equal(r.retried.restored,true);assert.equal(r.filter,'var(--original)');
});
test('SPA requires synchronous explicit authorization; pagehide never resumes effects',async t=>{
  const page=await fixture(t);await page.evaluate(()=>{session.start();history.pushState({},'','/results?search_query=x');window.dispatchEvent(new Event('yt-navigate-finish'));});
  await page.waitForFunction(()=>invalidations.length===1);assert.equal(await page.evaluate(()=>invalidations[0].reason),'ROUTE_CHANGED');
  await page.evaluate(()=>{session.release();session=make({...settings,authorizeNavigation:()=>true});session.start();history.pushState({},'','/watch?v=y');window.dispatchEvent(new Event('yt-navigate-finish'));});
  await page.waitForFunction(()=>observations.at(-1).status==='OBSERVED');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>invalidations.at(-1).reason),'PAGEHIDE');
  await page.evaluate(()=>{window.dispatchEvent(new Event('pageshow'));document.body.append(document.createElement('ytd-app'));});
  assert.equal(await page.locator('ytd-app').last().evaluate(e=>e.style.filter),'');assert.equal((await page.evaluate(()=>session.release())).restored,true);
});
test('foreign document adoption retains debt and does not change the new document',async t=>{
  const page=await fixture(t);const r=await page.evaluate(()=>{
    session.start();const app=document.querySelector('ytd-app'),foreign=document.implementation.createHTMLDocument();foreign.adoptNode(app);app.style.filter='sepia(1)';
    const failed=session.release();return{failed,filter:app.style.filter};
  });assert.equal(r.failed.restored,false);assert.equal(r.filter,'sepia(1)');
});
test('unsupported route and host cannot acquire grayscale claims',async t=>{
  for(const url of ['https://www.youtube.com/account','https://music.youtube.com/','http://www.youtube.com/']){
    const page=await fixture(t,{url});const r=await page.evaluate(()=>{let error='';try{session.start();}catch(e){error=e.message;}return{error,count:ledger.inspect().remaining_targets};});
    assert.equal(r.error,'UNSUPPORTED_GRAYSCALE_DOCUMENT');assert.equal(r.count,0);
  }
});

test('subframes cannot acquire effects even with a YouTube-looking document',async t=>{
  const page=await fixture(t);const error=await page.evaluate(async()=>{
    const frame=document.createElement('iframe');document.body.append(frame);
    const{GrayscaleSession}=await import('/content/grayscale.mjs');
    try{new GrayscaleSession(frame.contentDocument,{...settings,ledger:new ledger.constructor(frame.contentDocument)}).start();}catch(e){return e.message;}
  });assert.equal(error,'UNSUPPORTED_GRAYSCALE_DOCUMENT');
});

test('TEST popup rejects page sender and grayscale release preserves an independent comment restriction',async t=>{
  const html=body.replace('<main>','<main><ytd-watch-flexy><ytd-comments id="owned-comments">comments</ytd-comments><div id="related">recommendations</div></ytd-watch-flexy>');
  const page=await fixture(t,{html});await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:fn=>{window.listener=fn;}}}};});
  await page.evaluate(await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8'));
  const r=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};let leaked=false;
    listener({type:'TEST_GRAYSCALE_APPLY'},{...sender,url:location.href},()=>{leaked=true;});
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    await send('TEST_WATCH_PANELS_APPLY');const applied=await send('TEST_GRAYSCALE_APPLY');
    const release=await send('TEST_GRAYSCALE_RELEASE'),hidden=document.querySelector('#owned-comments').style.display;
    await send('TEST_WATCH_PANELS_RELEASE');return{leaked,applied,release,hidden,final:(await send('TEST_WATCH_PANELS_STATE')).ledger};
  });assert.equal(r.leaked,false);assert.equal(r.applied.result.feature_id,'YT-09');assert.equal(r.applied.coreConnected,false);assert.equal(r.release.released.restored,true);assert.equal(r.hidden,'none');assert.equal(r.final.remaining_targets,0);
});

test('fresh document reload resets masthead, comments and grayscale equally without another apply',async t=>{
  const html=body.replace('<main>','<main><ytd-watch-flexy><ytd-comments id="owned-comments">comments</ytd-comments><div id="related">recommendations</div></ytd-watch-flexy>');
  const page=await fixture(t,{html});const bootstrap=await readFile(new URL('../content-tools/chrome-harness/bootstrap.js',import.meta.url),'utf8');
  const install=async()=>{
    await page.evaluate(()=>{window.chrome={runtime:{id:'test-extension',getURL:path=>location.origin+'/'+path,onMessage:{addListener:fn=>{window.listener=fn;}}}};});
    await page.evaluate(bootstrap);
  };
  await install();const before=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    await send('TEST_MASTHEAD_APPLY');await send('TEST_WATCH_PANELS_APPLY');await send('TEST_GRAYSCALE_APPLY');
    return{masthead:document.querySelector('ytd-masthead').style.display,comments:document.querySelector('#owned-comments').style.display,filter:document.querySelector('ytd-app').style.filter};
  });assert.deepEqual(before,{masthead:'none',comments:'none',filter:'grayscale(1)'});
  await page.reload();await install();
  const after=await page.evaluate(async()=>{
    const sender={id:'test-extension',url:chrome.runtime.getURL('popup.html')};
    const send=type=>new Promise(resolve=>listener({type},sender,resolve));
    return{masthead:document.querySelector('ytd-masthead').style.display,comments:document.querySelector('#owned-comments').style.display,filter:document.querySelector('ytd-app').style.filter,
      mastState:(await send('TEST_MASTHEAD_STATE')).result,watchState:(await send('TEST_WATCH_PANELS_STATE')).results,grayState:(await send('TEST_GRAYSCALE_STATE')).result};
  });assert.deepEqual(after,{masthead:'',comments:'',filter:'var(--original)',mastState:null,watchState:[],grayState:null});
});
