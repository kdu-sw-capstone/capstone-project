import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {digest} from '../a1/contract.mjs';
import {DocumentControlRegistry} from '../src/document-control-registry.js';
import {IG04PlanAdmission} from '../src/additional-ig04-admission.js';

const id = () => crypto.randomUUID();
const deferred = () => {let resolve, reject; const promise = new Promise((r, j) => {resolve = r; reject = j;}); return {resolve, reject, promise};};
async function fixture() {
  const context = {scope:{owner_binding_id:id(),owner_epoch:1,executor_id:id(),runtime_execution_id:id(),package_id:id(),
    runtime_revision:1,binding_id:id(),scope_epoch:id(),generation:1,tab_id:1,frame_id:0,document_id:'native-doc',
    document_instance_id:id(),url_sha256:'a'.repeat(64),focus_ref:null},operation_id:id(),semantic_sha256:'b'.repeat(64)};
  const registry = new DocumentControlRegistry({indexedDB:new IDBFactory()});
  const ref = {executorKey:context.scope.executor_id,tab:1,frame:0,documentKey:'native-doc'};
  await registry.observe(ref);
  const options = {context,registry,verifyIssued:()=>true,verifyNative:()=>true,isCurrent:()=>true,now:()=>1000,expiresAt:11000};
  return {context,registry,ref,options};
}
async function plan(context) {
  const base={plan_id:id(),claim:'private-claim',properties:[
    {property:'display',current:{value:'grid',priority:''},restore:{value:'grid',priority:''},target:{value:'none',priority:'important'}},
    {property:'inert',current:{value:false},restore:{value:false},target:{value:true}}],
  generation:1,document_instance_id:id(),gate_id:id()};
  const context_sha256=await digest(context);
  return {...base,reservation_identity:{gate_id:base.gate_id,plan_id:base.plan_id,context_sha256,
    plan_sha256:await digest({...base,context_sha256}),operation_id:context.operation_id,generation:1}};
}
async function settleWithin(work, ms=250) {
  let timer;
  try{return await Promise.race([work.then(value=>({kind:'resolved',value}),error=>({kind:'rejected',error})),
    new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:'pending'}),ms);})]);}
  finally{clearTimeout(timer);}
}

