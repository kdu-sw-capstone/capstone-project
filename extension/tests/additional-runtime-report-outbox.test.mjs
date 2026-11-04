import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {RuntimeReportOutbox} from '../src/additional-runtime-report-outbox.js';
import {createMemberDB} from '../member-a1/db.mjs';
import {digest} from '../a1/contract.mjs';

async function fixture(options={}) {
 const db=createMemberDB(new IDBFactory(),'report-outbox'),owner={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID()},execution=crypto.randomUUID(),epoch=crypto.randomUUID(),operation=crypto.randomUUID(),packageId=crypto.randomUUID();
 const config={authorizeScope:async s=>s.owner_binding_id===owner.owner_binding_id&&s.executor_id===owner.executor_id,verifyReport:async()=>true,verifyAck:async()=>true,...options};
 const outbox=new RuntimeReportOutbox(db,config);
 const report=async(seq=1,extra={})=>{
  const body={report_id:crypto.randomUUID(),...owner,runtime_execution_id:execution,report_epoch:epoch,report_seq:seq,operation_id:operation,package_id:packageId,runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z',...extra};
  return {...body,payload_sha256:await digest(body)};
 };
 const ack=(batch,status='ACCEPTED',reports=batch.reports)=>({batch_id:batch.batch_id,items:reports.map(r=>({item_id:r.report_id,payload_sha256:r.payload_sha256,status,error_code:null}))});
 return {db,owner,config,outbox,report,ack};
}
test('defaults never authorize a report, delivery batch or an authenticated ACK',async()=>{
 const f=await fixture(),outbox=new RuntimeReportOutbox(f.db),r=await f.report();
 await assert.rejects(outbox.enqueue(r),/REPORT_SCOPE_UNAUTHORIZED/);await assert.rejects(outbox.batch(f.owner),/REPORT_SCOPE_UNAUTHORIZED/);
 const evidence=new RuntimeReportOutbox(f.db,{authorizeScope:f.config.authorizeScope});await assert.rejects(evidence.enqueue(r),/REPORT_EVIDENCE_UNVERIFIED/);
 await f.outbox.enqueue(r);const b=await f.outbox.batch(f.owner);await assert.rejects(evidence.acknowledge(f.owner,f.ack(b)),/REPORT_ACK_UNVERIFIED/);
});
test('report and batch survive reopening, response loss reuses identical bytes and IDs',async()=>{
 const f=await fixture(),r=await f.report();await f.outbox.enqueue(r);const first=await f.outbox.batch(f.owner);
 const reopened=new RuntimeReportOutbox(f.db,f.config);assert.deepEqual(await reopened.batch(f.owner),first);
 assert.deepEqual((await reopened.recover()).rows[0].report,r);await reopened.acknowledge(f.owner,f.ack(first));assert.equal(await reopened.batch(f.owner),null);
});
test('duplicate report is immutable and does not consume another stream position',async()=>{
 const f=await fixture(),one=await f.report();await f.outbox.enqueue(one);assert.deepEqual(await f.outbox.enqueue(one),(await f.outbox.recover()).rows[0]);
 const two=await f.report(2);await f.outbox.enqueue(two);assert.equal((await f.outbox.recover()).rows.length,2);
 await assert.rejects(f.outbox.enqueue(await f.report(1,{report_id:one.report_id,state:'APPLIED'})),/REPORT_ID_CONFLICT/);
});
test('gaps, duplicate stream positions and numeric overflow never mutate cursor',async()=>{
 const f=await fixture();await assert.rejects(f.outbox.enqueue(await f.report(2)),/REPORT_SEQUENCE_GAP/);await f.outbox.enqueue(await f.report());
 await assert.rejects(f.outbox.enqueue(await f.report()),/REPORT_SEQUENCE_GAP/);await assert.rejects(f.outbox.enqueue(await f.report(Number.MAX_SAFE_INTEGER+1)),/INVALID_RUNTIMEREPORT/);
 await f.outbox.enqueue(await f.report(2));assert.equal((await f.outbox.recover()).rows.length,2);
});
test('state/hash/required fields and noncanonical date are rejected before admission',async()=>{
 const f=await fixture();for(const change of [{state:'RUNNING'},{observed_at:'2026-02-30T00:00:00.000Z'},{report_seq:0},{extra:true}])await assert.rejects(f.outbox.enqueue(await f.report(1,change)),/INVALID_RUNTIMEREPORT/);
 const r=await f.report();delete r.operation_id;await assert.rejects(f.outbox.enqueue(r),/INVALID_RUNTIMEREPORT/);
 const bad=await f.report();bad.evidence_sha256='b'.repeat(64);await assert.rejects(f.outbox.enqueue(bad),/REPORT_HASH_MISMATCH/);assert.equal((await f.outbox.recover()).rows.length,0);
});
test('callback and caller mutation cannot change stored report or ACK semantics',async()=>{
 const f=await fixture({verifyReport:async r=>{r.state='APPLIED';return true;}}),r=await f.report(),saved=structuredClone(r);
 const enqueue=f.outbox.enqueue(r);r.state='APPLIED';await enqueue;assert.deepEqual((await f.outbox.recover()).rows[0].report,saved);
 const batch=await f.outbox.batch(f.owner);batch.reports[0].state='RELEASED';assert.deepEqual((await f.outbox.batch(f.owner)).reports[0],saved);
});
test('wrong scope cannot read batches or acknowledge another owner',async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());const batch=await f.outbox.batch(f.owner),foreign={...f.owner,owner_binding_id:crypto.randomUUID()};
 await assert.rejects(f.outbox.batch(foreign),/REPORT_SCOPE_UNAUTHORIZED/);await assert.rejects(f.outbox.acknowledge(foreign,f.ack(batch)),/REPORT_SCOPE_UNAUTHORIZED/);
 assert.equal((await f.outbox.recover()).rows[0].delivery,'PENDING');
});
for(const corruption of ['batch','item','hash','duplicate'])test(`ACK ${corruption} mismatch rolls back the entire response`,async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());await f.outbox.enqueue(await f.report(2));const batch=await f.outbox.batch(f.owner),ack=f.ack(batch);
 if(corruption==='batch')ack.batch_id=crypto.randomUUID();if(corruption==='item')ack.items[1].item_id=crypto.randomUUID();if(corruption==='hash')ack.items[1].payload_sha256='f'.repeat(64);if(corruption==='duplicate')ack.items.push(ack.items[0]);
 await assert.rejects(f.outbox.acknowledge(f.owner,ack),/REPORT_ACK_MISMATCH|REPORT_BATCH_SCOPE_MISMATCH/);assert.ok((await f.outbox.recover()).rows.every(r=>r.delivery==='PENDING'));
});
test('partial ACK and dependencies retry the original immutable batch',async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());await f.outbox.enqueue(await f.report(2));const batch=await f.outbox.batch(f.owner);
 await f.outbox.acknowledge(f.owner,f.ack(batch,'ACCEPTED',[batch.reports[0]]));assert.deepEqual(await f.outbox.batch(f.owner),batch);
 await f.outbox.acknowledge(f.owner,f.ack(batch,'PENDING_DEPENDENCY',[batch.reports[1]]));assert.equal((await f.outbox.recover()).rows[1].delivery,'PENDING');
 await f.outbox.acknowledge(f.owner,f.ack(batch,'DUPLICATE'));assert.equal(await f.outbox.batch(f.owner),null);
});
test('NOT_RECEIVED stays pending; terminal rejection retains the report and receipt',async()=>{
 const f=await fixture(),r=await f.report();await f.outbox.enqueue(r);const batch=await f.outbox.batch(f.owner);
 await f.outbox.acknowledge(f.owner,f.ack(batch,'NOT_RECEIVED'));assert.equal((await f.outbox.recover()).rows[0].delivery,'PENDING');
 await f.outbox.acknowledge(f.owner,f.ack(batch,'REJECTED'));assert.equal(await f.outbox.batch(f.owner),null);
 const row=(await f.outbox.recover()).rows[0];assert.equal(row.delivery,'REJECTED');assert.deepEqual(row.report,r);
 await f.outbox.acknowledge(f.owner,f.ack(batch));assert.equal((await f.outbox.recover()).rows[0].delivery,'REJECTED');
});
test('late nonterminal and rejection responses never downgrade an accepted receipt',async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());const batch=await f.outbox.batch(f.owner);await f.outbox.acknowledge(f.owner,f.ack(batch));
 for(const status of ['PENDING_DEPENDENCY','NOT_RECEIVED','REJECTED'])await f.outbox.acknowledge(f.owner,f.ack(batch,status));
 assert.equal((await f.outbox.recover()).rows[0].delivery,'ACKED');
});
test('scope change while verifying evidence refuses admission without a partial write',async()=>{
 let authorized=true;const f=await fixture({authorizeScope:async()=>authorized,verifyReport:async()=>{authorized=false;return true;}});
 await assert.rejects(f.outbox.enqueue(await f.report()),/REPORT_SCOPE_UNAUTHORIZED/);assert.equal((await f.outbox.recover()).rows.length,0);
});
test('capacity exhaustion does not evict pending or terminal evidence',async()=>{
 const f=await fixture({capacity:1});await f.outbox.enqueue(await f.report());const b=await f.outbox.batch(f.owner);await f.outbox.acknowledge(f.owner,f.ack(b));
 await assert.rejects(f.outbox.enqueue(await f.report(2)),/REPORT_OUTBOX_FULL/);assert.equal((await f.outbox.recover()).rows[0].delivery,'ACKED');
});
test('put failure atomically preserves pending report and original ACK state',async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());const batch=await f.outbox.batch(f.owner),before=await f.outbox.recover(),original=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(value,...args){if(value.key==='amvp_journal_v1:runtime-report-outbox')throw Error('QUOTA');return original.call(this,value,...args);};
 try{await assert.rejects(f.outbox.acknowledge(f.owner,f.ack(batch)),/QUOTA/);}finally{IDBObjectStore.prototype.put=original;}
 assert.deepEqual(await f.outbox.recover(),before);await f.outbox.acknowledge(f.owner,f.ack(batch));assert.equal((await f.outbox.recover()).rows[0].delivery,'ACKED');
});
test('concurrent outbox instances fail CAS without losing or fabricating reports',async()=>{
 const f=await fixture(),r=await f.report(),other=new RuntimeReportOutbox(f.db,f.config);
 const results=await Promise.allSettled([f.outbox.enqueue(r),other.enqueue(r)]);assert.ok(results.some(x=>x.status==='fulfilled'));
 assert.ok(results.filter(x=>x.status==='rejected').every(x=>x.reason.message==='REPORT_OUTBOX_CHANGED'));
 await other.enqueue(r);assert.equal((await f.outbox.recover()).rows.length,1);
});
test('corrupted durable report or batch hash is never replayed',async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());await f.outbox.batch(f.owner);
 await f.db.transaction('readwrite',(tx,done)=>{const store=tx.objectStore('metadata'),q=store.get('amvp_journal_v1:runtime-report-outbox');q.onsuccess=()=>{q.result.batches[0].sha256='f'.repeat(64);store.put(q.result);done(null);};});
 await assert.rejects(f.outbox.batch(f.owner),/REPORT_BATCH_HASH_MISMATCH/);
});

