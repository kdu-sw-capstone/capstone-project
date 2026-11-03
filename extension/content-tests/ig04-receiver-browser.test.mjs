import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});});
after(async()=>{await browser?.close();});
const row=(id='comment',n=1)=>`<li id="${id}" style="display:grid!important"><a href="/p/sample/c/${n}/">time</a><span>comment</span></li>`;
async function fixture(t,{reservation='instant',input='instant',release='instant',completion='instant',missing=null,timeout=5000}={}){
 const context=await browser.newContext();t.after(()=>context.close());
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;
  if(/^\/content\/[a-z0-9-]+\.mjs$/.test(path))await route.fulfill({contentType:'text/javascript',body:await readFile(new URL('..'+path,import.meta.url),'utf8')});
  else await route.fulfill({contentType:'text/html',body:'<!doctype html><main><article><img id="photo"><p id="caption">caption</p><ul>'+row()+'</ul><button id="like">Like</button></article></main>'});
 });
 const p=await context.newPage();await p.goto('https://www.instagram.com/p/sample/');
 await p.evaluate(async modes=>{
  const {IG04ContentReceiver}=await import('/content/ig04-receiver.mjs'),{ClaimLedger}=await import('/content/claim-ledger.mjs');
  window.current=true;window.generation=1;window.worker='worker-one';window.nativeDocument='native-doc-1';window.requests=[];window.checks={input:[],release:[],completion:[]};window.ledger=new ClaimLedger(document);
  window.binding={scope:{owner_binding_id:'00000000-0000-4000-8000-000000000001',binding_id:'00000000-0000-4000-8000-000000000002',generation:1,owner_epoch:1,executor_id:'00000000-0000-4000-8000-000000000005',runtime_execution_id:'00000000-0000-4000-8000-000000000006',package_id:'00000000-0000-4000-8000-000000000007',runtime_revision:1,scope_epoch:'00000000-0000-4000-8000-000000000008',tab_id:1,frame_id:0,document_id:'native-doc-1',document_instance_id:'00000000-0000-4000-8000-000000000004',url_sha256:'2'.repeat(64),focus_ref:null},operation_id:'00000000-0000-4000-8000-000000000003',semantic_sha256:'1'.repeat(64)};
  window.input={context:structuredClone(binding),features:[{feature_id:'IG-04',enabled:true,required:true}]};
  const verify=(kind,proof,expected)=>{
   const valid=proof===kind+'-token'&&expected.context.scope.owner_binding_id==='00000000-0000-4000-8000-000000000001'&&expected.context.scope.document_id==='native-doc-1'&&expected.context.operation_id===binding.operation_id&&expected.context.semantic_sha256===binding.semantic_sha256;
   if(modes[kind]==='deferred')return new Promise((resolve,reject)=>checks[kind].push({expected,resolve,reject}));
   return valid;
  };
  window.opts={ledger,getWorkerInstance:()=>worker,getGeneration:()=>generation,
   isCurrent:c=>current&&c.scope.document_id===nativeDocument&&c.scope.owner_binding_id===binding.scope.owner_binding_id,
   verifyInput:(proof,e)=>verify('input',proof,e),verifyRelease:(proof,e)=>verify('release',proof,e),verifyCompletion:(proof,e)=>verify('completion',proof,e),
   reserve:(plan,metadata)=>new Promise((resolve,reject)=>{requests.push({plan,metadata,resolve,reject});if(modes.reservation==='instant')resolve(plan.plan_id);if(modes.reservation==='reject')reject(Error('store unknown'));}),timeoutMs:modes.timeout};
  if(modes.missing)delete opts[modes.missing];window.receiver=new IG04ContentReceiver(document,opts);
 },{reservation,input,release,completion,missing,timeout});return p;
}
const hidden=p=>p.locator('#comment').evaluate(e=>e.inert);
const apply=p=>p.evaluate(()=>receiver.apply(input,'input-token'));
async function applied(p){const r=await apply(p);assert.equal(r.accepted,true);await p.waitForFunction(()=>document.querySelector('#comment').inert);return r;}
async function id(p){return p.evaluate(async()=>{const q=await receiver.query();return q.snapshot.gate.reservations[0].identity;});}
const release=p=>p.evaluate(()=>receiver.release(binding,'release-token'));
test('completion reply from before a repeated scoped release retains debt until a fresh verification',async t=>{
 const p=await fixture(t,{completion:'deferred'});await applied(p);const identity=await id(p);await release(p);
 await p.evaluate(identity=>{window.oldCompletion=receiver.completeReservation(binding,identity,'completion-token');},identity);
 await p.waitForFunction(()=>checks.completion.length===1);
 await release(p);
 await p.evaluate(()=>checks.completion[0].resolve(true));
 const stale=await p.evaluate(()=>oldCompletion);
 assert.equal(stale.accepted,false);assert.equal(stale.state.cleanup_pending,true);
 await p.evaluate(identity=>{window.freshCompletion=receiver.completeReservation(binding,identity,'completion-token');},identity);
 await p.waitForFunction(()=>checks.completion.length===2);
 await p.evaluate(()=>checks.completion[1].resolve(true));
 assert.equal((await p.evaluate(()=>freshCompletion)).accepted,true);
 assert.equal((await p.evaluate(()=>receiver.query())).state.cleanup_pending,false);
});