test('open ends at its deadline even if issued verification never returns', async()=>{
  const f=await fixture();f.options.expiresAt=1030;f.options.verifyIssued=()=>new Promise(()=>{});
  const result=await settleWithin(IG04PlanAdmission.open(f.options));
  assert.equal(result.kind,'rejected');assert.match(result.error.message,/AUTHORITY_CLOSED/);
});
test('abort ends a pending native plan check without waiting for its reply',async()=>{
  const f=await fixture(), entered=deferred(), late=deferred();let calls=0;
  f.options.verifyNative=()=>++calls===1?true:(entered.resolve(),late.promise);
  const gate=await IG04PlanAdmission.open(f.options),p=await plan(f.context),abort=new AbortController();
  const work=gate.verifyPlan(p,{signal:abort.signal});await entered.promise;abort.abort();
  try{const result=await settleWithin(work);assert.equal(result.kind,'rejected');assert.match(result.error.message,/RESERVATION_ABORTED/);}
  finally{late.resolve(true);gate.invalidate();}
});
test('explicit invalidation releases a pending verifier and keeps registry bytes',async()=>{
  const f=await fixture(),entered=deferred(),late=deferred();let calls=0;
  f.options.verifyIssued=()=>++calls===1?true:(entered.resolve(),late.promise);
  const gate=await IG04PlanAdmission.open(f.options),p=await plan(f.context),before=await f.registry.load(f.ref);
  const work=gate.verifyPlan(p);await entered.promise;gate.invalidate();
  try{const result=await settleWithin(work);assert.equal(result.kind,'rejected');assert.match(result.error.message,/AUTHORITY_CLOSED/);assert.deepEqual(await f.registry.load(f.ref),before);}
  finally{late.resolve(true);}
});
test('open propagates abort to issued verification and ignores its late success',async()=>{
  const f=await fixture(),entered=deferred(),late=deferred(),abort=new AbortController();let received,nativeCalls=0;
  f.options.verifyIssued=(_context,{signal})=>{received=signal;entered.resolve();return late.promise;};
  f.options.verifyNative=()=>{nativeCalls++;return true;};f.options.signal=abort.signal;
  const work=IG04PlanAdmission.open(f.options);await entered.promise;abort.abort();
  const result=await settleWithin(work);assert.equal(result.kind,'rejected');assert.equal(received.aborted,true);
  late.resolve(true);await new Promise(resolve=>setImmediate(resolve));assert.equal(nativeCalls,0);
});
test('already-aborted open does not invoke asynchronous providers or read the registry',async()=>{
  const f=await fixture(),abort=new AbortController();abort.abort();let calls=0;
  f.options.signal=abort.signal;f.options.verifyIssued=()=>{calls++;return true;};
  f.registry.load=async()=>{calls++;throw Error('unexpected read');};
  await assert.rejects(IG04PlanAdmission.open(f.options),/RESERVATION_ABORTED/);assert.equal(calls,0);
});
test('late success after plan cancellation cannot launch native reads or pin a retired gate',async()=>{
  const f=await fixture(),entered=deferred(),late=deferred();let issuedCalls=0,nativeCalls=0;
  f.options.verifyIssued=()=>++issuedCalls===2?(entered.resolve(),late.promise):true;
  f.options.verifyNative=()=>{nativeCalls++;return true;};
  const gate=await IG04PlanAdmission.open(f.options),p=await plan(f.context),abort=new AbortController();
  const work=gate.verifyPlan(p,{signal:abort.signal});await entered.promise;abort.abort();
  assert.equal((await settleWithin(work)).kind,'rejected');late.resolve(true);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(nativeCalls,1);
  const replacement=await plan(f.context);assert.deepEqual(await gate.verifyPlan(replacement),replacement);
});
test('late rejection after cancellation is consumed without changing current authority',async()=>{
  const f=await fixture(),entered=deferred(),late=deferred();let calls=0;
  f.options.verifyNative=()=>++calls===1?true:(entered.resolve(),late.promise);
  const gate=await IG04PlanAdmission.open(f.options),p=await plan(f.context),abort=new AbortController();
  const work=gate.verifyPlan(p,{signal:abort.signal});await entered.promise;abort.abort();
  assert.equal((await settleWithin(work)).kind,'rejected');late.reject(Error('late transport rejection'));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(gate.getGeneration(),1);gate.invalidate();
});
test('cancelling one verification does not cancel or pin another in-flight gate',async()=>{
  const f=await fixture(),both=deferred(),requests=[];let calls=0;
  f.options.verifyNative=(_context,{signal})=>{if(++calls===1||calls>3)return true;const pending=deferred();requests.push({signal,...pending});if(requests.length===2)both.resolve();return pending.promise;};
  const gate=await IG04PlanAdmission.open(f.options),a=await plan(f.context),b=await plan(f.context),abort=new AbortController();
  const first=gate.verifyPlan(a,{signal:abort.signal}),second=gate.verifyPlan(b);await both.promise;abort.abort();
  assert.equal((await settleWithin(first)).kind,'rejected');assert.equal(requests.filter(r=>r.signal.aborted).length,1);
  requests.find(r=>!r.signal.aborted).resolve(true);assert.deepEqual(await second,b);requests.find(r=>r.signal.aborted).resolve(true);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(await gate.verifyPlan(b),b);
});
test('invalidation cancels every waiter and does not clear durable cleanup',async()=>{
  const f=await fixture(),both=deferred(),requests=[];let calls=0;
  await f.registry.stage(f.ref,{operationKey:'existing',action:'APPLY',controlScope:{ownerKey:'MEMBER:1',sessionKey:'s',snapshotKey:'snap',revision:1,bindingKey:'b'}});
  f.options.verifyIssued=(_context,{signal})=>{if(++calls===1)return true;const pending=deferred();requests.push({signal,...pending});if(requests.length===2)both.resolve();return pending.promise;};
  const gate=await IG04PlanAdmission.open(f.options),a=await plan(f.context),b=await plan(f.context),before=await f.registry.pending(f.ref.executorKey);
  const first=gate.verifyPlan(a),second=gate.verifyPlan(b);await both.promise;gate.invalidate();
  const results=await Promise.all([settleWithin(first),settleWithin(second)]);assert.ok(results.every(r=>r.kind==='rejected'&&/AUTHORITY_CLOSED/.test(r.error.message)));
  assert.ok(requests.every(r=>r.signal.aborted));assert.deepEqual(await f.registry.pending(f.ref.executorKey),before);requests.forEach(r=>r.resolve(true));
});
test('deadline cancels a pending document read before any issued/native call',async()=>{
  const f=await fixture(),late=deferred();let calls=0;const before=await f.registry.load(f.ref);
  f.registry.load=()=>late.promise;f.options.expiresAt=1030;f.options.verifyIssued=()=>{calls++;return true;};
  const result=await settleWithin(IG04PlanAdmission.open(f.options));assert.equal(result.kind,'rejected');late.resolve(before);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
});
test('monotonic budget expires after wall-clock rollback without extending authority',async()=>{
  const f=await fixture(),entered=deferred(),late=deferred();let at=1000,calls=0;
  f.options.now=()=>at;f.options.expiresAt=1060;
  f.options.verifyNative=()=>++calls===1?true:(entered.resolve(),late.promise);
  const gate=await IG04PlanAdmission.open(f.options);at=0;
  const work=gate.verifyPlan(await plan(f.context));await entered.promise;
  const result=await settleWithin(work);assert.equal(result.kind,'rejected');assert.equal(gate.getGeneration(),null);late.resolve(true);
});
test('forward deadline observation cancels a pending verifier when current is checked',async()=>{
  const f=await fixture(),entered=deferred(),late=deferred();let at=1000,calls=0;
  f.options.now=()=>at;f.options.verifyNative=()=>++calls===1?true:(entered.resolve(),late.promise);
  const gate=await IG04PlanAdmission.open(f.options),work=gate.verifyPlan(await plan(f.context));await entered.promise;
  at=11000;assert.equal(gate.getGeneration(),null);assert.equal((await settleWithin(work)).kind,'rejected');late.resolve(true);
});
test('provider receives an abort signal without widening the frozen context',async()=>{
  const f=await fixture();const metadata=[];
  f.options.verifyIssued=(context,info)=>{metadata.push(info);assert.ok(Object.isFrozen(context.scope));return true;};
  const gate=await IG04PlanAdmission.open(f.options);await gate.verifyPlan(await plan(f.context));
  assert.ok(metadata.every(info=>info.signal instanceof AbortSignal));assert.ok(metadata.every(info=>!info.signal.aborted));gate.invalidate();
});
test('cancellation around the final read never pins a request that was rejected',async()=>{
  let cancelled=0;
  for(let offset=0;offset<12;offset++){
    const f=await fixture(),gate=await IG04PlanAdmission.open(f.options),abort=new AbortController();
    const load=f.registry.load.bind(f.registry);let reads=0;
    f.registry.load=async ref=>{
      const row=await load(ref);
      if(++reads===2){let left=offset;const tick=()=>{if(left-->0)queueMicrotask(tick);else abort.abort();};queueMicrotask(tick);}
      return row;
    };
    const result=await settleWithin(gate.verifyPlan(await plan(f.context),{signal:abort.signal}));
    assert.notEqual(result.kind,'pending');
    if(result.kind==='rejected'){
      cancelled++;assert.match(result.error.message,/RESERVATION_ABORTED/);
      const replacement=await plan(f.context);assert.deepEqual(await gate.verifyPlan(replacement),replacement);
    }
    gate.invalidate();
  }
  assert.ok(cancelled>0);
});
test('a malformed clock read cannot turn a deadline into an unbounded wait',async()=>{
  for(let faultAt=1;faultAt<=8;faultAt++){
    const f=await fixture();let armed=false,reads=0,calls=0;
    f.options.now=()=>armed&&++reads===faultAt?NaN:1000;f.options.expiresAt=1030;
    f.options.verifyNative=()=>++calls===1?true:new Promise(()=>{});
    const gate=await IG04PlanAdmission.open(f.options);armed=true;
    try{const result=await settleWithin(gate.verifyPlan(await plan(f.context)));assert.equal(result.kind,'rejected');assert.equal(gate.getGeneration(),null);}
    finally{gate.invalidate();}
  }
});
