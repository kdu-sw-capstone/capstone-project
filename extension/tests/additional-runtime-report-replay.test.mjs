// Service I/O is simulated here. Separate integration script uses PR76/78 modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {RuntimeReportReplay} from '../src/additional-runtime-report-replay.js';
import {digest} from '../a1/contract.mjs';
async function fixture(options={}) {
 const scope={owner_binding_id:crypto.randomUUID(),executor_id:crypto.randomUUID()},epoch=crypto.randomUUID(),execution=crypto.randomUUID();
 const source=[],target=new Map(),calls=[];
 const row=async(seq=1,patch={})=>{
  const body={report_id:crypto.randomUUID(),...scope,runtime_execution_id:execution,report_epoch:epoch,report_seq:seq,operation_id:crypto.randomUUID(),package_id:crypto.randomUUID(),runtime_revision:1,state:'UNKNOWN',reason:'ERROR',evidence_sha256:'a'.repeat(64),observed_at:'2026-11-01T00:00:00.000Z',...patch};
  const report={...body,payload_sha256:await digest(body)},record={generation:1,report};return {...record,row_sha256:await digest(record)};
 };
 const producer={recover:async()=>({rows:source}),produce:()=>{throw Error('NO_PRODUCTION');}};
 const outbox={recover:async()=>({rows:[...target.values()]}),enqueue:async report=>{calls.push(structuredClone(report));const receipt={report:structuredClone(report),delivery:'PENDING',ack:null};target.set(report.report_id,receipt);return structuredClone(receipt);},batch:()=>{throw Error('NO_TRANSPORT');},acknowledge:()=>{throw Error('NO_ACK');}};
 const config={producer,outbox,authorizeScope:async s=>s.owner_binding_id===scope.owner_binding_id&&s.executor_id===scope.executor_id,...options};
 return {scope,source,target,calls,row,producer,outbox,config,replay:new RuntimeReportReplay(config)};
}
const incomplete=code=>e=>e.message==='REPORT_REPLAY_INCOMPLETE'&&e.cause?.message===code;
test('default scope refusal never reads or writes source/target',async()=>{
 const f=await fixture();let reads=0;const r=new RuntimeReportReplay({producer:{recover:async()=>{reads++;}},outbox:f.outbox});
 await assert.rejects(r.replay(f.scope),incomplete('REPORT_REPLAY_UNAUTHORIZED'));assert.equal(reads,0);assert.equal(f.calls.length,0);
});
test('replays original order/bytes and reuses durable receipts on another pass',async()=>{
 const f=await fixture();f.source.push(await f.row(),await f.row(2));const original=structuredClone(f.source);
 const first=await f.replay.replay(f.scope);assert.equal(first.snapshot_complete,true);assert.equal(first.enqueued_count,2);assert.equal(first.reused_count,0);
 assert.deepEqual(f.calls,original.map(r=>r.report));assert.deepEqual(f.source,original);
 const second=await new RuntimeReportReplay(f.config).replay(f.scope);assert.equal(second.enqueued_count,0);assert.equal(second.reused_count,2);assert.equal(f.calls.length,2);
});
test('partial failure preserves source and target prefix; retry starts with committed receipt',async()=>{
 const f=await fixture();f.source.push(await f.row(),await f.row(2),await f.row(3));const original=structuredClone(f.source),enqueue=f.outbox.enqueue;let failing=true;
 f.outbox.enqueue=async r=>{if(failing&&r.report_seq===2)throw Error('QUOTA');return enqueue(r);};
 await assert.rejects(f.replay.replay(f.scope),e=>incomplete('QUOTA')(e)&&e.progress.staged_count===1&&e.progress.at_report_id===original[1].report.report_id);
 assert.equal(f.target.size,1);assert.deepEqual(f.source,original);failing=false;
 const result=await new RuntimeReportReplay(f.config).replay(f.scope);assert.equal(result.reused_count,1);assert.equal(result.enqueued_count,2);assert.equal(f.target.size,3);assert.equal(f.calls.length,3);
});
test('historical ACKED and REJECTED receipts do not require new evidence or alter source state',async()=>{
 const f=await fixture();for(const delivery of ['ACKED','REJECTED']){const r=await f.row(f.source.length+1);f.source.push(r);f.target.set(r.report.report_id,{report:r.report,delivery,ack:{item_id:r.report.report_id,payload_sha256:r.report.payload_sha256,status:delivery==='ACKED'?'DUPLICATE':'REJECTED',error_code:null}});}
 f.outbox.enqueue=async()=>{throw Error('HISTORICAL_EVIDENCE_NOT_LIVE');};const result=await f.replay.replay(f.scope);
 assert.equal(result.reused_count,2);assert.deepEqual(result.deliveries,{PENDING:0,ACKED:1,REJECTED:1});assert.ok(f.source.every(r=>r.report.state==='UNKNOWN'));
});
test('scope filter never submits another binding or executor',async()=>{
 const f=await fixture();f.source.push(await f.row(),await f.row(1,{owner_binding_id:crypto.randomUUID()}),await f.row(1,{executor_id:crypto.randomUUID(),report_epoch:crypto.randomUUID()}));
 const result=await f.replay.replay(f.scope);assert.equal(result.snapshot_count,1);assert.equal(f.calls.length,1);assert.equal(f.calls[0].report_id,f.source[0].report.report_id);
});
test('scope lost during source recovery prevents the first admission',async()=>{
 let authorized=true;const f=await fixture({authorizeScope:async()=>authorized});f.source.push(await f.row());const recover=f.producer.recover;
 f.producer.recover=async()=>{const s=await recover();authorized=false;return s;};await assert.rejects(f.replay.replay(f.scope),incomplete('REPORT_REPLAY_UNAUTHORIZED'));assert.equal(f.calls.length,0);
});
test('scope lost after committed enqueue reports its prefix and never submits the next row',async()=>{
 let authorized=true;const f=await fixture({authorizeScope:async()=>authorized});f.source.push(await f.row(),await f.row(2));const enqueue=f.outbox.enqueue;
 f.outbox.enqueue=async r=>{const receipt=await enqueue(r);authorized=false;return receipt;};
 await assert.rejects(f.replay.replay(f.scope),e=>incomplete('REPORT_REPLAY_UNAUTHORIZED')(e)&&e.progress.staged_count===1&&e.progress.enqueued_count===1);
 assert.equal(f.target.size,1);assert.equal(f.source.length,2);
});
test('a second invocation on the same instance is rejected until the first settles',async()=>{
 const f=await fixture();let release,entered;const started=new Promise(r=>{entered=r;});f.producer.recover=()=>{entered();return new Promise(r=>{release=r;});};
 const first=f.replay.replay(f.scope);await started;await assert.rejects(f.replay.replay(f.scope),/REPORT_REPLAY_BUSY/);release({rows:[]});await first;
});
test('source/target I/O failures release the local run guard without claiming completion',async()=>{
 const f=await fixture(),recover=f.outbox.recover;f.outbox.recover=async()=>{throw Error('IDB_UNAVAILABLE');};
 await assert.rejects(f.replay.replay(f.scope),incomplete('IDB_UNAVAILABLE'));f.outbox.recover=recover;assert.equal((await f.replay.replay(f.scope)).snapshot_complete,true);
});
for(const corruption of ['report','generation','position','duplicate'])test(`preflights ${corruption} before writing any target report`,async()=>{
 const f=await fixture();f.source.push(await f.row(),await f.row(2));
 if(corruption==='report')f.source[1].report.state='APPLIED';if(corruption==='generation')f.source[1].generation=2;
 if(corruption==='position')f.source[1]=await f.row(1,{runtime_execution_id:crypto.randomUUID()});if(corruption==='duplicate')f.source[1]=structuredClone(f.source[0]);
 await assert.rejects(f.replay.replay(f.scope),incomplete('REPORT_REPLAY_SOURCE_UNCONFIRMED'));assert.equal(f.calls.length,0);
});
test('continuous binding/epoch positions across executions are handed off in durable order',async()=>{
 const f=await fixture();f.source.push(await f.row(),await f.row(2,{runtime_execution_id:crypto.randomUUID()}));await f.replay.replay(f.scope);assert.deepEqual(f.calls.map(r=>r.report_seq),[1,2]);
});
test('mismatched fresh target receipt cannot become a successful local checkpoint',async()=>{
 const f=await fixture();f.source.push(await f.row());f.outbox.enqueue=async report=>({report:{...report,state:'APPLIED'},delivery:'PENDING',ack:null});
 await assert.rejects(f.replay.replay(f.scope),e=>incomplete('REPORT_REPLAY_TARGET_UNCONFIRMED')(e)&&e.progress.staged_count===0);assert.equal(f.source.length,1);
});
test('same target ID with different bytes refuses the entire handoff before new admissions',async()=>{
 const f=await fixture();f.source.push(await f.row(),await f.row(2));const report={...f.source[1].report,state:'APPLIED'};f.target.set(report.report_id,{report,delivery:'PENDING',ack:null});
 await assert.rejects(f.replay.replay(f.scope),incomplete('REPORT_REPLAY_TARGET_CONFLICT'));assert.equal(f.calls.length,0);assert.equal(f.target.size,1);
});
test('returned source snapshot is cloned before target await and authority callback mutation',async()=>{
 const f=await fixture({authorizeScope:async s=>{s.owner_binding_id=crypto.randomUUID();return true;}});f.source.push(await f.row());const original=structuredClone(f.source[0].report);
 f.outbox.recover=async()=>{f.source[0].report.state='APPLIED';return {rows:[]};};await f.replay.replay(f.scope);assert.deepEqual(f.calls,[original]);
});
test('capacity rejection preserves source and does not partially admit a truncated prefix',async()=>{
 const f=await fixture({capacity:1});f.source.push(await f.row(),await f.row(2));await assert.rejects(f.replay.replay(f.scope),incomplete('REPORT_REPLAY_SOURCE_UNCONFIRMED'));assert.equal(f.calls.length,0);
});
test('invalid scope and malformed target snapshots are refused',async()=>{
 const f=await fixture();await assert.rejects(f.replay.replay({...f.scope,extra:true}),/INVALID_REPORT_REPLAY_SCOPE/);f.outbox.recover=async()=>({});
 await assert.rejects(f.replay.replay(f.scope),incomplete('REPORT_REPLAY_TARGET_UNCONFIRMED'));
});
test('new source rows arriving during handoff are explicitly outside this snapshot',async()=>{
 const f=await fixture();f.source.push(await f.row());const next=await f.row(2),enqueue=f.outbox.enqueue;let append=true;
 f.outbox.enqueue=async r=>{const receipt=await enqueue(r);if(append){append=false;f.source.push(next);}return receipt;};
 const first=await f.replay.replay(f.scope);assert.equal(first.snapshot_count,1);assert.equal(first.staged_count,1);assert.equal(f.source.length,2);
 const second=await f.replay.replay(f.scope);assert.equal(second.snapshot_count,2);assert.equal(second.enqueued_count,1);assert.equal(f.target.size,2);
});
