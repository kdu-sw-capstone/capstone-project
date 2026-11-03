import test from 'node:test';
import assert from 'node:assert/strict';
import {ContentSessionAdapter} from '../content/session-adapter.mjs';
import {IG04ContentReceiver} from '../content/ig04-receiver.mjs';
import {HideReservationGate} from '../content/hide-reservation-gate.mjs';
import {ClaimLedger} from '../content/claim-ledger.mjs';
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
function bound(h){return {scope:{owner_binding_id:h.options.owner_binding_id,binding_id:h.options.binding_id,generation:1,owner_epoch:1,
  executor_id:'00000000-0000-4000-8000-000000000005',runtime_execution_id:'00000000-0000-4000-8000-000000000006',package_id:'00000000-0000-4000-8000-000000000007',runtime_revision:1,
  scope_epoch:'00000000-0000-4000-8000-000000000008',tab_id:1,frame_id:0,document_id:'node-fixture-document',document_instance_id:'00000000-0000-4000-8000-000000000004',url_sha256:'2'.repeat(64),focus_ref:null},
  operation_id:'00000000-0000-4000-8000-000000000003',semantic_sha256:'1'.repeat(64)};}


const enabled=[{feature_id:'IG-04',enabled:true,required:true}];
function receiverFixture(){const h=fixture();let worker='worker-1';
 const receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=>worker,getGeneration:()=>1,isCurrent:()=>true,
 verifyInput:()=>true,reserve:()=>new Promise(()=>{}),verifyRelease:()=>true,verifyCompletion:()=>false});
 return {...h,receiver,context:bound(h),worker:v=>worker=v};}