test('local cleanup reentry at final proof consumption cannot be mistaken for an unchanged revision',async t=>{
 const p=await fixture(t);await applied(p);await release(p);
 const result=await p.evaluate(async()=>{
  const {HideReservationGate}=await import('/content/hide-reservation-gate.mjs');
  const gate=new HideReservationGate(ledger,{...opts,context:binding,verifyContext:()=>true},()=>{},binding.scope);
  gate.hide('local-review',document.querySelector('#comment'),()=>true);
  const snapshot=await gate.snapshot(),identity=snapshot.reservations[0].identity;
  gate.close();let reads=0;
  const result=await gate.completeReservation(identity,'completion-token',()=>{if(++reads===2)gate.close();return true;});
  return {result,obligations:gate.inspect().reservation_obligations.length};
 });
 assert.equal(result.result.accepted,false);assert.equal(result.obligations,1);
});
test('stable old-scope completion remains available after APPLY authority is revoked',async t=>{
 const p=await fixture(t);await applied(p);const identity=await id(p);
 await p.evaluate(()=>current=false);await release(p);
 const result=await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity);
 assert.equal(result.accepted,true);assert.equal(result.local_only,true);assert.equal(result.native_verified,false);
 assert.equal(result.state.cleanup_pending,false);assert.equal(await hidden(p),false);
 assert.equal((await apply(p)).accepted,false);assert.equal(await p.evaluate(()=>requests.length),1);
});
for(const method of ['pushState','replaceState'])test(`receiver retires on SPA ${method} round trip before a late reservation ACK`,async t=>{
 const p=await fixture(t,{reservation:'deferred'});await apply(p);await p.waitForFunction(()=>requests.length===1);
 await p.evaluate(method=>{
  if(!navigation)throw Error('NAVIGATION_API_REQUIRED_FOR_FIXTURE');
  const before=location.href;history[method]({},'','/p/other/');history[method]({},'',before);
  requests[0].resolve(requests[0].plan.plan_id);
 },method);
 await p.waitForTimeout(60);
 const result=await p.evaluate(()=>receiver.query());
 assert.equal(result.revalidation_required,true);assert.equal(await hidden(p),false);
 assert.equal((await apply(p)).accepted,false);
 const ended=await release(p);assert.equal(ended.accepted,true);assert.equal(ended.state.cleanup_pending,true);
});
test('receiver same-URL state update keeps authority but persisted return never reopens it',async t=>{
 const p=await fixture(t);await applied(p);
 await p.evaluate(()=>history.replaceState({ui:'only'},'',location.href));
 assert.equal((await p.evaluate(()=>receiver.query())).revalidation_required,false);assert.equal(await hidden(p),true);
 await p.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 assert.equal((await apply(p)).accepted,false);
 const ended=await release(p);assert.equal(ended.accepted,true);assert.equal(await hidden(p),false);
 // Local restoration is not completion of the externally reserved obligation.
 assert.equal(ended.state.cleanup_pending,true);
});
for(const missing of ['verifyInput','isCurrent','reserve','getGeneration','getWorkerInstance','verifyRelease','verifyCompletion'])test(`missing ${missing} denies receiver before any effect`,async t=>{
 const p=await fixture(t,{missing});assert.equal((await apply(p)).accepted,false);assert.equal(await hidden(p),false);assert.equal(await p.evaluate(()=>requests.length),0);
});
test('verified initial and dynamic comments reuse gated adapter; snapshots remain local and completion requires scoped release',async t=>{
 const p=await fixture(t,{reservation:'deferred'});const r=await apply(p);assert.equal(r.accepted,true);assert.equal(r.local_only,true);assert.equal(r.native_verified,false);assert.equal(await hidden(p),false);
 await p.waitForFunction(()=>requests.length===1);await p.evaluate(()=>requests[0].resolve(requests[0].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#comment').inert);
 await p.evaluate(markup=>document.querySelector('ul').insertAdjacentHTML('beforeend',markup),row('second',2));await p.waitForFunction(()=>requests.length===2);assert.equal(await p.locator('#second').evaluate(e=>e.inert),false);
 await p.evaluate(()=>requests[1].resolve(requests[1].plan.plan_id));await p.waitForFunction(()=>document.querySelector('#second').inert);
 const identity=await id(p);assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity)).accepted,false);
 assert.equal((await p.evaluate(()=>receiver.release(binding,'wrong-proof'))).accepted,false);assert.equal(await hidden(p),true);
 const ended=await release(p);assert.equal(ended.state.cleanup_pending,true);assert.equal(await hidden(p),false);
 const identities=await p.evaluate(async()=> (await receiver.query()).snapshot.gate.reservations.map(r=>r.identity));
 for(const identity of identities)assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity)).accepted,true);
 assert.equal((await p.evaluate(()=>receiver.query())).state.cleanup_pending,false);
 assert.deepEqual(await p.locator('#comment').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display'),e.inert]),['grid','important',false]);
});
for(const field of ['owner','native','generation','feature','multi-feature'])test(`wrong ${field} input is rejected`,async t=>{
 const p=await fixture(t);await p.evaluate(field=>{
  if(field==='owner')input.context.scope.owner_binding_id='00000000-0000-4000-8000-000000000099';
  if(field==='native')input.context.scope.document_id='foreign';if(field==='generation')input.context.scope.generation=2;
  if(field==='feature')input.features[0].feature_id='IG-05';if(field==='multi-feature')input.features.push({feature_id:'IG-06',enabled:true,required:true});
 },field);assert.equal((await apply(p)).accepted,false);assert.equal(await hidden(p),false);
});
for(const event of ['authority','generation','worker','pagehide','spa'])test(`late reservation ACK after ${event} never applies`,async t=>{
 const p=await fixture(t,{reservation:'deferred'});await apply(p);await p.waitForFunction(()=>requests.length===1);
 await p.evaluate(event=>{if(event==='authority')current=false;if(event==='generation')generation=2;if(event==='worker')worker='worker-two';if(event==='pagehide')window.dispatchEvent(new Event('pagehide'));if(event==='spa')history.pushState({},'','/p/other/');requests[0].resolve(requests[0].plan.plan_id);},event);
 await p.evaluate(()=>new Promise(r=>setTimeout(r,20)));assert.equal(await hidden(p),false);assert.equal((await p.evaluate(()=>receiver.query())).revalidation_required,true);
 if(event!=='worker'){assert.equal((await release(p)).accepted,true);assert.equal((await p.evaluate(()=>receiver.query())).state.cleanup_pending,true);}
});
for(const event of ['worker','pagehide','generation'])test(`input verification lost to ${event} cannot create a Session`,async t=>{
 const p=await fixture(t,{input:'deferred'});await p.evaluate(()=>{window.opening=receiver.apply(input,'input-token');});await p.waitForFunction(()=>checks.input.length===1);
 await p.evaluate(event=>{if(event==='worker')worker='worker-two';if(event==='pagehide')window.dispatchEvent(new Event('pagehide'));if(event==='generation')generation=2;checks.input[0].resolve(true);},event);
 assert.equal((await p.evaluate(()=>opening)).accepted,false);assert.equal(await hidden(p),false);assert.equal(await p.evaluate(()=>requests.length),0);
});
test('authorized RELEASE cancels in-flight input verification; duplicate apply never reopens a closed Session',async t=>{
 const p=await fixture(t,{input:'deferred'});await p.evaluate(()=>{window.opening=receiver.apply(input,'input-token');});await p.waitForFunction(()=>checks.input.length===1);
 assert.equal((await release(p)).accepted,true);await p.evaluate(()=>checks.input[0].resolve(true));assert.equal((await p.evaluate(()=>opening)).accepted,false);assert.equal(await hidden(p),false);assert.equal((await apply(p)).accepted,false);
});
test('duplicate input is reverified and isolated from changed operation or features',async t=>{
 const p=await fixture(t);await applied(p);const first=await p.evaluate(()=>requests.length);const again=await apply(p);assert.equal(again.duplicate,true);assert.equal(await p.evaluate(()=>requests.length),first);
 assert.equal((await p.evaluate(()=>receiver.apply(input,'wrong-proof'))).accepted,false);
 await p.evaluate(()=>input.context.operation_id='00000000-0000-4000-8000-000000000099');assert.equal((await apply(p)).reason,'RECEIVER_ALREADY_BOUND');assert.equal(await hidden(p),true);
});
for(const reservation of ['reject','lost','timeout'])test(`reservation ${reservation} preserves pending cleanup without product success`,async t=>{
 const p=await fixture(t,{reservation:reservation==='timeout'?'deferred':reservation,timeout:reservation==='timeout'?30:5000});await apply(p);await p.waitForFunction(()=>requests.length===1);
 if(reservation!=='lost')await p.waitForFunction(()=>requests[0].metadata.signal.aborted);
 assert.equal(await hidden(p),false);const r=await release(p);assert.equal(r.state.cleanup_pending,true);assert.equal(r.native_verified,false);
});
test('other owner claim survives local release and failed/duplicate completion',async t=>{
 const p=await fixture(t);await applied(p);const identity=await id(p);await p.evaluate(()=>ledger.hide('other',document.querySelector('#comment')));await release(p);
 assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'wrong-proof'),identity)).accepted,false);
 assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity)).accepted,true);
 assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity)).duplicate,true);assert.equal(await hidden(p),true);await p.evaluate(()=>ledger.release('other'));assert.equal(await hidden(p),false);
});
test('partial restore and foreign document never discharge unconfirmed own cleanup',async t=>{
 const p=await fixture(t);await applied(p);const identity=await id(p);
 await p.evaluate(()=>{window.held=document.querySelector('#comment');window.write=held.style.setProperty.bind(held.style);held.style.setProperty=(n,v,p)=>{if(n==='display'&&v==='grid')throw Error('restore');write(n,v,p);};});
 assert.equal((await release(p)).state.cleanup_pending,true);assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity)).accepted,false);
 await p.evaluate(()=>held.style.setProperty=write);await release(p);assert.equal((await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity)).accepted,true);
 const q=await fixture(t);await applied(q);const foreignId=await id(q);await q.evaluate(()=>document.implementation.createHTMLDocument().adoptNode(document.querySelector('#comment')));await release(q);
 assert.equal((await q.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),foreignId)).accepted,false);
});
test('Worker restart retires old receiver even if token changes back; old completion response cannot clear debt',async t=>{
 const p=await fixture(t,{completion:'deferred'});await applied(p);const identity=await id(p);await release(p);
 await p.evaluate(identity=>{window.finishing=receiver.completeReservation(binding,identity,'completion-token');},identity);await p.waitForFunction(()=>checks.completion.length===1);
 await p.evaluate(()=>{worker='worker-two';checks.completion[0].resolve(true);});assert.equal((await p.evaluate(()=>finishing)).accepted,false);
 await p.evaluate(()=>worker='worker-one');assert.equal((await p.evaluate(()=>receiver.query())).revalidation_required,true);assert.equal((await p.evaluate(()=>receiver.query())).state.cleanup_pending,true);
});

