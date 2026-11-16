import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory, IDBObjectStore} from 'fake-indexeddb';
import schema from '../../contracts/additional-mvp/rc1/schema.json' with {type:'json'};
import {RuntimeReportProducer} from '../src/additional-runtime-report-producer.js';
import {createMemberDB} from '../member-a1/db.mjs';
import {digest} from '../a1/contract.mjs';
const KEY='amvp_journal_v1:runtime-report-producer';
async function fixture(overrides={}) {
 const factory=new IDBFactory(),db=createMemberDB(factory,'producer'),scope={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID(),runtime_execution_id:crypto.randomUUID()};
 const config={authorizeScope:async s=>Object.entries(scope).every(([k,v])=>s[k]===v)&&s.generation===1,verifyEvidence:async()=>true,...overrides};
 const producer=new RuntimeReportProducer(db,config);
 const input=(changes={},generation=1)=>({generation,report:{report_id:crypto.randomUUID(),...scope,operation_id:crypto.randomUUID(),package_id:crypto.randomUUID(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z',...changes}});
 const mutate=work=>db.transaction('readwrite',(tx,done)=>{const s=tx.objectStore('metadata'),q=s.get(KEY);q.onsuccess=()=>{work(q.result);s.put(q.result);done(null);};});
 return {factory,db,scope,config,producer,input,mutate};
}
test('scope and evidence are denied by default without advancing any stream',async()=>{
 const f=await fixture(),input=f.input();await assert.rejects(new RuntimeReportProducer(f.db).produce(input),/REPORT_PRODUCER_UNAUTHORIZED/);
 await assert.rejects(new RuntimeReportProducer(f.db,{authorizeScope:f.config.authorizeScope}).produce(input),/REPORT_PRODUCER_EVIDENCE_UNVERIFIED/);
 assert.deepEqual((await f.producer.recover()).streams,[]);
});
test('source identity, epoch, sequence and immutable body survive a new DB connection',async()=>{
 const f=await fixture(),input=f.input(),one=await f.producer.produce(input);
 const reopened=new RuntimeReportProducer(createMemberDB(f.factory,'producer'),f.config);
 assert.deepEqual(await reopened.produce(input),one);
 const two=await reopened.produce(f.input());assert.equal(one.report_seq,1);assert.equal(two.report_seq,2);assert.equal(one.report_epoch,two.report_epoch);
 const {payload_sha256,...body}=one;assert.equal(await digest(body),payload_sha256);
 assert.deepEqual(Object.keys(one).sort(),schema.$defs.RuntimeReport.required.toSorted());
});
test('same source ID with changed state, owner, operation or generation is not reissued',async()=>{
 const f=await fixture({authorizeScope:async()=>true}),input=f.input();await f.producer.produce(input);
 for(const patch of [{state:'APPLIED'},{owner_binding_id:crypto.randomUUID()},{operation_id:crypto.randomUUID()}])await assert.rejects(f.producer.produce({...input,report:{...input.report,...patch}}),/REPORT_PRODUCER_ID_CONFLICT/);
 await assert.rejects(f.producer.produce({...input,generation:2}),/REPORT_PRODUCER_ID_CONFLICT/);assert.equal((await f.producer.recover()).rows.length,1);
});
test('owner, executor and runtime executions never share an epoch or cursor',async()=>{
 const f=await fixture({authorizeScope:async()=>true});const reports=[];
 for(const changes of [{},{owner_binding_id:crypto.randomUUID()},{executor_id:crypto.randomUUID()},{runtime_execution_id:crypto.randomUUID()}])reports.push(await f.producer.produce(f.input(changes)));
 assert.equal(new Set(reports.map(r=>r.report_epoch)).size,4);assert.ok(reports.every(r=>r.report_seq===1));
});
test('caller cannot supply generated epoch, seq, payload hash or extra wire fields',async()=>{
 const f=await fixture();for(const change of [{report_epoch:crypto.randomUUID()},{report_seq:1},{payload_sha256:'a'.repeat(64)},{extra:true}])await assert.rejects(f.producer.produce(f.input(change)),/INVALID_REPORT_PRODUCER_INPUT/);
 assert.equal((await f.producer.recover()).rows.length,0);
});
test('invalid schema values and impossible dates never reserve a sequence',async()=>{
 const f=await fixture();for(const change of [{state:'RUNNING'},{reason:'OK'},{observed_at:'2026-02-30T00:00:00.000Z'},{observed_at:'2026-11-01T00:00:00Z'},{runtime_revision:0},{runtime_revision:Number.MAX_SAFE_INTEGER+1},{report_id:'bad'},{evidence_sha256:'x'.repeat(64)}])await assert.rejects(f.producer.produce(f.input(change)),/INVALID_REPORT_PRODUCER_INPUT/);
 const missing=f.input();delete missing.report.operation_id;await assert.rejects(f.producer.produce(missing),/INVALID_REPORT_PRODUCER_INPUT/);
 for(const generation of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])await assert.rejects(f.producer.produce(f.input({},generation)),/INVALID_REPORT_PRODUCER_INPUT/);
 assert.equal((await f.producer.produce(f.input())).report_seq,1);
});
test('verifier receives full proposed report and durable predecessor, isolated from mutation',async()=>{
 const seen=[];const f=await fixture({verifyEvidence:async value=>{seen.push(structuredClone(value));value.report.state='APPLIED';if(value.predecessor)value.predecessor.report.state='RELEASED';return true;}});
 const first=await f.producer.produce(f.input()),second=await f.producer.produce(f.input());
 assert.equal(seen[0].predecessor,null);assert.deepEqual(seen[1].predecessor,{generation:1,report:first});
 assert.equal(first.state,'UNKNOWN');assert.equal(second.state,'UNKNOWN');assert.equal((await f.producer.recover()).rows[0].report.state,'UNKNOWN');
});
test('mutating input or returned receipt cannot alter durable report',async()=>{
 const f=await fixture(),input=f.input(),saved=structuredClone(input),pending=f.producer.produce(input);input.report.state='APPLIED';
 const report=await pending;report.state='RELEASED';assert.equal((await f.producer.produce(saved)).state,'UNKNOWN');
});
test('scope loss during evidence verification refuses commit',async()=>{
 let current=true;const f=await fixture({authorizeScope:async()=>current,verifyEvidence:async()=>{current=false;return true;}});
 await assert.rejects(f.producer.produce(f.input()),/REPORT_PRODUCER_UNAUTHORIZED/);assert.equal((await f.producer.recover()).rows.length,0);
});
test('a durable duplicate is a receipt replay and cannot be turned into a new observation',async()=>{
 let calls=0;const f=await fixture({verifyEvidence:async()=>{calls++;return true;}}),input=f.input();const report=await f.producer.produce(input);
 const replay=new RuntimeReportProducer(f.db,{...f.config,verifyEvidence:async()=>{throw Error('historical observation no longer live');}});
 assert.deepEqual(await replay.produce(input),report);assert.equal(calls,1);
 await assert.rejects(new RuntimeReportProducer(f.db).produce(input),/REPORT_PRODUCER_UNAUTHORIZED/);
});
test('storage failure rolls back body and cursor; same source can retry at the original position',async()=>{
 const f=await fixture(),one=await f.producer.produce(f.input()),input=f.input(),before=await f.producer.recover(),put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(v,...rest){if(v.key===KEY)throw Error('QUOTA');return put.call(this,v,...rest);};
 try{await assert.rejects(f.producer.produce(input),/QUOTA/);}finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await f.producer.recover(),before);const two=await f.producer.produce(input);assert.equal(two.report_seq,2);assert.equal(two.report_epoch,one.report_epoch);
});
test('first write failure creates neither epoch nor cursor',async()=>{
 const f=await fixture(),put=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(v,...rest){if(v.key===KEY)throw Error('QUOTA');return put.call(this,v,...rest);};
 try{await assert.rejects(f.producer.produce(f.input()),/QUOTA/);}finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual((await f.producer.recover()).streams,[]);assert.deepEqual((await f.producer.recover()).rows,[]);
});
test('concurrent instances cannot reuse a position or lose an immutable report',async()=>{
 const f=await fixture(),other=new RuntimeReportProducer(f.db,f.config),inputs=[f.input(),f.input()];
 const results=await Promise.allSettled([f.producer.produce(inputs[0]),other.produce(inputs[1])]);assert.ok(results.some(r=>r.status==='fulfilled'));
 for(let i=0;i<results.length;i++)if(results[i].status==='rejected'){assert.match(results[i].reason.message,/REPORT_PRODUCER_CHANGED/);await other.produce(inputs[i]);}
 const state=await f.producer.recover();assert.deepEqual(state.rows.map(r=>r.report.report_seq),[1,2]);assert.equal(state.streams.length,1);
});
test('capacity preserves all source reports and still permits durable replay',async()=>{
 const f=await fixture({capacity:1}),input=f.input(),one=await f.producer.produce(input);await assert.rejects(f.producer.produce(f.input()),/REPORT_PRODUCER_FULL/);
 assert.deepEqual(await f.producer.produce(input),one);assert.equal((await f.producer.recover()).rows.length,1);
});
for(const corruption of ['cursor','hash','epoch','generation'])test(`corrupted ${corruption} is rejected before producing another report`,async()=>{
 const f=await fixture();await f.producer.produce(f.input());await f.mutate(s=>{if(corruption==='cursor')s.streams[0].last_seq=2;if(corruption==='hash')s.rows[0].report.evidence_sha256='b'.repeat(64);if(corruption==='epoch')s.streams[0].report_epoch=crypto.randomUUID();if(corruption==='generation')s.rows[0].generation=2;});
 await assert.rejects(f.producer.produce(f.input()),/INVALID_REPORT_PRODUCER_CURSOR|REPORT_PRODUCER_HASH_MISMATCH|INVALID_REPORT_PRODUCER_SEQUENCE/);
});
test('producer preserves unrelated DNR cleanup metadata and has no native or network effects',async()=>{
 const f=await fixture(),row={key:'unrelated:cleanup',state:'IN_DOUBT'};
 await f.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(row);done(null);});await f.producer.produce(f.input());
 const preserved=await f.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get(row.key);q.onsuccess=()=>done(q.result);});assert.deepEqual(preserved,row);
});
