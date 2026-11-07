import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture} from './member-fixture.mjs';
import {digest} from '../member-a1/contract.mjs';
import {ScheduleDeadline} from '../member-a1/schedule-deadline.mjs';
async function running(){
 const f=await fixture();await f.core.startCommand(f.command);
 const plan={session_id:f.command.session_id,command_id:f.command.command_id,occurrence_id:randomUUID(),schedule_id:randomUUID(),schedule_version:1,
  scheduled_start_at:new Date(f.core.now()).toISOString(),scheduled_end_at:new Date(f.core.now()+60000).toISOString()};
 const alarms=new Map();f.chrome.alarms.create=async(name,options)=>{alarms.set(name,options);};f.chrome.alarms.clear=async name=>alarms.delete(name);
 const service=new ScheduleDeadline(f.core,{verifyScheduledAdmission:async()=>true});
 return {f,plan,service,alarms};
}
test('deadline releases actual Core claims before confirmed-run target and does not invent tail time',async()=>{
 const {f,plan,service}=await running();assert.equal((await service.arm(plan)).state,'WAITING');
 f.advance(30000);await f.core.tick();f.advance(30000);
 assert.equal((await service.check(plan.session_id)).state,'RELEASED');
 const b=await f.core.bundle();assert.equal(b.a.session_status,'ENDED');assert.equal(b.a.end_origin,'TIME_LIMIT');
 assert.equal(b.state.journal.observed,'RELEASED');assert.ok(b.bindings.every(x=>x.resolution!=='NONE'));
 assert.equal(b.a.time.active_duration_ms,30000);assert.equal(f.rules().length,0);
});
test('remaining 1ms waits and exact deadline closes; duplicate check does not release again',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);f.advance(59999);
 assert.equal((await service.check(plan.session_id)).state,'WAITING');f.advance(1);
 await service.check(plan.session_id);const before=[...f.effects.values()].map(e=>e.releases);
 assert.equal((await service.check(plan.session_id)).state,'RELEASED');assert.deepEqual([...f.effects.values()].map(e=>e.releases),before);
});
test('default unverified admission and changed fixed-end plan cannot arm a session',async()=>{
 const {f,plan,service}=await running();await assert.rejects(new ScheduleDeadline(f.core).arm(plan),/ADMISSION_UNVERIFIED/);
 await service.arm(plan);await assert.rejects(service.arm({...plan,scheduled_end_at:new Date(Date.parse(plan.scheduled_end_at)+60000).toISOString()}),/DEADLINE_CONFLICT/);
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
test('persisted intent survives release failure and retries real cleanup without clearing debt',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);f.advance(60000);
 const finish=f.core.finish.bind(f.core);f.core.finish=async()=>{throw Error('CLEANUP_FAILURE');};
 await assert.rejects(service.check(plan.session_id),/CLEANUP_FAILURE/);
 assert.equal((await service.read(plan.session_id)).phase,'ENDING');assert.equal((await f.core.bundle()).a.intent,'END');
 f.core.finish=finish;assert.equal((await new ScheduleDeadline(f.core).check(plan.session_id)).state,'RELEASED');
});
test('sidecar storage failure leaves current policy and session unchanged',async()=>{
 const {f,plan,service,alarms}=await running();f.core.store.beforeCommit=()=>{throw Error('WRITE_FAILURE');};
 await assert.rejects(service.arm(plan),/WRITE_FAILURE/);delete f.core.store.beforeCommit;
 assert.equal(await service.read(plan.session_id),null);assert.equal((await f.core.bundle()).a.session_status,'RUNNING');assert.equal(alarms.size,0);
});
test('wall rollback never extends an armed deadline on the same monotonic boot',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);
 const monoStart=f.core.mono(),wall=f.core.now();f.core.now=()=>wall-120000;f.core.mono=()=>monoStart+60000;
 assert.equal((await service.check(plan.session_id)).state,'RELEASED');
});
test('a new Worker boot cannot use the old monotonic anchor without revalidation',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);await f.restart();
 const renewed=new ScheduleDeadline(f.core);await assert.rejects(renewed.check(plan.session_id),/REVALIDATION_REQUIRED/);
 assert.equal((await renewed.read(plan.session_id)).phase,'ARMED');
});
test('foreign owner and mismatched command cannot end current execution',async()=>{
 const {f,plan,service}=await running();await assert.rejects(service.arm({...plan,command_id:randomUUID()}),/STALE_SCHEDULE_SCOPE/);
 await service.arm(plan);f.owner.owner_key='MEMBER:2';await assert.rejects(service.check(plan.session_id),/OWNER_MISMATCH/);
 f.owner.owner_key='MEMBER:1';assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
test('alarm names are session-specific; unrelated alarms have no effects',async()=>{
 const {f,plan,service,alarms}=await running();await service.arm(plan);
 assert.ok(alarms.has('focurve-member-fixed-end:'+plan.session_id));assert.equal(await service.onAlarm({name:'focurve-member-a1-check'}),null);
 f.advance(60000);assert.equal((await service.onAlarm({name:'focurve-member-fixed-end:'+plan.session_id})).state,'RELEASED');
 assert.equal(alarms.has('focurve-member-fixed-end:'+plan.session_id),false);
});

test('wall forward jump does not manufacture premature deadline expiry',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);const wall=f.core.now(),mono=f.core.mono();
 f.core.now=()=>wall+3600000;f.core.mono=()=>mono+1000;
 assert.equal((await service.check(plan.session_id)).state,'WAITING');assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
test('manual END is verified as already released without a second cleanup',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);await f.core.end(plan.session_id);
 const releases=[...f.effects.values()].map(e=>e.releases);assert.equal((await service.check(plan.session_id)).state,'RELEASED');
 assert.deepEqual([...f.effects.values()].map(e=>e.releases),releases);
});

test('deadline cleanup preserves unrelated DNR rules',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);
 const unrelated={id:777777,priority:1,action:{type:'block'},condition:{urlFilter:'unrelated.example'}};
 await f.chrome.declarativeNetRequest.updateSessionRules({addRules:[unrelated]});f.advance(60000);
 await service.check(plan.session_id);assert.deepEqual(f.rules(),[unrelated]);
});
test('a late alarm for an old session cannot end a successor session',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);await f.core.end(plan.session_id);
 f.command.session_id=randomUUID();f.command.command_id=randomUUID();await f.core.startCommand(f.command);
 await assert.rejects(service.check(plan.session_id),/STALE_SCHEDULE_SCOPE/);
 assert.equal((await f.core.bundle()).a.session_id,f.command.session_id);assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
test('deadline record tampering cannot authorize cleanup',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);
 await f.core.store.atomic((tx,done)=>{const md=tx.objectStore('metadata'),q=md.get('member:schedule-deadline:'+plan.session_id);q.onsuccess=()=>{q.result.phase='ENDING';md.put(q.result);done();};});
 await assert.rejects(service.check(plan.session_id),/INVALID_SCHEDULE_DEADLINE_RECORD/);
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});

test('missing monotonic anchor remains invalid even with a recomputed payload hash',async()=>{
 const {f,plan,service}=await running();await service.arm(plan);const row=await service.read(plan.session_id);
 delete row.anchor_mono;delete row.sha256;row.sha256=await digest(row);
 await f.core.store.atomic((tx,done)=>{tx.objectStore('metadata').put(row);done();});
 await assert.rejects(service.check(plan.session_id),/INVALID_SCHEDULE_DEADLINE_RECORD/);
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