test('truthy verification and Promise current guards are rejected rather than treated as authority',async t=>{
 for(const mode of ['truthy','promise']){const p=await fixture(t);await p.evaluate(async mode=>{const {IG04ContentReceiver}=await import('/content/ig04-receiver.mjs');receiver=new IG04ContentReceiver(document,{...opts,...(mode==='truthy'?{verifyInput:()=>({verified:true})}:{isCurrent:()=>Promise.resolve(true)})});},mode);assert.equal((await apply(p)).accepted,false);assert.equal(await hidden(p),false);}
});
test('Worker restart after an effect refuses old instance reuse and leaves cleanup for verified recovery',async t=>{
 const p=await fixture(t);await applied(p);await p.evaluate(()=>worker='worker-two');const q=await p.evaluate(()=>receiver.query());assert.equal(q.revalidation_required,true);assert.equal(q.state.cleanup_pending,true);assert.equal(await hidden(p),true);
 assert.equal((await release(p)).accepted,false);assert.equal((await apply(p)).accepted,false);
});
test('separate receivers share the Ledger without releasing another owner',async t=>{
 const p=await fixture(t);await applied(p);const firstId=await id(p);
 await p.evaluate(async()=>{const {IG04ContentReceiver}=await import('/content/ig04-receiver.mjs');window.secondInput=structuredClone(input);secondInput.context.scope.owner_binding_id='00000000-0000-4000-8000-000000000009';secondInput.context.scope.binding_id='00000000-0000-4000-8000-00000000000a';secondInput.context.operation_id='00000000-0000-4000-8000-00000000000b';
  window.other=new IG04ContentReceiver(document,{...opts,isCurrent:c=>current&&c.scope.owner_binding_id===secondInput.context.scope.owner_binding_id,verifyInput:(proof,e)=>proof==='other-input'&&e.context.operation_id===secondInput.context.operation_id,verifyRelease:proof=>proof==='other-release',verifyCompletion:proof=>proof==='other-completion'});await other.apply(secondInput,'other-input');});
 await p.waitForFunction(()=>requests.length===2);await p.waitForFunction(async()=>{const q=await other.query();return q.snapshot?.observation?.restricted_target_count===1;});
 await release(p);await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),firstId);assert.equal(await hidden(p),true);
 const secondId=await p.evaluate(async()=> (await other.query()).snapshot.gate.reservations[0].identity);await p.evaluate(()=>other.release(secondInput.context,'other-release'));assert.equal(await hidden(p),false);
 assert.equal((await p.evaluate(identity=>other.completeReservation(secondInput.context,identity,'other-completion'),secondId)).accepted,true);
});
test('old completed receiver duplicate ACK cannot close a newer same-scope Session',async t=>{
 const p=await fixture(t);await applied(p);const oldId=await id(p);await release(p);await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),oldId);
 await p.evaluate(async()=>{window.old=receiver;const {IG04ContentReceiver}=await import('/content/ig04-receiver.mjs');input.context.operation_id='00000000-0000-4000-8000-00000000000b';receiver=new IG04ContentReceiver(document,{...opts,verifyInput:()=>true});await receiver.apply(input,'new-fixture-proof');});await p.waitForFunction(()=>document.querySelector('#comment').inert);
 const duplicate=await p.evaluate(identity=>old.completeReservation(binding,identity,'completion-token'),oldId);assert.equal(duplicate.duplicate,true);assert.equal(await hidden(p),true);assert.equal((await p.evaluate(()=>receiver.query())).state.closed,false);
});
test('pending old Session blocks same-scope replacement without losing its reservation debt',async t=>{
 const p=await fixture(t);await applied(p);await release(p);
 const replacement=await p.evaluate(async()=>{const {IG04ContentReceiver}=await import('/content/ig04-receiver.mjs');const next=new IG04ContentReceiver(document,opts);return next.apply(input,'input-token');});
 assert.equal(replacement.accepted,false);assert.equal((await p.evaluate(()=>receiver.query())).state.cleanup_pending,true);
});
test('input is frozen before asynchronous authority validation and failed validation has no effect',async t=>{
 const p=await fixture(t,{input:'deferred'});await p.evaluate(()=>{window.opening=receiver.apply(input,'input-token');input.features[0].enabled=false;input.context.operation_id='00000000-0000-4000-8000-000000000099';});await p.waitForFunction(()=>checks.input.length===1);
 assert.equal(await p.evaluate(()=>checks.input[0].expected.features[0].enabled),true);await p.evaluate(()=>checks.input[0].resolve(true));assert.equal((await p.evaluate(()=>opening)).accepted,true);await p.waitForFunction(()=>document.querySelector('#comment').inert);
 const q=await fixture(t,{input:'deferred'});await q.evaluate(()=>{window.opening=receiver.apply(input,'input-token');});await q.waitForFunction(()=>checks.input.length===1);await q.evaluate(()=>checks.input[0].reject(Error('unconfirmed')));assert.equal((await q.evaluate(()=>opening)).accepted,false);assert.equal(await hidden(q),false);
});

test('a failed Content startup cannot be reported as an accepted duplicate apply',async t=>{
 const p=await fixture(t);await p.evaluate(async()=>{history.replaceState({},'','/accounts/login/');const {IG04ContentReceiver}=await import('/content/ig04-receiver.mjs');receiver=new IG04ContentReceiver(document,opts);});
 assert.equal((await apply(p)).accepted,false);assert.equal((await apply(p)).accepted,false);assert.equal(await hidden(p),false);
});
