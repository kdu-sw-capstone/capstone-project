import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const row=(id='comment',n=1)=>`<li id="${id}" style="display:grid!important"><a href="/p/sample/c/${n}/">time</a><span>comment</span></li>`;
async function fixture(t,{mode='deferred',adapter=false,timeout=5000,maxPlans=256}={}){
 const context=await browser.newContext();t.after(()=>context.close());
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
  if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
  else await route.fulfill({contentType:'text/html',body:'<!doctype html><main><article><img id="photo"><p id="caption">caption</p><ul>'+row()+'</ul><button id="like">Like</button></article></main>'});
 });
 const p=await context.newPage();await p.goto('https://www.instagram.com/p/sample/');
 await p.evaluate(async({mode,adapter,timeout,maxPlans})=>{
  const {ClaimLedger}=await import('/content/claim-ledger.mjs'),{InstagramCommentsSession}=await import('/content/instagram-comments.mjs');
  window.ledger=new ClaimLedger(document);window.current=true;window.generation=1;window.requests=[];window.observations=[];window.invalidations=[];
  const reservation={getGeneration:()=>generation,timeoutMs:timeout,maxPlans};
  if(mode!=='missing')reservation.reserve=(plan,{signal})=>{
   if(mode==='throw')throw Error('reservation failed');
   if(mode==='reentrant-release')window.duringReserve=session.release();
   return new Promise((resolve,reject)=>{requests.push({plan,signal,resolve,reject});if(mode==='reject')reject(Error('store unconfirmed'));if(mode==='instant')resolve(plan.plan_id);});
  };
  if(mode==='no-generation')delete reservation.getGeneration;
  if(mode==='promise-generation')reservation.getGeneration=()=>Promise.reject(Error('async generation forbidden'));
  const options={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',canObserve:()=>current,isCurrent:()=>current,
   authorizeNavigation:()=>true,ig04Reservation:reservation,onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
  window.opts=options;
  if(adapter){const {ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.session=new ContentSessionAdapter(document,{...options,features:[{feature_id:'IG-04',enabled:true,required:true}]});}
  else window.session=new InstagramCommentsSession(document,options);
 },{mode,adapter,timeout,maxPlans});return p;
}
const hidden=p=>p.locator('#comment').evaluate(e=>e.inert);
for(const mode of ['missing','no-generation'])test(`gated mode defaults to denial: ${mode}`,async t=>{
 const p=await fixture(t,{mode});await p.evaluate(()=>session.start());assert.equal(await hidden(p),false);assert.equal(await p.evaluate(()=>requests.length),0);
});
test('initial and dynamically inserted comments await their own immutable restoration plans',async t=>{
 const p=await fixture(t);const r=await p.evaluate(()=>session.start());assert.equal(r.status,'OBSERVING');assert.equal(await hidden(p),false);
 const plan=await p.evaluate(()=>requests[0].plan);assert.equal(plan.properties[0].current.value,'grid');assert.equal(plan.properties[0].restore.priority,'important');assert.equal(plan.properties[1].restore.value,false);
 assert.equal(plan.generation,1);assert.equal(typeof plan.document_instance_id,'string');assert.equal(JSON.stringify(plan).includes('caption'),false);
 await p.evaluate(markup=>document.querySelector('ul').insertAdjacentHTML('beforeend',markup),row('second',2));await p.waitForFunction(()=>requests.length===2);
 await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#comment').inert);
 assert.equal(await p.locator('#second').evaluate(e=>e.inert),false);
 await p.evaluate(()=>requests[1].resolve(requests[1].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#second').inert);
 for(const id of ['photo','caption','like'])assert.equal(await p.locator('#'+id).evaluate(e=>!!e.closest('[inert]')),false);
 const release=await p.evaluate(()=>session.release());assert.equal(release.dom_restored,true);assert.equal(release.cleanup_pending,true);assert.equal(release.reservation_obligations.length,2);
 assert.deepEqual(await p.locator('#comment').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display'),e.inert]),['grid','important',false]);
});
for(const mode of ['reject','throw','wrong-ack','timeout'])test(`reservation ${mode} cannot authorize DOM effects or clear external obligations`,async t=>{
 const p=await fixture(t,{mode,timeout:mode==='timeout'?30:5000});await p.evaluate(()=>session.start());
 if(mode==='wrong-ack')await p.evaluate(()=>requests[0].resolve('foreign-plan'));
 await p.waitForFunction(()=>observations.at(-1)?.status==='FAILED');
 if(mode==='timeout'){await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.evaluate(()=>session.scan());}
 assert.equal(await hidden(p),false);const r=await p.evaluate(()=>session.release());assert.equal(r.dom_restored,true);assert.equal(r.cleanup_pending,true);
});
for(const boundary of ['release','invalidate','pagehide','spa','generation','authority','foreign','selector','detach'])test(`late ACK after ${boundary} has no effect`,async t=>{
 const p=await fixture(t,{adapter:boundary==='invalidate'});await p.evaluate(()=>session.start());
 await p.evaluate(boundary=>{window.held=document.querySelector('#comment');
  if(boundary==='release')session.release();if(boundary==='invalidate')session.invalidate();
  if(boundary==='pagehide')window.dispatchEvent(new Event('pagehide'));
  if(boundary==='spa')history.pushState({},'','/p/other/');
  if(boundary==='generation')generation++;if(boundary==='authority')current=false;
  if(boundary==='foreign')document.implementation.createHTMLDocument().adoptNode(held);
  if(boundary==='selector')held.querySelector('a').href='/p/sample/';if(boundary==='detach')held.remove();
  requests[0].resolve(requests[0].plan.plan_id);
 },boundary);
 await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,20)));
 assert.equal(await p.evaluate(()=>held.inert),false);assert.equal(await p.evaluate(()=>held.style.display),'grid');
 const r=await p.evaluate(()=>session.release());assert.equal(r.cleanup_pending,true);
});
test('page style changes while awaiting ACK require a new plan before applying',async t=>{
 const p=await fixture(t);await p.evaluate(()=>session.start());await p.evaluate(()=>{document.querySelector('#comment').style.setProperty('display','flex','important');requests[0].resolve(requests[0].plan.plan_id);});
 await p.waitForFunction(()=>requests.length===2);assert.equal(await hidden(p),false);
 assert.equal(await p.evaluate(()=>requests[1].plan.properties[0].restore.value),'flex');
 await p.evaluate(()=>requests[1].resolve(requests[1].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#comment').inert);
 await p.evaluate(()=>session.release());assert.equal(await p.locator('#comment').evaluate(e=>e.style.display),'flex');
});
test('another owner acquiring during reservation forces replan and remains after release',async t=>{
 const p=await fixture(t);await p.evaluate(()=>session.start());await p.evaluate(()=>{ledger.hide('other',document.querySelector('#comment'));requests[0].resolve(requests[0].plan.plan_id);});
 await p.waitForFunction(()=>requests.length===2);assert.equal(await p.evaluate(()=>requests[1].plan.properties[0].restore.value),'grid');
 await p.evaluate(()=>requests[1].resolve(requests[1].plan.plan_id));await p.waitForFunction(()=>observations.at(-1)?.restricted_target_count===1);
 await p.evaluate(()=>session.release());assert.equal(await hidden(p),true);await p.evaluate(()=>ledger.release('other'));assert.equal(await hidden(p),false);
});
test('partial restore failure stays retryable after an acknowledged apply',async t=>{
 const p=await fixture(t,{mode:'instant'});await p.evaluate(()=>session.start());await p.waitForFunction(()=>document.querySelector('#comment').inert);
 await p.evaluate(()=>{const e=document.querySelector('#comment');const write=e.style.setProperty.bind(e.style);window.fail=true;e.style.setProperty=(n,v,p)=>{write(n,v,p);if(fail&&n==='display'&&v==='grid')throw Error('partial');};});
 const first=await p.evaluate(()=>session.release());assert.equal(first.dom_restored,false);assert.ok(first.error_count>0);
 const retry=await p.evaluate(()=>{fail=false;return session.release();});assert.equal(retry.dom_restored,true);assert.equal(retry.cleanup_pending,true);assert.equal(await p.evaluate(()=>ledger.inspect().remaining_targets),0);
});
test('reservation callback reentrant release and duplicate ACK never apply; adapter retains cleanup obligations',async t=>{
 const p=await fixture(t,{adapter:true});await p.evaluate(()=>session.start());await p.evaluate(()=>{session.releaseFeature('IG-04');requests[0].resolve(requests[0].plan.plan_id);requests[0].resolve(requests[0].plan.plan_id);});
 await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,10)));assert.equal(await hidden(p),false);
 const r=await p.evaluate(()=>session.release());assert.equal(r.cleanup_pending,true);assert.deepEqual(r.pending_features,['IG-04']);
});

