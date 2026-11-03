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

// Node lifecycle doubles; hold delivery of the real adapter snapshot once.
function setup(){const h=fixture();let generation=1,worker='worker-1',authority=true;
 const receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=>worker,getGeneration:()=>generation,isCurrent:()=>authority,
 verifyInput:()=>true,reserve:()=>undefined,verifyRelease:()=>true,verifyCompletion:()=>false});
 return {h,receiver,context:bound(h),generation:v=>generation=v,worker:v=>worker=v,authority:v=>authority=v};}
async function holdSnapshot(run){const original=ContentSessionAdapter.prototype.evidenceSnapshot;let entered,finish;
 const ready=new Promise(r=>entered=r),wait=new Promise(r=>finish=r);let once=true;
 ContentSessionAdapter.prototype.evidenceSnapshot=async function(...args){const result=await original.apply(this,args);if(once){once=false;entered();await wait;}return result;};
 try{await run(ready,finish);}finally{finish();ContentSessionAdapter.prototype.evidenceSnapshot=original;}}
for(const change of ['release','document','generation','worker','observed-authority-loss'])test(`pending query rejects old snapshot after ${change}`,async()=>{
 const x=setup();assert.equal((await x.receiver.apply({context:x.context,features:x.h.options.features},'mock')).accepted,true);
 await holdSnapshot(async(ready,finish)=>{const pending=x.receiver.query();await ready;
 if(change==='release')await x.receiver.release(x.context,'mock-cleanup');
 if(change==='document')x.h.win.document={};
 if(change==='generation')x.generation(2);
 if(change==='worker')x.worker('worker-2');
 if(change==='observed-authority-loss'){x.authority(false);await x.receiver.query();x.authority(true);}
 finish();const q=await pending;assert.equal(q.snapshot,null,'old snapshot must not describe current receiver');
 if(change!=='release')assert.equal(q.revalidation_required,true);
 assert.equal(q.native_verified,false);
 });
});
test('normal pending snapshot is still returned',async()=>{const x=setup();await x.receiver.apply({context:x.context,features:x.h.options.features},'mock');
 await holdSnapshot(async(ready,finish)=>{const pending=x.receiver.query();await ready;finish();const q=await pending;assert.equal(q.phase,'BOUND_LOCAL');assert.equal(q.snapshot.observer_active,true);});});
test('apply cannot report accepted after release during its query wait',async()=>{const x=setup();await holdSnapshot(async(ready,finish)=>{
 const pending=x.receiver.apply({context:x.context,features:x.h.options.features},'mock');await ready;await x.receiver.release(x.context,'mock-cleanup');finish();assert.equal((await pending).accepted,false);
 });});

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
test('identity formed during actual hash wait remains attached to the original unresolved record',async()=>{
 const x=localGate({reserve:()=>new Promise(()=>{})});
 x.gate.hide('pending-local',x.element,()=>true);const original=x.gate.inspect().local_records[0];
 assert.equal(original.identity,null);const pending=x.gate.snapshot();const q=await pending;
 assert.equal(q.local_records[0].local_plan_id,original.local_plan_id);assert.ok(q.local_records[0].identity);
 assert.equal(q.local_records[0].obligation_pending,true);assert.equal(q.local_records[0].durable_commit_status,'UNCONFIRMED');x.gate.close();
});
test('fresh old-scope query after release preserves reservation debt and another owner',async()=>{
 const x=setup(),target=localTarget(x.h);x.h.document.querySelectorAll=s=>s.startsWith('textarea')?[target]:[];
 await x.receiver.apply({context:x.context,features:x.h.options.features},'mock');
 x.h.ledger.hide('foreign-owner',target);await x.receiver.release(x.context,'cleanup');
 const q=await x.receiver.query();assert.equal(q.phase,'CLOSED_LOCAL');assert.ok(q.snapshot);
 assert.equal(q.state.cleanup_pending,true);assert.ok(q.snapshot.gate.local_records.some(r=>r.obligation_pending));
 assert.equal(target.inert,true);x.h.ledger.release('foreign-owner');
});
test('duplicate apply cannot accept after Worker replacement during snapshot wait',async()=>{
 const x=setup();await x.receiver.apply({context:x.context,features:x.h.options.features},'mock');
 await holdSnapshot(async(ready,finish)=>{const pending=x.receiver.apply({context:x.context,features:x.h.options.features},'mock');await ready;
 x.worker('replacement');finish();assert.equal((await pending).accepted,false);});
});
