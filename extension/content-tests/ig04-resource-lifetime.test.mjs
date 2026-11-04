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
function setup(extra={}){const h=fixture();let authority=true,generation=1,worker='worker-1';const receiver=new IG04ContentReceiver(h.document,{ledger:h.ledger,getWorkerInstance:()=>worker,getGeneration:()=>generation,isCurrent:()=>authority,
 verifyInput:()=>true,prepareResources:()=>true,reserve:()=>new Promise(()=>{}),verifyRelease:()=>true,verifyCompletion:()=>false,...extra});return {...h,receiver,context:bound(h),authority:v=>authority=v,generation:v=>generation=v,worker:v=>worker=v};}
const listeners=h=>[...h.win.listeners.values(),...h.win.navigation.listeners.values()].reduce((n,s)=>n+s.size,0);
const apply=h=>h.receiver.apply({context:h.context,features:enabled},'fixture-only');
test('constructor is synchronous and allocates no listeners before preparation',async()=>{const h=setup();assert.equal(listeners(h),0);assert.equal((await h.receiver.query()).local_startup.receiver_resources_may_remain,false);});
test('false preparation denies adapter and receiver resource installation',async()=>{const h=setup({prepareResources:()=>false});const q=await apply(h);assert.equal(q.accepted,false);assert.equal(listeners(h),0);assert.equal(q.local_startup.adapter_start_called,false);});

const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('missing preparation is fail-closed without installing receiver resources',async()=>{const h=setup({prepareResources:undefined});const q=await apply(h);assert.equal(q.accepted,false);assert.equal(listeners(h),0);assert.equal(q.local_startup.adapter_start_called,false);});
for(const value of ['yes',{ready:true}])test(`truthy preparation ${typeof value} is not confirmation`,async()=>{const h=setup({prepareResources:()=>value});const q=await apply(h);assert.equal(q.accepted,false);assert.equal(listeners(h),0);assert.equal(q.cleanup_pending,true);assert.equal(q.local_lifetime.remaining.resources.some(r=>r.kind==='receiver.preparation_obligation'),true);});
test('pending preparation preserves original context but late strict true cannot prove missed lifetime',async()=>{let resolve;const h=setup({prepareResources:()=>new Promise(r=>resolve=r)});const pending=apply(h);await tick();
 const waiting=await h.receiver.query();assert.equal(listeners(h),0);assert.equal(waiting.local_lifetime.pending_work.some(r=>r.kind==='receiver.prepareResources'),true);assert.deepEqual(waiting.local_lifetime.context,h.context);
 resolve(true);const denied=await pending;assert.equal(denied.accepted,false);assert.equal(denied.reason,'RESOURCE_LIFETIME_REVALIDATION_REQUIRED');assert.equal(listeners(h),0);assert.equal(denied.cleanup_pending,true);});
for(const action of ['release','generation','worker','document','invalidate'])test(`preparation response after ${action} cannot install a resource or forget uncertainty`,async()=>{let resolve;const h=setup({prepareResources:()=>new Promise(r=>resolve=r)});const pending=apply(h);await tick();
 if(action==='release')await h.receiver.release(h.context,'fixture');if(action==='generation')h.generation(2);if(action==='worker')h.worker('worker-2');if(action==='document')h.win.document={};if(action==='invalidate')h.receiver.invalidate();
 resolve(true);const q=await pending;assert.equal(q.accepted,false);assert.equal(listeners(h),0);assert.equal(q.local_startup.adapter_start_called,false);assert.equal(q.local_lifetime.remaining.resources.some(r=>r.kind==='receiver.preparation_obligation'),true);
});
test('throwing preparation retains the attempted obligation without creating listeners',async()=>{const h=setup({prepareResources:()=>{throw Error('UNCONFIRMED');}});const q=await apply(h);assert.equal(q.accepted,false);assert.equal(q.cleanup_pending,true);assert.equal(q.local_lifetime.totals['receiver.prepareResources'].threw,1);assert.equal(listeners(h),0);});
test('partial listener installation and failed removal remain on original instance until a real retry',async()=>{const h=setup(),add=h.win.addEventListener.bind(h.win),remove=h.win.removeEventListener.bind(h.win);
 h.win.addEventListener=(...args)=>{add(...args);throw Error('PARTIAL_ADD');};h.win.removeEventListener=()=>{throw Error('REMOVE_FAILED');};
 const q=await apply(h);assert.equal(q.accepted,false);assert.equal(q.local_startup.adapter_start_called,false);assert.equal(q.local_lifetime.remaining.resources.some(r=>r.kind==='receiver.pagehide'),true);
 const original=q.local_lifetime.origin.receiver_instance_id;h.win.removeEventListener=remove;const stopped=await h.receiver.quiescenceSnapshot();assert.equal(listeners(h),0);assert.equal(stopped.local_lifetime.origin.receiver_instance_id,original);assert.equal(stopped.local_quiescence.locally_quiescent,true);
});
test('synchronous retirement before the actual listener add cannot leak a late listener',async()=>{const h=setup(),add=h.win.addEventListener.bind(h.win);h.win.addEventListener=(...args)=>{h.receiver.invalidate();add(...args);};
 const q=await apply(h);assert.equal(q.accepted,false);assert.equal(listeners(h),0);assert.equal(q.local_lifetime.remaining.resources.length,0);assert.equal(q.local_startup.adapter_start_called,false);});