test('producer drains queued scan and detaches receiver, adapter and Session listeners',async()=>{
 const h=receiverFixture();await h.receiver.apply({context:h.context,features:enabled},'fixture');
 h.win.dispatchEvent(new Event('popstate'));
 const pending=h.receiver.quiescenceSnapshot();
 const q=await pending;
 assert.equal(q.local_only,true);assert.equal(q.native_verified,false);
 assert.equal(q.local_quiescence.locally_quiescent,true);
 assert.equal(q.local_quiescence.receiver_listeners_detached,true);
 assert.equal(q.snapshot.scan_scheduled,false);assert.equal(q.snapshot.scan_in_progress,false);
 for(const listeners of h.win.listeners.values())assert.equal(listeners.size,0);
 assert.equal(h.win.navigation.listeners.get('currententrychange').size,0);
 assert.equal(h.observers[0].observing,false);
 assert.equal(q.state.cleanup_pending,true,'stopping is not scoped RELEASE');
 assert.equal((await h.receiver.apply({context:h.context,features:enabled},'fixture')).accepted,false);
});
test('unbound receiver can retire its listeners without inventing a watch or plan',async()=>{
 const h=receiverFixture(),q=await h.receiver.quiescenceSnapshot();
 assert.equal(q.local_quiescence.locally_quiescent,true);assert.equal(q.state,null);assert.equal(q.snapshot,null);
 assert.equal(q.context,null);assert.equal(q.local_startup.adapter_start_called,false);
});
test('listener detach failure stays unconfirmed and a real retry can confirm removal',async()=>{
 const h=receiverFixture();await h.receiver.apply({context:h.context,features:enabled},'fixture');
 const remove=h.win.removeEventListener.bind(h.win);h.win.removeEventListener=()=>{throw Error('DETACH_FAILED');};
 const q=await h.receiver.quiescenceSnapshot();assert.equal(q.local_quiescence.locally_quiescent,false);
 assert.equal(q.state.cleanup_pending,true);
 h.win.removeEventListener=remove;
 assert.equal((await h.receiver.quiescenceSnapshot()).local_quiescence.locally_quiescent,true);
});
test('pending input verification is not drained until its real continuation exits',async()=>{
 const h=fixture();let resolve;
 const receiver=new IG04ContentReceiver(h.document,{getWorkerInstance:()=> 'worker-1',getGeneration:()=>1,isCurrent:()=>true,
 verifyInput:()=>new Promise(r=>resolve=r),reserve:()=>undefined,verifyRelease:()=>true,verifyCompletion:()=>false});
 const opening=receiver.apply({context:bound(h),features:enabled},'fixture');
 const q=await receiver.quiescenceSnapshot();assert.equal(q.local_quiescence.input_verification_pending,true);
 assert.equal(q.local_quiescence.locally_quiescent,false);assert.equal(q.local_startup.adapter_start_called,false);
 resolve(true);assert.equal((await opening).accepted,false);
 assert.equal((await receiver.quiescenceSnapshot()).local_quiescence.locally_quiescent,true);
 assert.equal(h.observers.length,0);
});
test('observer construction uncertainty never becomes confirmed zero resources',async()=>{
 const h=receiverFixture();h.win.MutationObserver=class{constructor(){throw Error('CONSTRUCT_UNCONFIRMED');}};
 assert.equal((await h.receiver.apply({context:h.context,features:enabled},'fixture')).accepted,false);
 const q=await h.receiver.quiescenceSnapshot();assert.equal(q.local_quiescence.locally_quiescent,false);
 assert.equal(q.snapshot.local_quiescence.observer_stopped,false);
});
test('observer disconnect failure is retained while remaining listeners still detach',async()=>{
 const h=receiverFixture();await h.receiver.apply({context:h.context,features:enabled},'fixture');
 const observer=h.observers[0],disconnect=observer.disconnect.bind(observer);observer.disconnect=()=>{throw Error('DISCONNECT_UNCONFIRMED');};
 const q=await h.receiver.quiescenceSnapshot();assert.equal(q.local_quiescence.locally_quiescent,false);
 assert.equal(q.snapshot.local_quiescence.observer_stopped,false);assert.equal(q.snapshot.local_quiescence.listeners_detached,true);
 observer.disconnect=disconnect;assert.equal((await h.receiver.quiescenceSnapshot()).local_quiescence.locally_quiescent,true);
});
test('Worker replacement during producer wait discards old snapshot without recovering old obligations',async()=>{
 const h=receiverFixture();await h.receiver.apply({context:h.context,features:enabled},'fixture');
 const original=ContentSessionAdapter.prototype.quiescenceSnapshot;let enter,resolve;
 const entered=new Promise(r=>enter=r),wait=new Promise(r=>resolve=r);
 ContentSessionAdapter.prototype.quiescenceSnapshot=async function(){const q=await original.call(this);enter();await wait;return q;};
 try{const pending=h.receiver.quiescenceSnapshot();await entered;h.worker('worker-2');resolve();const q=await pending;
 assert.equal(q.local_quiescence.locally_quiescent,false);assert.equal(q.snapshot,null);assert.equal(q.state.cleanup_pending,true);
 }finally{resolve();ContentSessionAdapter.prototype.quiescenceSnapshot=original;}
});
test('original binding and plan0 remain local; copies cannot authorize cleanup or reopen',async()=>{
 const h=receiverFixture();await h.receiver.apply({context:h.context,features:enabled},'fixture');
 const q=await h.receiver.quiescenceSnapshot();assert.deepEqual(q.context,h.context);
 assert.deepEqual(q.snapshot.gate.local_records,[]);assert.equal(q.snapshot.gate.closed,true);assert.equal(q.snapshot.dom_cleanup_confirmed,false);
 assert.throws(()=>q.context.operation_id='forged',TypeError);q.local_quiescence.locally_quiescent=false;
 const next=await h.receiver.quiescenceSnapshot();assert.deepEqual(next.context,h.context);
 assert.equal(next.local_quiescence.locally_quiescent,true);
 assert.equal((await h.receiver.completeReservation(h.context,null,'fixture')).accepted,false);
 const released=await h.receiver.release(h.context,'fixture');assert.equal(released.accepted,true);assert.equal(released.state.cleanup_pending,false);
});
test('foreign document cannot confirm lifetime even when all known listeners are detached',async()=>{
 const h=receiverFixture();await h.receiver.apply({context:h.context,features:enabled},'fixture');h.win.document={};
 const q=await h.receiver.quiescenceSnapshot();assert.equal(q.local_quiescence.lifetime_current,false);
 assert.equal(q.local_quiescence.locally_quiescent,false);assert.equal(q.state.cleanup_pending,true);
});
