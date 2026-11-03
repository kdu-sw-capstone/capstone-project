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
test('scan0 closes initial/dynamic reservation effects while retaining an unsettled external callback',async t=>{
 const p=await fixture(t,{reservation:'deferred'});await apply(p);await p.waitForFunction(()=>requests.length===1);
 const q=await p.evaluate(()=>receiver.quiescenceSnapshot());assert.equal(q.local_quiescence.locally_quiescent,false);
 assert.equal(q.snapshot.local_quiescence.reservation_callbacks_settled,false);
 assert.equal(q.snapshot.scan_in_progress,false);assert.equal(q.snapshot.scan_scheduled,false);assert.equal(q.snapshot.observer_active,false);
 assert.equal(q.snapshot.gate.local_tracking.reserve_callbacks_unsettled,1);assert.equal(q.state.cleanup_pending,true);
 await p.evaluate(markup=>{requests[0].resolve(requests[0].plan.plan_id);document.querySelector('ul').insertAdjacentHTML('beforeend',markup);},row('late',2));
 await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,20)));
 assert.equal(await hidden(p),false);assert.equal(await p.locator('#late').evaluate(e=>e.inert),false);assert.equal(await p.evaluate(()=>requests.length),1);
 const next=await p.evaluate(()=>receiver.quiescenceSnapshot());assert.equal(next.snapshot.gate.local_records[0].obligation_pending,true);
 assert.equal(next.snapshot.gate.local_tracking.reserve_callbacks_unsettled,0);assert.equal(next.local_quiescence.locally_quiescent,true);
});
test('scan0 is not restoration or completion; scoped release preserves another owner and original styles',async t=>{
 const p=await fixture(t);await applied(p);
 await p.evaluate(()=>ledger.hide('other-owner',document.querySelector('#comment')));
 const q=await p.evaluate(()=>receiver.quiescenceSnapshot());assert.equal(q.local_quiescence.locally_quiescent,true);
 assert.equal(await hidden(p),true);assert.equal(q.snapshot.dom_cleanup_confirmed,false);
 assert.equal((await release(p)).state.cleanup_pending,true);assert.equal(await hidden(p),true);
 await p.evaluate(()=>ledger.release('other-owner'));assert.equal(await hidden(p),false);
 const css=await p.locator('#comment').evaluate(e=>[e.style.display,e.style.getPropertyPriority('display')]);assert.deepEqual(css,['grid','important']);
 const identity=await id(p);const completed=await p.evaluate(identity=>receiver.completeReservation(binding,identity,'completion-token'),identity);
 assert.equal(completed.accepted,true);assert.equal(completed.state.cleanup_pending,false);
});
test('reentrant scan stop waits actual stack unwind and never schedules a second effect',async t=>{
 const p=await fixture(t,{reservation:'deferred'});await apply(p);await p.waitForFunction(()=>requests.length===1);
 await p.evaluate(()=>{
  const proto=CSSStyleDeclaration.prototype,original=proto.setProperty;window.restoreSetter=()=>proto.setProperty=original;
  window.stopCalls=0;proto.setProperty=function(...args){const result=original.apply(this,args);if(args[0]==='display'&&args[1]==='none'&&!stopCalls++){window.stopped=receiver.quiescenceSnapshot();}return result;};
  requests[0].resolve(requests[0].plan.plan_id);
 });
 await p.waitForFunction(()=>!!window.stopped);const q=await p.evaluate(async()=>{const q=await stopped;restoreSetter();return q;});
 assert.equal(q.local_quiescence.locally_quiescent,true);assert.equal(q.snapshot.scan_in_progress,false);assert.equal(q.snapshot.scan_scheduled,false);
 assert.equal(q.state.cleanup_pending,true);assert.equal(q.snapshot.gate.local_records.length,1);
 await release(p);assert.equal(await hidden(p),false);
});
for(const event of ['spa','pagehide'])test(`scan0 can query retired ${event} instance and keep original cleanup scope`,async t=>{
 const p=await fixture(t);await applied(p);
 await p.evaluate(event=>event==='spa'?history.pushState({},'', '/p/other/'):dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})),event);
 const q=await p.evaluate(()=>receiver.quiescenceSnapshot());assert.equal(q.local_quiescence.locally_quiescent,true);
 assert.equal(q.context.scope.generation,1);assert.equal((await apply(p)).accepted,false);
 assert.equal((await release(p)).accepted,true);assert.equal(await hidden(p),false);
});
test('partial restoration is not erased by scan0 and can retry through original scoped release',async t=>{
 const p=await fixture(t);await applied(p);
 await p.evaluate(()=>{const style=document.querySelector('#comment').style,original=style.setProperty.bind(style);window.allowRestore=false;style.setProperty=(key,...args)=>{if(key==='display'&&!allowRestore)throw Error('RESTORE_FAILED');return original(key,...args);};});
 const first=await release(p);assert.equal(first.state.cleanup_pending,true);
 const q=await p.evaluate(()=>receiver.quiescenceSnapshot());assert.equal(q.local_quiescence.locally_quiescent,true);assert.equal(q.snapshot.dom_cleanup_confirmed,false);
 await p.evaluate(()=>allowRestore=true);await release(p);assert.equal(await hidden(p),false);
 assert.equal((await p.evaluate(()=>receiver.query())).state.cleanup_pending,true);
});
