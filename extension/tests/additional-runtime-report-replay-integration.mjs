// Opt-in composition with the actual PR76/78 modules, not copied implementations.
// Authorization/evidence/transport are synthetic. Persistent services use fake-IDB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {RuntimeReportReplay} from '../src/additional-runtime-report-replay.js';
import {createMemberDB} from '../member-a1/db.mjs';
const moduleURL=(env,fallback)=>process.env[env]?pathToFileURL(resolve(process.env[env])).href:new URL(fallback,import.meta.url).href;
const {RuntimeReportProducer}=await import(moduleURL('REPORT_PRODUCER_MODULE','../src/additional-runtime-report-producer.js'));
const {RuntimeReportOutbox}=await import(moduleURL('REPORT_OUTBOX_MODULE','../src/additional-runtime-report-outbox.js'));
async function fixture(n=3) {
 const factory=new IDBFactory(),db=createMemberDB(factory,'replay'),scope={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID()},execution=crypto.randomUUID();
 let authorized=true;const authorizeScope=async s=>authorized&&s.owner_binding_id===scope.owner_binding_id&&s.executor_id===scope.executor_id;
 const producer=new RuntimeReportProducer(db,{authorizeScope,verifyEvidence:async()=>true});
 for(let i=0;i<n;i++)await producer.produce({generation:1,report:{report_id:crypto.randomUUID(),...scope,runtime_execution_id:execution,operation_id:crypto.randomUUID(),package_id:crypto.randomUUID(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z'}});
 const outbox=new RuntimeReportOutbox(db,{authorizeScope,verifyReport:async()=>true,verifyAck:async()=>true}),config={producer,outbox,authorizeScope};
 return {factory,db,scope,producer,outbox,config,replay:new RuntimeReportReplay(config),revoke:()=>{authorized=false;}};
}
test('real producer/outbox retain source bytes and deduplicate a new replay instance',async()=>{
 const f=await fixture(),before=await f.producer.recover();assert.equal((await f.replay.replay(f.scope)).enqueued_count,3);
 assert.equal((await new RuntimeReportReplay(f.config).replay(f.scope)).reused_count,3);
 assert.deepEqual((await f.outbox.recover()).rows.map(r=>r.report),before.rows.map(r=>r.report));assert.deepEqual(await f.producer.recover(),before);
});
test('target commit followed by lost reply resumes from durable receipt even if old live evidence expires',async()=>{
 const f=await fixture(),enqueue=f.outbox.enqueue.bind(f.outbox);let lose=true;
 f.outbox.enqueue=async r=>{const receipt=await enqueue(r);if(lose){lose=false;throw Error('REPLY_LOST');}return receipt;};
 await assert.rejects(f.replay.replay(f.scope),e=>e.cause?.message==='REPLY_LOST'&&e.progress.staged_count===0);assert.equal((await f.outbox.recover()).rows.length,1);
 f.outbox.verifyReport=async r=>{if(r.report_seq===1)throw Error('OLD_OBSERVATION_NO_LONGER_LIVE');return true;};
 const result=await new RuntimeReportReplay(f.config).replay(f.scope);assert.equal(result.reused_count,1);assert.equal(result.enqueued_count,2);assert.equal((await f.producer.recover()).rows.length,3);
});
test('real target put failure rolls back target only and replay fills the remaining source suffix',async()=>{
 const f=await fixture(),before=await f.producer.recover(),put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(v,...args){if(v.key==='amvp_journal_v1:runtime-report-outbox'&&v.rows.length===2)throw Error('QUOTA');return put.call(this,v,...args);};
 try{await assert.rejects(f.replay.replay(f.scope),e=>e.cause?.message==='QUOTA'&&e.progress.staged_count===1);}finally{IDBObjectStore.prototype.put=put;}
 assert.equal((await f.outbox.recover()).rows.length,1);assert.deepEqual(await f.producer.recover(),before);
 const result=await new RuntimeReportReplay(f.config).replay(f.scope);assert.equal(result.reused_count,1);assert.equal(result.enqueued_count,2);assert.equal((await f.outbox.recover()).rows.length,3);
});
test('actual outbox denies authority lost while verifying the first replayed report',async()=>{
 const f=await fixture();f.outbox.verifyReport=async()=>{f.revoke();return true;};
 await assert.rejects(f.replay.replay(f.scope),e=>e.cause?.message==='REPORT_SCOPE_UNAUTHORIZED'&&e.progress.staged_count===0);
 assert.equal((await f.outbox.recover()).rows.length,0);assert.equal((await f.producer.recover()).rows.length,3);
});
test('two replay instances use actual target CAS; retry preserves one copy of each report',async()=>{
 const f=await fixture(),other=new RuntimeReportReplay(f.config),results=await Promise.allSettled([f.replay.replay(f.scope),other.replay(f.scope)]);
 assert.ok(results.some(r=>r.status==='fulfilled'));
 for(const result of results)if(result.status==='rejected')assert.equal(result.reason.cause?.message,'REPORT_OUTBOX_CHANGED');
 await new RuntimeReportReplay(f.config).replay(f.scope);const rows=(await f.outbox.recover()).rows;assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.report.report_id)).size,3);
});
test('actual delivery ACK and replay never rewrite source UNKNOWN or unrelated cleanup obligations',async()=>{
 const f=await fixture(2),cleanup={key:'unrelated:cleanup',pending:true,document:'synthetic'},before=await f.producer.recover();
 await f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(cleanup);done(null);});await f.replay.replay(f.scope);const batch=await f.outbox.batch(f.scope);
 await f.outbox.acknowledge(f.scope,{batch_id:batch.batch_id,items:batch.reports.map((r,i)=>({item_id:r.report_id,payload_sha256:r.payload_sha256,status:i?'REJECTED':'ACCEPTED',error_code:null}))});
 const replay=await new RuntimeReportReplay(f.config).replay(f.scope);assert.equal(replay.reused_count,2);assert.deepEqual(replay.deliveries,{PENDING:0,ACKED:1,REJECTED:1});assert.deepEqual(await f.producer.recover(),before);
 const saved=await f.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get(cleanup.key);q.onsuccess=()=>done(q.result);});assert.deepEqual(saved,cleanup);
});
