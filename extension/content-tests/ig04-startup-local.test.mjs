import test from 'node:test';
import assert from 'node:assert/strict';
import {ContentSessionAdapter} from '../content/session-adapter.mjs';
import {IG04ContentReceiver} from '../content/ig04-receiver.mjs';
import {ClaimLedger} from '../content/claim-ledger.mjs';
import {HideReservationGate} from '../content/hide-reservation-gate.mjs';

// Node-only lifecycle double: no browser, native identity, DOM effect or Core ACK.
class Events extends EventTarget {
  listeners=new Map();
  addEventListener(type,fn,...rest){super.addEventListener(type,fn,...rest);if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn,...rest){super.removeEventListener(type,fn,...rest);this.listeners.get(type)?.delete(fn);}
}
function fixture(){
  const win=new Events(),observers=[];
  const document={location:new URL('https://www.instagram.com/p/local/'),documentElement:{},querySelectorAll:()=>[],querySelector:()=>null};
  document.defaultView=win;win.document=document;win.top=win;win.navigation=new Events();
  win.MutationObserver=class {observing=false;constructor(){observers.push(this);}observe(){this.observing=true;}disconnect(){this.observing=false;}};
  const ledger=new ClaimLedger(document),owner_binding_id='00000000-0000-4000-8000-000000000001',binding_id='00000000-0000-4000-8000-000000000002';
  const options={owner_binding_id,binding_id,ledger,features:[{feature_id:'IG-04',enabled:true,required:true}],isCurrent:()=>true};
  return {win,document,ledger,observers,options};
}
test('unstarted receiver still reports its own listeners rather than an empty watch',async()=>{
  const h=fixture(),receiver=new IG04ContentReceiver(h.document,{getWorkerInstance:()=> 'node-fixture-worker'}),q=await receiver.query();
  assert.equal(q.state,null);assert.equal(q.phase,'UNBOUND');
  assert.equal(h.win.listeners.get('pagehide').size,1);
  assert.equal(q.local_startup.adapter_start_called,false);
  assert.equal(q.local_startup.receiver_resources_may_remain,true);
  assert.equal(q.native_verified,false);
});
test('pagehide registration failure after attachment is recorded as partial start',()=>{
  const h=fixture(),original=h.win.addEventListener.bind(h.win);
  h.win.addEventListener=(...args)=>{original(...args);throw Error('LISTENER_ATTACH_UNCONFIRMED');};
  const adapter=new ContentSessionAdapter(h.document,h.options);
  assert.throws(()=>adapter.start(),/LISTENER_ATTACH_UNCONFIRMED/);
  const q=adapter.inspect();assert.equal(q.started,true);
  assert.equal(q.local_startup.phase,'FAILED_OR_PARTIAL');
  assert.equal(q.local_startup.pagehide_listener,'UNCONFIRMED');
  assert.equal(q.local_startup.resources_may_remain,true);
  h.win.addEventListener=original;
  assert.equal(adapter.release().local_startup.resources_may_remain,false);
});
test('zero-plan observation is a started resource-owning session',async()=>{
  const h=fixture(),adapter=new ContentSessionAdapter(h.document,h.options),q=adapter.start();
  assert.equal(h.observers.length,1);assert.equal(h.observers[0].observing,true);
  assert.equal(q.local_startup.phase,'RETURNED');
  assert.equal(q.local_startup.session_start_attempts,1);
  assert.equal(q.local_startup.session_start_returned,1);
  assert.equal(q.local_startup.resources_may_remain,true);
  const snapshot=await adapter.evidenceSnapshot();assert.equal(snapshot.gate,null);assert.equal(snapshot.observer_active,true);
  assert.equal(adapter.release().cleanup_pending,false);
});