test('synchronous release inside the reservation callback cancels its still-pending plan',async t=>{
 const p=await fixture(t,{mode:'reentrant-release'});await p.evaluate(()=>session.start());
 assert.equal(await p.evaluate(()=>duringReserve.cleanup_pending),true);
 assert.equal(await p.evaluate(()=>requests[0].signal.aborted),true);
 await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,10)));
 assert.equal(await hidden(p),false);assert.equal((await p.evaluate(()=>session.release())).cleanup_pending,true);
});
test('revocation in the first setter fences the next property and target, leaving retryable own obligations',async t=>{
 const p=await fixture(t,{mode:'instant'});await p.evaluate(markup=>document.querySelector('ul').insertAdjacentHTML('beforeend',markup),row('second',2));
 await p.evaluate(()=>{const e=document.querySelector('#comment'),write=e.style.setProperty.bind(e.style);e.style.setProperty=(n,v,p)=>{write(n,v,p);if(n==='display'&&v==='none')current=false;};session.start();});
 await p.waitForFunction(()=>invalidations.length>0);assert.equal(await p.locator('#second').evaluate(e=>e.inert),false);
 assert.equal(await p.locator('#comment').evaluate(e=>e.inert),false);assert.equal(await p.evaluate(()=>ledger.inspect().remaining_targets),1);
 assert.equal((await p.evaluate(()=>session.release())).dom_restored,true);assert.equal(await p.evaluate(()=>ledger.inspect().remaining_targets),0);
});
test('an applied target whose shared restoration baseline changes needs another reservation',async t=>{
 const p=await fixture(t);await p.evaluate(()=>session.start());await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#comment').inert);
 await p.evaluate(()=>{const e=document.querySelector('#comment');e.style.setProperty('display','flex','important');ledger.hide('other',e);session.scan();});
 await p.waitForFunction(()=>requests.length===2);assert.equal(await p.evaluate(()=>requests[1].plan.properties[0].restore.value),'flex');
 await p.evaluate(()=>requests[1].resolve(requests[1].plan.plan_id));await p.waitForFunction(()=>observations.at(-1)?.restricted_target_count===1);
 await p.evaluate(()=>{session.release();ledger.release('other');});assert.equal(await p.locator('#comment').evaluate(e=>e.style.display),'flex');
});

