import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const row=(id='comment',n=1)=>`<li id="${id}" style="display:grid!important"><a href="/p/sample/c/${n}/">time</a><span>comment</span></li>`;
async function fixture(t,{mode='instant',adapter=true,timeout=5000,maxPlans=256,bound='valid'}={}){
 const context=await browser.newContext();t.after(()=>context.close());
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
  if(/^\/content\/[a-z-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
  else await route.fulfill({contentType:'text/html',body:'<!doctype html><main><article><img id="photo"><p id="caption">caption</p><ul>'+row()+'</ul><button id="like">Like</button></article></main>'});
 });
 const p=await context.newPage();await p.goto('https://www.instagram.com/p/sample/');
 await p.evaluate(async({mode,adapter,timeout,maxPlans,bound})=>{
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
  window.nativeDocument='native-doc-1';window.contextAllowed=true;window.completions=[];
  reservation.context={scope:{owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',generation:1,owner_epoch:1,executor_id:'00000000-0000-4000-8000-000000000005',runtime_execution_id:'00000000-0000-4000-8000-000000000006',package_id:'00000000-0000-4000-8000-000000000007',runtime_revision:1,scope_epoch:'00000000-0000-4000-8000-000000000008',tab_id:1,frame_id:0,document_id:'native-doc-1',document_instance_id:'00000000-0000-4000-8000-000000000004',url_sha256:'2'.repeat(64),focus_ref:null},operation_id:'00000000-0000-4000-8000-000000000003',semantic_sha256:'1'.repeat(64)};
  reservation.verifyContext=c=>contextAllowed&&c.scope.document_id===nativeDocument;
  reservation.verifyCompletion=(proof,expected)=>new Promise((resolve,reject)=>completions.push({proof,expected,resolve,reject}));
  if(bound==='missing-verifier')delete reservation.verifyContext;
  if(bound==='missing-completion')delete reservation.verifyCompletion;
  if(bound==='wrong-owner')reservation.context.scope.owner_binding_id='00000000-0000-4000-8000-000000000099';
  if(bound==='wrong-binding')reservation.context.scope.binding_id='00000000-0000-4000-8000-000000000099';
  if(bound==='wrong-generation')reservation.context.scope.generation=2;
  if(bound==='wrong-native')reservation.context.scope.document_id='foreign-native-doc';
  const options={ledger,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',canObserve:()=>current,isCurrent:()=>current,
   authorizeNavigation:()=>true,ig04Reservation:reservation,onObservation:r=>observations.push(r),onInvalidated:r=>invalidations.push(r)};
  window.opts=options;
  if(adapter){const {ContentSessionAdapter}=await import('/content/session-adapter.mjs');window.session=new ContentSessionAdapter(document,{...options,features:[{feature_id:'IG-04',enabled:true,required:true}]});}
  else window.session=new InstagramCommentsSession(document,options);
 },{mode,adapter,timeout,maxPlans,bound});return p;
}
const hidden=p=>p.locator('#comment').evaluate(e=>e.inert);

async function applied(p){await p.evaluate(()=>session.start());await p.waitForFunction(()=>document.querySelector('#comment').inert);}
async function identity(p){return p.evaluate(async()=>{const s=await session.evidenceSnapshot();return s.gate.reservations[0].identity;});}
async function beginCompletion(p,id){await p.evaluate(id=>{window.finish=session.completeReservation(id,{opaque:'test-only'});},id);}
async function verified(p){await p.waitForFunction(()=>completions.length>0);return p.evaluate(async()=>{completions.at(-1).resolve(true);return await finish;});}
for(const bound of ['missing-verifier','wrong-owner','wrong-binding','wrong-generation','wrong-native'])test(`bound mode denies ${bound} before reservation/effect`,async t=>{
 const p=await fixture(t,{bound});await p.evaluate(()=>session.start());assert.equal(await hidden(p),false);assert.equal(await p.evaluate(()=>requests.length),0);
});
test('snapshot is read-only, owned-only, detached from caller mutation, and not Wire evidence',async t=>{
 const p=await fixture(t);await applied(p);
 await p.evaluate(()=>{const secret=document.createElement('div');secret.textContent='PRIVATE_OTHER_OWNER_TEXT';document.body.append(secret);ledger.hide('FOREIGN_OWNER_SECRET',secret);});
 const s=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(s.local_only,true);assert.equal(s.native_verified,false);assert.equal(s.observer_active,true);assert.equal(s.scan_complete,true);assert.equal(s.ledger.remaining_targets,1);
 const json=JSON.stringify(s);for(const secret of ['PRIVATE_OTHER_OWNER_TEXT','FOREIGN_OWNER_SECRET','post caption','native-doc-1','grid'])assert.equal(json.includes(secret),false,secret);
 assert.equal(s.ledger.claims[0].properties[0].matches_owned,true);assert.equal(typeof s.gate.reservations[0].identity.plan_sha256,'string');
 s.gate.reservations[0].completed=true;s.ledger.claims.length=0;
 const again=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(again.gate.reservations[0].completed,false);assert.equal(again.ledger.remaining_targets,1);assert.equal(await hidden(p),true);
});
test('bound plan includes immutable context/operation/hash identity, with native context verified externally',async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);assert.equal(id.operation_id,'00000000-0000-4000-8000-000000000003');assert.equal(id.generation,1);assert.match(id.context_sha256,/^[a-f0-9]{64}$/);assert.match(id.plan_sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(await p.evaluate(()=>requests[0].plan.reservation_identity),id);
});
for(const field of ['gate_id','plan_id','context_sha256','plan_sha256','operation_id','generation'])test(`completion rejects wrong ${field} without querying Core or clearing debt`,async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);await p.evaluate(()=>session.release());
 id[field]=field==='generation'?2:'wrong';const r=await p.evaluate(id=>session.completeReservation(id,{}),id);
 assert.equal(r.accepted,false);assert.equal(r.reason,'RESERVATION_IDENTITY_MISMATCH');assert.equal(await p.evaluate(()=>completions.length),0);assert.equal(await p.evaluate(()=>session.inspect().cleanup_pending),true);
});
test('completion before release or after failed restore is denied; retry then verified completion clears scope',async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);
 assert.equal((await p.evaluate(id=>session.completeReservation(id,{}),id)).reason,'LOCAL_CLEANUP_UNCONFIRMED');
 await p.evaluate(()=>{window.write=document.querySelector('#comment').style.setProperty.bind(document.querySelector('#comment').style);document.querySelector('#comment').style.setProperty=(n,v,p)=>{if(n==='display'&&v==='grid')throw Error('fail');write(n,v,p);};session.release();});
 assert.equal((await p.evaluate(id=>session.completeReservation(id,{}),id)).accepted,false);
 await p.evaluate(()=>{document.querySelector('#comment').style.setProperty=write;session.release();});await beginCompletion(p,id);const r=await verified(p);assert.equal(r.accepted,true);assert.equal(r.state.cleanup_pending,false);
 const s=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(s.dom_cleanup_confirmed,true);assert.equal(s.observer_active,false);assert.equal(s.ledger.remaining_targets,0);assert.equal(s.gate.reservations[0].completed,true);
});
for(const outcome of ['false','reject','lost'])test(`unconfirmed or ${outcome} durable completion preserves reservation`,async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);await p.evaluate(()=>session.release());await beginCompletion(p,id);await p.waitForFunction(()=>completions.length===1);
 if(outcome==='false')await p.evaluate(()=>completions[0].resolve(false));if(outcome==='reject')await p.evaluate(()=>completions[0].reject(Error('unknown')));
 if(outcome!=='lost')assert.equal((await p.evaluate(()=>finish)).accepted,false);
 assert.equal(await p.evaluate(()=>session.inspect().cleanup_pending),true);const snap=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(snap.gate.reservations[0].completed,false);assert.equal(snap.gate.reservations[0].completion_pending,outcome==='lost');
});
test('missing completion verifier never clears obligations',async t=>{
 const p=await fixture(t,{bound:'missing-completion'});await applied(p);const id=await identity(p);await p.evaluate(()=>session.release());assert.equal((await p.evaluate(id=>session.completeReservation(id,{}),id)).reason,'COMPLETION_VERIFIER_REQUIRED');
});
test('verified completion is per-plan; duplicate and late ACK remain idempotent and other owner survives',async t=>{
 const p=await fixture(t);await applied(p);await p.evaluate(markup=>document.querySelector('ul').insertAdjacentHTML('beforeend',markup),row('second',2));await p.waitForFunction(()=>document.querySelector('#second').inert);
 const ids=await p.evaluate(async()=>{ledger.hide('other',document.querySelector('#comment'));return (await session.evidenceSnapshot()).gate.reservations.map(r=>r.identity);});
 await p.evaluate(()=>session.release());await beginCompletion(p,ids[0]);let r=await verified(p);assert.equal(r.accepted,true);assert.equal(r.state.cleanup_pending,true);
 await beginCompletion(p,ids[0]);r=await verified(p);assert.equal(r.duplicate,true);assert.equal(r.state.cleanup_pending,true);
 await beginCompletion(p,ids[1]);r=await verified(p);assert.equal(r.state.cleanup_pending,false);assert.equal(await hidden(p),true);await p.evaluate(()=>ledger.release('other'));assert.equal(await hidden(p),false);
});
test('same plan identity from a different gate is rejected even when scope and operation are equal',async t=>{
 const p=await fixture(t),q=await fixture(t);await applied(p);await applied(q);const id=await identity(p);await q.evaluate(()=>session.release());assert.equal((await q.evaluate(id=>session.completeReservation(id,{}),id)).accepted,false);
});
test('foreign-document cleanup remains unconfirmed and snapshot excludes foreign values',async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);await p.evaluate(()=>{window.held=document.querySelector('#comment');document.implementation.createHTMLDocument().adoptNode(held);held.style.display='PRIVATE_FOREIGN';session.release();});
 const s=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(s.ledger.claims[0].foreign_document,true);assert.equal(s.ledger.claims[0].properties[0].matches_owned,null);assert.equal(JSON.stringify(s).includes('PRIVATE_FOREIGN'),false);
 assert.equal((await p.evaluate(id=>session.completeReservation(id,{}),id)).accepted,false);
});