test('release authorization continuation is observed after opening and scans are zero',async()=>{let resolve;const h=setup({verifyRelease:()=>new Promise(r=>resolve=r)});await apply(h);const pending=h.receiver.release(h.context,'fixture');await tick();
 const q=await h.receiver.quiescenceSnapshot();assert.equal(q.local_quiescence.input_verification_pending,false);assert.equal(q.snapshot.scan_in_progress,false);assert.equal(q.local_quiescence.locally_quiescent,false);assert.equal(q.local_lifetime.pending_work.some(r=>r.kind==='receiver.verifyRelease'),true);
 resolve(true);await pending;assert.equal((await h.receiver.quiescenceSnapshot()).local_quiescence.locally_quiescent,true);
});
for(const callback of ['observation','invalidation'])test(`adapter ${callback} promise is tracked even with no error or input work`,async()=>{const {LocalLifetime}=await import('../content/local-lifetime.mjs');const h=fixture(),records=new LocalLifetime({receiver_instance_id:'local-fixture'});let resolve;
 const options={...h.options,localLifetime:records};options[callback==='observation'?'onObservation':'onInvalidated']=()=>new Promise(r=>resolve=r);
 const adapter=new ContentSessionAdapter(h.document,options);adapter.start();if(callback==='invalidation')adapter.invalidate();
 const q=await adapter.quiescenceSnapshot();assert.equal(q.state.callback_error_count,0);assert.equal(q.snapshot.scan_in_progress,false);assert.equal(q.local_quiescence.locally_quiescent,false);assert.equal(records.snapshot().pending_work.some(r=>r.kind==='adapter.callback'),true);
 resolve();await tick();assert.equal(adapter.release().cleanup_pending,false);assert.equal(records.snapshot().drained,true);
});
test('scheduled scan is retained until its actual microtask returns after invalidation',async()=>{const {LocalLifetime}=await import('../content/local-lifetime.mjs');const h=fixture(),records=new LocalLifetime({receiver_instance_id:'local-fixture'}),adapter=new ContentSessionAdapter(h.document,{...h.options,localLifetime:records});
 adapter.start();h.win.dispatchEvent(new Event('popstate'));adapter.invalidate();assert.equal(records.snapshot().pending_work.some(r=>r.kind==='session.scheduled_scan'),true);await tick();assert.equal(records.snapshot().pending_work.length,0);adapter.release();assert.equal(records.snapshot().drained,true);
});
test('callback rejection records actual exit and error without inventing a pending input',async()=>{const {LocalLifetime}=await import('../content/local-lifetime.mjs');const h=fixture(),records=new LocalLifetime({receiver_instance_id:'local-fixture'});let reject;
 const adapter=new ContentSessionAdapter(h.document,{...h.options,localLifetime:records,onObservation:()=>new Promise((_,r)=>reject=r)});adapter.start();adapter.invalidate();reject(Error('CALLBACK_FAILED'));await tick();
 assert.equal(records.snapshot().pending_work.length,0);assert.equal(adapter.inspect().callback_error_count,1);assert.equal(adapter.release().cleanup_pending,false);
});
test('local records are owned copies; completed work is compacted and identifiers are never reused',async()=>{const {LocalLifetime}=await import('../content/local-lifetime.mjs');const records=new LocalLifetime({receiver_instance_id:'one'}),context={operation_id:'original'};records.bindContext(context);context.operation_id='changed';
 const first=records.begin('scan'),id=records.snapshot().pending_work[0].id;first.finish();first.finish();const second=records.begin('scan'),q=records.snapshot();assert.notEqual(q.pending_work[0].id,id);assert.equal(q.totals.scan.returned,1);assert.equal(q.context.operation_id,'original');q.remaining.work.length=0;q.context.operation_id='forged';assert.equal(records.snapshot().pending_work.length,1);assert.equal(records.snapshot().context.operation_id,'original');second.finish();
});