test('authority rejection records entry without inventing a resource-free receiver or a scope',()=>{
  const h=fixture(),adapter=new ContentSessionAdapter(h.document,{...h.options,isCurrent:()=>false});
  assert.equal(adapter.inspect().local_startup.phase,'NOT_ENTERED');
  assert.throws(()=>adapter.start(),/CURRENT_AUTHORITY_REJECTED/);
  const q=adapter.inspect();assert.equal(q.started,false);assert.equal(q.local_startup.phase,'FAILED_BEFORE_RESOURCES');
  assert.equal(q.local_startup.start_calls,1);assert.equal(q.local_startup.session_start_attempts,0);
  assert.equal(q.local_startup.scope_registered,false);assert.equal(q.local_startup.pagehide_listener,'NOT_ATTEMPTED');
});
test('observer construction side effects followed by throw stay unconfirmed after known cleanup',()=>{
  const h=fixture();h.win.MutationObserver=class {
    observing=true;constructor(){h.observers.push(this);throw Error('OBSERVER_CONSTRUCTION_UNCONFIRMED');}
  };
  const adapter=new ContentSessionAdapter(h.document,h.options),q=adapter.start();
  assert.equal(q.startup_error,'OBSERVER_CONSTRUCTION_UNCONFIRMED');assert.equal(q.local_startup.first_failure,q.startup_error);
  assert.equal(q.local_startup.sessions_constructed,1);assert.equal(q.local_startup.session_start_attempts,1);
  assert.equal(q.local_startup.session_start_returned,0);assert.equal(q.local_startup.phase,'FAILED_OR_PARTIAL');
  assert.equal(q.local_startup.resource_uncertainty,true);assert.equal(q.local_startup.resources_may_remain,true);
  // The double's orphan resource is evidence of uncertainty, not a real browser observer.
  assert.equal(h.observers[0].observing,true);h.observers[0].observing=false;
  assert.equal(adapter.release().local_startup.resource_uncertainty,true);
});
test('failed listener removal keeps local resource uncertainty and supports an explicit retry',()=>{
  const h=fixture(),adapter=new ContentSessionAdapter(h.document,h.options);adapter.start();
  const remove=h.win.removeEventListener.bind(h.win);h.win.removeEventListener=()=>{throw Error('REMOVE_UNCONFIRMED');};
  assert.equal(adapter.release().cleanup_pending,true);
  assert.equal(adapter.inspect().local_startup.resources_may_remain,true);
  h.win.removeEventListener=remove;assert.equal(adapter.release().local_startup.resources_may_remain,false);
});
for(const action of ['release','invalidate'])test(`${action} before start prevents any late startup resources`,()=>{
  const h=fixture(),adapter=new ContentSessionAdapter(h.document,h.options);adapter[action]();
  assert.throws(()=>adapter.start(),/CURRENT_AUTHORITY_REJECTED/);
  const q=adapter.inspect();assert.equal(q.started,false);assert.equal(q.local_startup.session_construct_attempts,0);
  assert.equal(q.local_startup.resources_may_remain,false);assert.equal(h.observers.length,0);
});
test('startup diagnostic copies cannot clear private resource tracking',()=>{
  const h=fixture(),adapter=new ContentSessionAdapter(h.document,h.options),q=adapter.start();
  q.local_startup.pagehide_listener='REMOVED';q.local_startup.resources_may_remain=false;
  assert.equal(adapter.inspect().local_startup.resources_may_remain,true);adapter.release();
});
function bound(h){return {scope:{owner_binding_id:h.options.owner_binding_id,binding_id:h.options.binding_id,generation:1,owner_epoch:1,
  executor_id:'00000000-0000-4000-8000-000000000005',runtime_execution_id:'00000000-0000-4000-8000-000000000006',package_id:'00000000-0000-4000-8000-000000000007',runtime_revision:1,
  scope_epoch:'00000000-0000-4000-8000-000000000008',tab_id:1,frame_id:0,document_id:'node-fixture-document',document_instance_id:'00000000-0000-4000-8000-000000000004',url_sha256:'2'.repeat(64),focus_ref:null},
  operation_id:'00000000-0000-4000-8000-000000000003',semantic_sha256:'1'.repeat(64)};}