test('plans are immutable, ledger-local, and consumed once; a cloned ACK plan cannot apply',async t=>{
 const p=await fixture(t);const r=await p.evaluate(()=>{const e=document.querySelector('#comment'),plan=ledger.planHide('standalone',e);
  const clone=structuredClone(plan),frozen=Object.isFrozen(plan)&&Object.isFrozen(plan.properties[0].restore);
  const cloned=ledger.applyHidePlan(clone,e,()=>true),first=ledger.applyHidePlan(plan,e,()=>true),duplicate=ledger.applyHidePlan(plan,e,()=>true);
  return{frozen,cloned,first,duplicate,cleanup:ledger.release('standalone')};});
 assert.equal(r.frozen,true);assert.equal(r.cloned,null);assert.equal(r.first,true);assert.equal(r.duplicate,null);assert.equal(r.cleanup.restored,true);
});
test('duplicate successful ACK and unchanged scans do not create another reservation or effect',async t=>{
 const p=await fixture(t);await p.evaluate(()=>session.start());await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#comment').inert);
 await p.evaluate(()=>{requests[0].resolve(requests[0].plan.plan_id);session.scan();session.scan();});
 assert.equal(await p.evaluate(()=>requests.length),1);assert.equal(await hidden(p),true);
});
test('bounded reservation capacity fails closed for new dynamic targets without dropping old obligations',async t=>{
 const p=await fixture(t,{maxPlans:1});await p.evaluate(()=>session.start());await p.evaluate(markup=>document.querySelector('ul').insertAdjacentHTML('beforeend',markup),row('second',2));
 await p.waitForFunction(()=>observations.at(-1)?.status==='FAILED');await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#comment').inert);
 assert.equal(await p.locator('#second').evaluate(e=>e.inert),false);assert.equal(await p.evaluate(()=>requests.length),1);
 const r=await p.evaluate(()=>session.release());assert.equal(r.cleanup_pending,true);assert.equal(r.reservation_obligations.length,1);
});

test('a Promise generation source is denied rather than awaited or accepted',async t=>{
 const p=await fixture(t,{mode:'promise-generation'});await p.evaluate(()=>session.start());assert.equal(await hidden(p),false);assert.equal(await p.evaluate(()=>requests.length),0);
});
test('a throwing post-ACK current check is denied without an unhandled rejection',async t=>{
 const p=await fixture(t);const result=await p.evaluate(async()=>{
  const {HideReservationGate}=await import('/content/hide-reservation-gate.mjs');let resolve,throws=false;
  const gate=new HideReservationGate(ledger,{reserve:()=>new Promise(r=>resolve=r),getGeneration:()=>1});
  gate.hide('test',document.querySelector('#comment'),()=>{if(throws)throw Error('stale current');return true;});throws=true;
  const id=gate.inspect().reservation_obligations[0].plan_id;resolve(id);await new Promise(r=>setTimeout(r,10));return gate.inspect();
 });assert.equal(result.reservation_obligations[0].state,'DENIED');assert.equal(await hidden(p),false);
});
test('retired pending target keeps invalidation debt and prevents same-scope replacement',async t=>{
 const p=await fixture(t);await p.evaluate(()=>session.start());await p.evaluate(()=>document.querySelector('#comment a').href='/p/sample/');
 await p.waitForFunction(()=>observations.at(-1)?.remaining_targets===0);
 await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await p.evaluate(()=>invalidations.at(-1).cleanup_pending),true);
 assert.equal((await p.evaluate(()=>session.release())).cleanup_pending,true);
 const denied=await p.evaluate(async()=>{const {InstagramCommentsSession}=await import('/content/instagram-comments.mjs');try{new InstagramCommentsSession(document,opts).start();return false;}catch{return true;}});
 assert.equal(denied,true);
});