function localTarget(h){
  const values=new Map([['display',['grid','important']]]),element={ownerDocument:h.document,isConnected:true,inert:false,
    closest:()=>null,querySelector:()=>null,getAttribute:k=>k==='placeholder'?'Add a comment':null,contains:node=>node===element,
    style:{getPropertyValue:k=>values.get(k)?.[0]??'',getPropertyPriority:k=>values.get(k)?.[1]??'',
      setProperty:(k,v,p='')=>values.set(k,[v,p]),removeProperty:k=>values.delete(k)}};
  h.win.getComputedStyle=e=>({display:e.style.getPropertyValue('display')});
  return element;
}

test('unsettled reserve remains observed after timeout/close, while L and P remain distinct',async()=>{const {LocalLifetime}=await import('../content/local-lifetime.mjs');const h=fixture(),records=new LocalLifetime({receiver_instance_id:'local-fixture'}),element=localTarget(h);let resolve,plan;
 const gate=new HideReservationGate(h.ledger,{context:bound(h),getGeneration:()=>1,verifyContext:()=>true,localLifetime:records,timeoutMs:10,reserve:p=>{plan=p;return new Promise(r=>resolve=r);}},()=>{},h.options);
 gate.hide('local-owned-claim',element,()=>true);await gate.snapshot();await tick();const before=gate.inspect().local_records[0];assert.notEqual(before.local_plan_id,before.plan_id);
 gate.close();assert.equal(records.snapshot().pending_work.some(r=>r.kind==='gate.reserve'),true);assert.equal(element.inert,false);
 resolve(plan.plan_id);await tick();const after=gate.inspect().local_records[0];assert.equal(after.local_plan_id,before.local_plan_id);assert.equal(after.plan_id,before.plan_id);assert.equal(after.obligation_pending,true);assert.equal(records.snapshot().pending_work.length,0);assert.equal(element.inert,false);
});
test('retirement during adapter listener installation prevents Session construction',async()=>{const h=setup(),add=h.win.addEventListener.bind(h.win);let pagehides=0;h.win.addEventListener=(type,...args)=>{if(type==='pagehide'&&++pagehides===2)h.receiver.invalidate();add(type,...args);};
 const q=await apply(h);assert.equal(q.accepted,false);assert.equal(q.state,undefined);const current=await h.receiver.query();assert.equal(current.state.local_startup.session_construct_attempts,0);assert.equal(listeners(h),0);
});

for(const throwsAfterAdd of [false,true])test(`Session listener reentrant retirement preserves removal retry (throw=${throwsAfterAdd})`,async()=>{
 const h=setup(),add=h.win.addEventListener.bind(h.win),remove=h.win.removeEventListener.bind(h.win);let once=true;
 h.win.addEventListener=(type,...args)=>{if(type==='popstate'&&once){once=false;h.receiver.invalidate();add(type,...args);if(throwsAfterAdd)throw Error('PARTIAL_ADD');return;}add(type,...args);};
 h.win.removeEventListener=(type,...args)=>{if(type==='popstate'&&!once)throw Error('REMOVE_FAILED');return remove(type,...args);};
 const q=await apply(h);assert.equal(q.accepted,false);assert.equal(h.win.listeners.get('popstate')?.size,1);
 const pending=await h.receiver.quiescenceSnapshot();assert.equal(pending.local_quiescence.locally_quiescent,false);
 assert.ok(pending.local_lifetime.remaining.resources.some(r=>r.kind==='session.popstate'));
 h.win.removeEventListener=remove;await h.receiver.release(h.context,'fixture');const stopped=await h.receiver.quiescenceSnapshot();
 assert.equal(listeners(h),0);assert.equal(stopped.local_lifetime.remaining.resources.length,0);
});
test('pagehide while preparation waits cannot consume a late true',async()=>{let done;const h=setup({prepareResources:()=>new Promise(r=>done=r)});const pending=apply(h);await tick();h.win.dispatchEvent(new Event('pagehide'));done(true);const q=await pending;assert.equal(q.accepted,false);assert.equal(q.local_startup.adapter_start_called,false);assert.equal(listeners(h),0);assert.equal(q.cleanup_pending,true);});