test('scoped release while input verification waits records adapter non-entry with receiver debt',async()=>{
  const h=fixture(),context=bound(h);let resolve,calls=0;
  const receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=> 'node-worker',getGeneration:()=>1,isCurrent:()=>true,
    verifyInput:()=>new Promise(r=>resolve=r),reserve:()=>{calls++;},verifyRelease:()=>true,verifyCompletion:()=>true});
  const opening=receiver.apply({context,features:h.options.features},'fixture-proof');
  const ended=await receiver.release(context,'fixture-cleanup');resolve(true);const late=await opening;
  assert.equal(ended.accepted,true);assert.equal(late.accepted,false);assert.equal(calls,0);
  assert.equal(late.local_startup.adapter_start_called,false);assert.equal(late.local_startup.adapter_created,false);
  assert.equal(late.local_startup.receiver_resources_may_remain,true);assert.equal(h.observers.length,0);
});
test('receiver plan0 snapshot keeps receiver and adapter resource ownership separate',async()=>{
  const h=fixture(),context=bound(h);let calls=0;
  const receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=> 'node-worker',getGeneration:()=>1,isCurrent:()=>true,
    verifyInput:()=>true,reserve:()=>{calls++;},verifyRelease:()=>true,verifyCompletion:()=>true});
  const started=await receiver.apply({context,features:h.options.features},'fixture-proof');
  assert.equal(started.accepted,true);assert.equal(started.local_startup.adapter_start_called,true);
  assert.equal(started.state.local_startup.session_start_returned,1);assert.equal(started.snapshot.observer_active,true);
  assert.equal(started.snapshot.gate.reservations.length,0);assert.equal(calls,0);
  const ended=await receiver.release(context,'fixture-cleanup');
  assert.equal(ended.state.local_startup.resources_may_remain,false);assert.equal(ended.local_startup.receiver_resources_may_remain,true);
  assert.equal(ended.native_verified,false);assert.equal(ended.local_only,true);
});
test('adapter construction rejection after input verification is not a resource-free receiver',async()=>{
  const h=fixture(),receiver=new IG04ContentReceiver(h.document,{ledger:{},getWorkerInstance:()=> 'node-worker',getGeneration:()=>1,isCurrent:()=>true,
    verifyInput:()=>true,reserve:()=>assert.fail('no reservation'),verifyRelease:()=>true,verifyCompletion:()=>true});
  const denied=await receiver.apply({context:bound(h),features:h.options.features},'fixture-proof');
  assert.equal(denied.accepted,false);assert.equal(denied.reason,'CONTENT_START_FAILED');
  assert.equal(denied.local_startup.adapter_created,false);assert.equal(denied.local_startup.adapter_start_called,false);
  assert.equal(denied.local_startup.receiver_resources_may_remain,true);assert.equal(h.observers.length,0);
});

for(const invalid of ['truthy-input','async-current'])test(`${invalid} still rejects before adapter start`,async()=>{
  const h=fixture(),receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=> 'node-worker',getGeneration:()=>1,
    isCurrent:()=>invalid==='async-current'?Promise.resolve(true):true,verifyInput:()=>invalid==='truthy-input'?'yes':true,
    reserve:()=>assert.fail('no reservation'),verifyRelease:()=>true,verifyCompletion:()=>true});
  const q=await receiver.apply({context:bound(h),features:h.options.features},'fixture-proof');
  assert.equal(q.accepted,false);assert.equal(q.local_startup.adapter_start_called,false);assert.equal(h.observers.length,0);
});
test('existing gate revision still retains a pending local obligation after another close',async()=>{
  const h=fixture(),values=new Map([['display',['grid','important']]]),element={ownerDocument:h.document,isConnected:true,inert:false,
    style:{getPropertyValue:k=>values.get(k)?.[0]??'',getPropertyPriority:k=>values.get(k)?.[1]??''}};
  let entered,reply;const verifying=new Promise(r=>entered=r);
  const gate=new HideReservationGate(h.ledger,{getGeneration:()=>1,context:bound(h),verifyContext:()=>true,reserve:p=>p.plan_id,
    verifyCompletion:()=>{entered();return new Promise(r=>reply=r);}},()=>{},h.options);
  gate.hide('node-local-plan',element,()=>true);const identity=(await gate.snapshot()).reservations[0].identity;
  gate.close();const completion=gate.completeReservation(identity,'fixture-proof',()=>true);await verifying;
  gate.close();reply(true);assert.equal((await completion).accepted,false);assert.equal(gate.inspect().reservation_obligations.length,1);
});