test('batches never exceed 100 items and finish the earlier batch before advancing',async()=>{
 const f=await fixture();for(let seq=1;seq<=101;seq++)await f.outbox.enqueue(await f.report(seq));
 const first=await f.outbox.batch(f.owner);assert.equal(first.reports.length,100);assert.equal(first.reports.at(-1).report_seq,100);
 await f.outbox.acknowledge(f.owner,f.ack(first));const next=await f.outbox.batch(f.owner);
 assert.equal(next.reports.length,1);assert.equal(next.reports[0].report_seq,101);assert.notEqual(next.batch_id,first.batch_id);
});
test('even a multi-owner trusted adapter cannot mix binding scopes in one batch',async()=>{
 const f=await fixture({authorizeScope:async()=>true}),other={...f.owner,owner_binding_id:crypto.randomUUID()};
 await f.outbox.enqueue(await f.report());await f.outbox.enqueue(await f.report(1,other));
 const one=await f.outbox.batch(f.owner),two=await f.outbox.batch(other);
 assert.ok(one.reports.every(r=>r.owner_binding_id===f.owner.owner_binding_id));assert.ok(two.reports.every(r=>r.owner_binding_id===other.owner_binding_id));
 assert.notEqual(one.batch_id,two.batch_id);
});

test('RPT-01 rejects reused binding/epoch/seq when execution changes',async()=>{
 const f=await fixture();await f.outbox.enqueue(await f.report());const before=await f.outbox.recover();
 await assert.rejects(f.outbox.enqueue(await f.report(1,{runtime_execution_id:crypto.randomUUID()})),/REPORT_SEQUENCE_GAP/);
 assert.deepEqual(await f.outbox.recover(),before);
});
test('RPT-01 accepts next binding/epoch sequence across executions and reopens unchanged',async()=>{
 const f=await fixture();const first=await f.report(),second=await f.report(2,{runtime_execution_id:crypto.randomUUID()});
 await f.outbox.enqueue(first);await f.outbox.enqueue(second);
 const batch=await f.outbox.batch(f.owner),again=new RuntimeReportOutbox(f.db,f.config);
 assert.deepEqual(await again.batch(f.owner),batch);assert.deepEqual(batch.reports,[first,second]);
 await again.acknowledge(f.owner,f.ack(batch));assert.equal(await again.batch(f.owner),null);
});
test('executor changes cannot reuse a binding/epoch position but batches stay executor-isolated',async()=>{
 const f=await fixture({authorizeScope:async()=>true}),other={...f.owner,executor_id:crypto.randomUUID()};
 await f.outbox.enqueue(await f.report());await assert.rejects(f.outbox.enqueue(await f.report(1,other)),/REPORT_SEQUENCE_GAP/);
 await f.outbox.enqueue(await f.report(2,other));
 const first=await f.outbox.batch(f.owner),second=await f.outbox.batch(other);
 assert.equal(first.reports.length,1);assert.equal(second.reports.length,1);assert.equal(second.reports[0].report_seq,2);
 await assert.rejects(f.outbox.acknowledge(other,f.ack(first)),/REPORT_BATCH_SCOPE_MISMATCH/);
});
test('different bindings with the same epoch independently start at sequence one',async()=>{
 const f=await fixture({authorizeScope:async()=>true}),first=await f.report(),other={...f.owner,owner_binding_id:crypto.randomUUID()};
 await f.outbox.enqueue(first);await f.outbox.enqueue(await f.report(1,{...other,report_epoch:first.report_epoch}));
 assert.equal((await f.outbox.recover()).rows.length,2);
});
test('new epoch starts at one and a prior epoch ACK only updates its original row',async()=>{
 const f=await fixture(),first=await f.report();await f.outbox.enqueue(first);const oldBatch=await f.outbox.batch(f.owner);
 const next=await f.report(1,{report_epoch:crypto.randomUUID(),runtime_execution_id:crypto.randomUUID()});await f.outbox.enqueue(next);
 await f.outbox.acknowledge(f.owner,f.ack(oldBatch));const state=await f.outbox.recover();
 assert.equal(state.rows[0].delivery,'ACKED');assert.equal(state.rows[1].delivery,'PENDING');assert.deepEqual(state.rows[1].report,next);
 const batch=await f.outbox.batch(f.owner);assert.deepEqual(batch.reports,[next]);assert.notEqual(batch.batch_id,oldBatch.batch_id);
});
test('recovery refuses legacy duplicate sequence positions without deleting or renumbering originals',async()=>{
 const f=await fixture(),first=await f.report(),second=await f.report(1,{runtime_execution_id:crypto.randomUUID()}),key='amvp_journal_v1:runtime-report-outbox';
 const original={key,version:1,rows:[first,second].map(report=>({report,delivery:'PENDING',ack:null})),batches:[]};
 await f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(original);done(null);});
 const reopened=new RuntimeReportOutbox(f.db,f.config);await assert.rejects(reopened.recover(),/REPORT_SEQUENCE_GAP/);
 await assert.rejects(reopened.batch(f.owner),/REPORT_SEQUENCE_GAP/);
 const actual=await f.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get(key);q.onsuccess=()=>done(q.result);});assert.deepEqual(actual,original);
});
test('recovery accepts a persisted execution change with continuous binding/epoch positions',async()=>{
 const f=await fixture(),first=await f.report(),second=await f.report(2,{runtime_execution_id:crypto.randomUUID()}),key='amvp_journal_v1:runtime-report-outbox';
 const original={key,version:1,rows:[first,second].map(report=>({report,delivery:'PENDING',ack:null})),batches:[]};
 await f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(original);done(null);});
 assert.deepEqual(await new RuntimeReportOutbox(f.db,f.config).recover(),original);
});