test('scope required fields cannot be omitted even if an external verifier would return true',async t=>{
 const p=await fixture(t);const r=await p.evaluate(async()=>{const {ContentSessionAdapter}=await import('/content/session-adapter.mjs');const config={...opts,ig04Reservation:{...opts.ig04Reservation,context:structuredClone(opts.ig04Reservation.context)}};config.ig04Reservation.context.scope.binding_id='00000000-0000-4000-8000-000000000009';delete config.ig04Reservation.context.scope.scope_epoch;
  const invalid=new ContentSessionAdapter(document,{...config,owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000009',features:[{feature_id:'IG-04',enabled:true,required:true}]});return invalid.start();});
 assert.equal(r.features[0].observation.restricted_target_count,0);assert.equal(await hidden(p),false);
});
test('local cleanup is rechecked after asynchronous verification, so an intervening obligation is preserved',async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);await p.evaluate(()=>session.release());await beginCompletion(p,id);await p.waitForFunction(()=>completions.length===1);
 await p.evaluate(()=>ledger.hide(requests[0].plan.claim,document.querySelector('#comment')));const r=await verified(p);assert.equal(r.accepted,false);assert.equal(r.reason,'LOCAL_CLEANUP_UNCONFIRMED');assert.equal(r.state.cleanup_pending,true);
 await p.evaluate(()=>{ledger.release(requests[0].plan.claim);session.release();});await beginCompletion(p,id);assert.equal((await verified(p)).accepted,true);
});
test('same-scope replacement uses distinct claims; a late duplicate completion cannot affect its ledger or state',async t=>{
 const p=await fixture(t);await applied(p);const id=await identity(p);await p.evaluate(()=>{window.old=session;session.release();});await beginCompletion(p,id);assert.equal((await verified(p)).accepted,true);
 await p.evaluate(async()=>{const {ContentSessionAdapter}=await import('/content/session-adapter.mjs');session=new ContentSessionAdapter(document,{...opts,features:[{feature_id:'IG-04',enabled:true,required:true}]});session.start();});await p.waitForFunction(()=>document.querySelector('#comment').inert);
 const fresh=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(fresh.ledger.remaining_targets,1);
 assert.equal((await p.evaluate(()=>old.evidenceSnapshot())).ledger.remaining_targets,0);
 await p.evaluate(id=>{window.finish=old.completeReservation(id,{});},id);const r=await verified(p);assert.equal(r.duplicate,true);
 assert.equal(await hidden(p),true);assert.equal((await p.evaluate(()=>session.evidenceSnapshot())).ledger.remaining_targets,1);assert.equal(await p.evaluate(()=>session.inspect().closed),false);
});
test('caller mutation cannot change the bound context or the returned cleanup snapshot',async t=>{
 const p=await fixture(t);const op=await p.evaluate(()=>{opts.ig04Reservation.context.operation_id='00000000-0000-4000-8000-000000000099';return session.start();});
 await p.waitForFunction(()=>document.querySelector('#comment').inert);const id=await identity(p);assert.equal(id.operation_id,'00000000-0000-4000-8000-000000000003');
 await p.evaluate(()=>{const r=session.releaseFeature('IG-04');r.restored=false;r.reservation_obligations.length=0;});
 const snap=await p.evaluate(()=>session.evidenceSnapshot());assert.equal(snap.cleanup.restored,true);assert.equal(snap.cleanup.reservation_obligations.length,1);
});