function localTarget(h){
  const values=new Map([['display',['grid','important']]]),element={ownerDocument:h.document,isConnected:true,inert:false,
    closest:()=>null,querySelector:()=>null,getAttribute:k=>k==='placeholder'?'Add a comment':null,contains:node=>node===element,
    style:{getPropertyValue:k=>values.get(k)?.[0]??'',getPropertyPriority:k=>values.get(k)?.[1]??'',
      setProperty:(k,v,p='')=>values.set(k,[v,p]),removeProperty:k=>values.delete(k)}};
  h.win.getComputedStyle=e=>({display:e.style.getPropertyValue('display')});
  return element;
}
function localGate(options={}){
  const h=fixture(),element=localTarget(h);
  const gate=new HideReservationGate(h.ledger,{context:bound(h),getGeneration:()=>1,verifyContext:()=>true,reserve:()=>new Promise(()=>{}),...options},()=>{},h.options);
  return {...h,gate,element};
}
test('local obligation exists synchronously before reservation identity hashing finishes',async()=>{
  const h=localGate();h.gate.hide('null-identity',h.element,()=>true);
  const before=h.gate.inspect();h.gate.close();
  assert.equal(before.local_records.length,1);assert.equal(before.local_records[0].identity,null);
  assert.equal(before.local_records[0].obligation_pending,true);assert.equal(before.local_records[0].reserve_called,false);
  const after=await h.gate.snapshot();assert.equal(after.local_records[0].local_plan_id,before.local_records[0].local_plan_id);
});
test('identity creation binds back to the same local record without confirming a durable commit',async()=>{
  const h=localGate({reserve:p=>p.plan_id});h.gate.hide('identity-ready',h.element,()=>true);
  const id=h.gate.inspect().local_records?.[0]?.local_plan_id;
  const after=await h.gate.snapshot();h.gate.close();
  assert.ok(id);assert.equal(after.local_records[0].local_plan_id,id);assert.ok(after.local_records[0].identity);
  assert.equal(after.local_records[0].identity.plan_id,after.local_records[0].plan_id);
  assert.equal(after.local_records[0].durable_commit_status,'UNCONFIRMED');
});
test('plan0 does not erase the adapter observer or receiver listener tracking',async()=>{
  const h=fixture(),receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=> 'node-worker',getGeneration:()=>1,isCurrent:()=>true,
    verifyInput:()=>true,reserve:()=>assert.fail('no DOM plan'),verifyRelease:()=>true,verifyCompletion:()=>true});
  const q=await receiver.apply({context:bound(h),features:h.options.features},'fixture-proof');
  await receiver.release(bound(h),'fixture-cleanup');
  assert.deepEqual(q.snapshot.gate.local_records,[]);assert.equal(q.snapshot.observer_active,true);
  assert.equal(q.local_startup.receiver_resources_may_remain,true);assert.equal(q.state.local_startup.resources_may_remain,true);
});
test('hash failure retains a null-identity record without inventing an external reservation call',async t=>{
  t.mock.method(crypto.subtle,'digest',()=>Promise.reject(Error('HASH_UNCONFIRMED')));
  let calls=0;const h=localGate({reserve:()=>{calls++;}});h.gate.hide('hash-failed',h.element,()=>true);
  const id=h.gate.inspect().local_records[0].local_plan_id;const q=await h.gate.snapshot();h.gate.close();
  assert.equal(q.local_records[0].local_plan_id,id);assert.equal(q.local_records[0].identity,null);
  assert.equal(q.local_records[0].obligation_pending,true);assert.equal(q.local_records[0].state,'UNCONFIRMED');assert.equal(calls,0);
  assert.equal(q.local_tracking.context_scope.document_instance_id,bound(h).scope.document_instance_id);
});
test('timeout and late matching reply preserve the same unconfirmed local obligation',async()=>{
  let entered,resolveReply,aborted;const started=new Promise(r=>entered=r),timedOut=new Promise(r=>aborted=r);
  const h=localGate({timeoutMs:10,reserve:(p,{signal})=>{signal.addEventListener('abort',aborted,{once:true});entered(p);return new Promise(r=>resolveReply=r);}});
  h.gate.hide('lost-response',h.element,()=>true);const plan=await started;await timedOut;
  const waiting=h.gate.inspect(),first=waiting.local_records[0];assert.equal(first.state,'TIMED_OUT');assert.equal(first.reserve_called,true);assert.equal(first.reserve_reply,'UNOBSERVED');
  assert.equal(first.reserve_reply_pending,true);assert.equal(waiting.local_tracking.reserve_callbacks_unsettled,1);
  resolveReply(plan.plan_id);await new Promise(setImmediate);const late=h.gate.inspect().local_records[0];h.gate.close();
  assert.equal(late.local_plan_id,first.local_plan_id);assert.equal(late.state,'TIMED_OUT');assert.equal(late.reserve_reply,'MATCHING_PLAN_ID');
  assert.equal(late.reserve_reply_pending,false);assert.equal(h.gate.inspect().local_tracking.reserve_callbacks_unsettled,0);
  assert.equal(late.obligation_pending,true);assert.equal(late.durable_commit_status,'UNCONFIRMED');assert.equal(h.element.inert,false);
});
test('synchronous reserve failure and release-before-hash never drop a local record',async()=>{
  const h=localGate({reserve:()=>{throw Error('STORE_UNCONFIRMED');}});h.gate.hide('throwing-store',h.element,()=>true);
  await h.gate.snapshot();await new Promise(setImmediate);const failed=h.gate.inspect().local_records[0];h.gate.close();
  assert.equal(failed.reserve_called,true);assert.equal(failed.reserve_reply,'THREW');assert.equal(failed.state,'UNCONFIRMED');assert.equal(failed.obligation_pending,true);
  const other=localGate({reserve:()=>assert.fail('closed before dispatch')});other.gate.hide('early-release',other.element,()=>true);
  const before=other.gate.inspect().local_records[0];other.gate.close();const after=(await other.gate.snapshot()).local_records[0];
  assert.equal(after.local_plan_id,before.local_plan_id);assert.equal(after.reserve_called,false);assert.equal(after.state,'CANCELLED');assert.equal(after.obligation_pending,true);
});
test('per-record completion leaves the other record and common receiver resources intact',async()=>{
  const h=fixture(),targets=[localTarget(h),localTarget(h)];h.document.querySelectorAll=selector=>selector.startsWith('textarea')?targets:[];
  const receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=> 'node-worker',getGeneration:()=>1,isCurrent:()=>true,
    verifyInput:()=>true,reserve:p=>p.plan_id,verifyRelease:()=>true,verifyCompletion:()=>true});
  await receiver.apply({context:bound(h),features:h.options.features},'fixture-proof');await new Promise(setImmediate);
  h.ledger.hide('unrelated-owner',targets[0]);await receiver.release(bound(h),'fixture-cleanup');
  const before=await receiver.query(),records=before.snapshot.gate.local_records;assert.equal(records.length,2);
  assert.notEqual(records[0].local_plan_id,records[1].local_plan_id);
  await receiver.completeReservation(bound(h),records[0].identity,'fixture-proof');
  const partial=await receiver.query();assert.equal(partial.snapshot.gate.local_records.filter(r=>r.obligation_pending).length,1);
  assert.equal(partial.local_startup.receiver_resources_may_remain,true);assert.equal(targets[0].inert,true);
  await receiver.completeReservation(bound(h),records[1].identity,'fixture-proof');
  const ended=await receiver.query();assert.equal(ended.snapshot.gate.local_records.length,2);
  assert.equal(ended.local_startup.receiver_resources_may_remain,true);assert.equal(ended.native_verified,false);
  assert.equal(targets[0].inert,true);h.ledger.release('unrelated-owner');assert.equal(targets[0].inert,false);
  assert.ok(ended.snapshot.gate.local_records.every(r=>r.durable_commit_status==='UNCONFIRMED'));
});
test('local tracking copies cannot change identity membership or fabricate watch/cutoff references',async()=>{
  const h=localGate();h.gate.hide('copy',h.element,()=>true);const q=h.gate.inspect(),id=q.local_records[0].local_plan_id;
  q.local_records[0].obligation_pending=false;q.local_records[0].local_plan_id='forged';
  const actual=h.gate.inspect();h.gate.close();assert.equal(actual.local_records[0].local_plan_id,id);assert.equal(actual.local_records[0].obligation_pending,true);
  assert.equal(Object.hasOwn(actual.local_tracking,'watch_ref'),false);assert.equal(Object.hasOwn(actual.local_tracking,'cutoff_ref'),false);
  assert.equal(actual.local_tracking.context_scope.document_instance_id,bound(h).scope.document_instance_id);
  assert.equal(actual.local_tracking.native_verified,false);await h.gate.snapshot();
});
