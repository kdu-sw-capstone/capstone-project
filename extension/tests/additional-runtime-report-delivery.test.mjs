import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import {createMemberDB} from '../member-a1/db.mjs';
import {canonical, digest} from '../a1/contract.mjs';
import {RuntimeReportOutbox} from '../src/additional-runtime-report-outbox.js';
import {RuntimeReportDelivery} from '../src/additional-runtime-report-delivery.js';
import {createServer} from 'node:http';
const id=()=>crypto.randomUUID();
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
const failed=code=>e=>e.message==='REPORT_DELIVERY_INCOMPLETE'&&e.cause?.message===code;
async function fixture(){
  const db=createMemberDB(new IDBFactory(),id()),owner={owner_binding_id:id(),executor_id:id()};
  const epoch=id(), execution=id();let current=true;const bodies=[];
  const config={authorizeScope:async s=>current&&canonical(s)===canonical(owner),verifyReport:async()=>true,verifyAck:async()=>true};
  const outbox=new RuntimeReportOutbox(db,config);
  const report=async seq=>{const raw={report_id:id(),...owner,runtime_execution_id:execution,report_epoch:epoch,report_seq:seq,operation_id:id(),package_id:id(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-02T00:00:00.000Z'};return {...raw,payload_sha256:await digest(raw)};};
  const ack=(batch,status='ACCEPTED',reports=batch.reports)=>({batch_id:batch.batch_id,items:reports.map(r=>({item_id:r.report_id,payload_sha256:r.payload_sha256,status,error_code:null}))});
  const options={outbox,authorizeScope:config.authorizeScope,isCurrent:()=>current,send:async(body,{isCurrent})=>{assert.equal(isCurrent(),true);bodies.push(body);return ack(JSON.parse(body));}};
  const make=patch=>new RuntimeReportDelivery({...options,...patch});
  return {db,owner,outbox,config,report,ack,options,make,bodies,revoke:()=>{current=false;},restore:()=>{current=true;}};
}
test('default authority denies dispatch and does not even create a batch',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));
  const missing=new RuntimeReportDelivery({outbox:h.outbox,send:h.options.send});
  await assert.rejects(missing.deliver(h.owner),failed('REPORT_DELIVERY_UNAUTHORIZED'));
  await assert.rejects(h.make({isCurrent:()=>Promise.resolve(true)}).deliver(h.owner),failed('REPORT_DELIVERY_AUTHORITY_LOST'));
  assert.equal(h.bodies.length,0);assert.equal((await h.outbox.recover()).batches.length,0);
});
test('empty outbox performs no network and does not claim a persisted ACK',async()=>{
  const h=await fixture();assert.deepEqual(await h.make().deliver(h.owner),{local_only:true,batch_id:null,submitted_count:0,ack_persisted:false});assert.equal(h.bodies.length,0);
});
test('actual outbox batch and bound item ACK commit without changing report effect state',async()=>{
  const h=await fixture(),r=await h.report(1);await h.outbox.enqueue(r);const result=await h.make().deliver(h.owner);
  assert.equal(result.ack_persisted,true);assert.equal(result.submitted_count,1);assert.ok(Object.isFrozen(result));
  const s=await h.outbox.recover();assert.equal(s.rows[0].delivery,'ACKED');assert.deepEqual(s.rows[0].report,r);assert.equal(s.rows[0].report.state,'UNKNOWN');
  assert.equal(h.bodies[0],canonical(s.batches[0].body));
});
test('lost response and new caller reopen reuse exactly the same durable batch bytes',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));let first;
  await assert.rejects(h.make({send:async body=>{first=body;throw Error('CONNECTION_LOST');}}).deliver(h.owner),failed('CONNECTION_LOST'));
  assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
  const reopened=new RuntimeReportOutbox(h.db,h.config);await h.make({outbox:reopened}).deliver(h.owner);assert.equal(h.bodies[0],first);
});
test('partial ACK and PENDING_DEPENDENCY preserve original batch, then explicit retry uses same identity',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));await h.outbox.enqueue(await h.report(2));let sent;
  await h.make({send:async body=>{sent=body;const b=JSON.parse(body);return h.ack(b,'ACCEPTED',[b.reports[0]]);}}).deliver(h.owner);
  let s=await h.outbox.recover();assert.deepEqual(s.rows.map(r=>r.delivery),['ACKED','PENDING']);
  await h.make({send:async body=>{assert.equal(body,sent);const b=JSON.parse(body);return h.ack(b,'PENDING_DEPENDENCY',[b.reports[1]]);}}).deliver(h.owner);
  assert.equal((await h.outbox.recover()).rows[1].delivery,'PENDING');await h.make().deliver(h.owner);assert.equal(h.bodies[0],sent);
});
test('terminal item rejection is retained without reporting policy RELEASED',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));await h.make({send:async body=>h.ack(JSON.parse(body),'REJECTED')}).deliver(h.owner);
  const row=(await h.outbox.recover()).rows[0];assert.equal(row.delivery,'REJECTED');assert.equal(row.report.state,'UNKNOWN');assert.equal(await h.outbox.batch(h.owner),null);
});
for(const code of ['HTTP_401','HTTP_403','HTTP_429','HTTP_503'])test(code+' does not auto retry or consume the pending report',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));let sends=0;
  await assert.rejects(h.make({send:async()=>{sends++;throw Error(code);}}).deliver(h.owner),failed(code));
  assert.equal(sends,1);assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
});
test('owner change during asynchronous authorization blocks transport at the synchronous fence',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));let count=0;
  const caller=h.make({authorizeScope:async()=>{if(++count===2)h.revoke();return true;}});
  await assert.rejects(caller.deliver(h.owner),failed('REPORT_DELIVERY_AUTHORITY_LOST'));assert.equal(h.bodies.length,0);
  assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
});
test('trusted transport rechecks the supplied fence after credential wait before its IO boundary',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const started=deferred(),credentials=deferred();let io=0;
  const caller=h.make({send:async(body,{isCurrent})=>{started.resolve();await credentials.promise;if(!isCurrent())throw Error('STALE_CREDENTIAL_SCOPE');io++;return h.ack(JSON.parse(body));}});
  const done=caller.deliver(h.owner);await started.promise;h.revoke();credentials.resolve();await assert.rejects(done,failed('STALE_CREDENTIAL_SCOPE'));assert.equal(io,0);
});
test('authority lost with a late response cannot hand the ACK to the outbox',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const entered=deferred(),response=deferred();let b;
  const caller=h.make({send:async body=>{b=JSON.parse(body);entered.resolve();return response.promise;}});
  const done=caller.deliver(h.owner);await entered.promise;h.revoke();response.resolve(h.ack(b));await assert.rejects(done,failed('REPORT_DELIVERY_AUTHORITY_LOST'));
  assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
});
test('stop bounds uncooperative send and a late old ACK cannot touch a new explicit attempt',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const entered=deferred(),old=deferred();let b,oldGuard,calls=0;
  const caller=h.make({send:async(body,{isCurrent})=>{if(++calls>1)return h.ack(JSON.parse(body));b=JSON.parse(body);oldGuard=isCurrent;entered.resolve();return old.promise;}});
  const done=caller.deliver(h.owner);await entered.promise;caller.stop();await assert.rejects(done,failed('REPORT_DELIVERY_CANCELLED'));assert.equal(oldGuard(),false);
  await caller.deliver(h.owner);old.resolve(h.ack(b,'REJECTED'));await tick();assert.equal((await h.outbox.recover()).rows[0].delivery,'ACKED');
});
test('timeout aborts the attempt, retains pending and has no background retry',async t=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));let sends=0,signal;const entered=deferred();
  t.mock.timers.enable({apis:['setTimeout']});
  const caller=h.make({timeoutMs:100,send:async(_body,options)=>{sends++;signal=options.signal;entered.resolve();return new Promise(()=>{});}});
  const done=caller.deliver(h.owner);await entered.promise;t.mock.timers.tick(100);
  await assert.rejects(done,failed('REPORT_DELIVERY_TIMEOUT'));assert.equal(sends,1);assert.equal(signal.aborted,true);assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
});
test('single-flight caller rejects overlap rather than dispatching the same batch twice',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const response=deferred(),entered=deferred();let b;
  const caller=h.make({send:async body=>{b=JSON.parse(body);entered.resolve();return response.promise;}}),one=caller.deliver(h.owner);await entered.promise;
  await assert.rejects(caller.deliver(h.owner),/REPORT_DELIVERY_BUSY/);response.resolve(h.ack(b));await one;
});
test('malformed/wrong-hash or unauthenticated ACK never marks a pending report delivered',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));
  await assert.rejects(h.make({send:async body=>{const a=h.ack(JSON.parse(body));a.items[0].payload_sha256='f'.repeat(64);return a;}}).deliver(h.owner),failed('REPORT_ACK_MISMATCH'));
  const unverified=new RuntimeReportOutbox(h.db,{...h.config,verifyAck:async()=>false});
  await assert.rejects(h.make({outbox:unverified}).deliver(h.owner),failed('REPORT_ACK_UNVERIFIED'));
  assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
});
test('ACK storage failure retains exact batch for retry without changing source report',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const batch=await h.outbox.batch(h.owner),before=await h.outbox.recover(),put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(value,...args){if(value.key==='amvp_journal_v1:runtime-report-outbox')throw Error('QUOTA');return put.call(this,value,...args);};
  try{await assert.rejects(h.make().deliver(h.owner),failed('QUOTA'));}finally{IDBObjectStore.prototype.put=put;}
  assert.deepEqual(await h.outbox.recover(),before);await h.make().deliver(h.owner);assert.equal(h.bodies.at(-1),canonical(batch));
});
test('stop after ACK handoff does not claim rollback or revert a later durable ACK commit',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const entered=deferred(),resume=deferred(),committed=deferred();
  const outbox={batch:s=>h.outbox.batch(s),acknowledge:async(s,a)=>{entered.resolve();await resume.promise;const result=await h.outbox.acknowledge(s,a);committed.resolve();return result;}};
  const caller=h.make({outbox}),done=caller.deliver(h.owner);await entered.promise;caller.stop();await assert.rejects(done,failed('REPORT_DELIVERY_CANCELLED'));
  resume.resolve();await committed.promise;
  assert.equal((await h.outbox.recover()).rows[0].delivery,'ACKED');
});
test('stop during pending authorization or batch lookup prevents all late dispatch',async()=>{
  for(const phase of ['authorize','batch']){
    const h=await fixture();await h.outbox.enqueue(await h.report(1));const entered=deferred(),resume=deferred();
    const patch=phase==='authorize'?{authorizeScope:async()=>{entered.resolve();await resume.promise;return true;}}:
      {outbox:{batch:async scope=>{entered.resolve();await resume.promise;return h.outbox.batch(scope);},acknowledge:(s,a)=>h.outbox.acknowledge(s,a)}};
    const caller=h.make(patch),done=caller.deliver(h.owner);await entered.promise;caller.stop();
    await assert.rejects(done,failed('REPORT_DELIVERY_CANCELLED'));resume.resolve();await tick();assert.equal(h.bodies.length,0);
    assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
  }
});
test('foreign batch and over-one-MiB serialization fail before transport dispatch',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const original=await h.outbox.batch(h.owner);
  for(const mode of ['foreign','oversize']){
    const body=structuredClone(original);if(mode==='foreign')body.executor_id=id();else body.padding='x'.repeat(1048576);
    const outbox={batch:async()=>body,acknowledge:()=>assert.fail('no ACK')};
    await assert.rejects(h.make({outbox}).deliver(h.owner),failed(mode==='foreign'?'REPORT_DELIVERY_BATCH_UNCONFIRMED':'REPORT_DELIVERY_TOO_LARGE'));
  }
  assert.equal(h.bodies.length,0);assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');
});
test('real loopback HTTP response loss retries immutable bytes and persists a bound duplicate ACK',async t=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const bodies=[];
  // A test HTTP receiver, NOT the real Server or a production auth provider.
  const server=createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/api/v1/amvp/reports/batch'){res.writeHead(404).end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString('utf8');bodies.push(body);
    if(bodies.length===1){req.socket.destroy();return;}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(h.ack(JSON.parse(body),'DUPLICATE')));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
  const endpoint=`http://127.0.0.1:${server.address().port}/api/v1/amvp/reports/batch`;
  const send=async(body,{signal,isCurrent})=>{if(!isCurrent())throw Error('STALE_SCOPE');const response=await fetch(endpoint,{method:'POST',body,headers:{'Content-Type':'application/json'},signal});if(response.status!==200)throw Error('HTTP_STATUS');return response.json();};
  await assert.rejects(h.make({send}).deliver(h.owner),/REPORT_DELIVERY_INCOMPLETE/);
  assert.equal((await h.outbox.recover()).rows[0].delivery,'PENDING');await h.make({send}).deliver(h.owner);
  assert.equal(bodies.length,2);assert.equal(bodies[0],bodies[1]);assert.equal((await h.outbox.recover()).rows[0].delivery,'ACKED');
});
test('caller scope is copied and frozen before the first await',async()=>{
  const h=await fixture();await h.outbox.enqueue(await h.report(1));const original={...h.owner};
  const done=h.make().deliver(original);original.owner_binding_id=id();await done;assert.equal((await h.outbox.recover()).rows[0].delivery,'ACKED');
});
test('invalid options and foreign/incomplete scope cannot dispatch',async()=>{
  const h=await fixture();for(const timeoutMs of [0,-1,0.5,Infinity,2147483648])assert.throws(()=>h.make({timeoutMs}),/INVALID_REPORT_DELIVERY_OPTIONS/);
  for(const scope of [null,{},[],{...h.owner,extra:true},{...h.owner,executor_id:'bad'}])await assert.rejects(h.make().deliver(scope),/INVALID_REPORT_DELIVERY_SCOPE/);
  await assert.rejects(h.make().deliver({...h.owner,owner_binding_id:id()}),failed('REPORT_DELIVERY_UNAUTHORIZED'));assert.equal(h.bodies.length,0);
});
