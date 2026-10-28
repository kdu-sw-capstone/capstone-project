import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './member-fixture.mjs';

async function running(){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',document_transition_contract:'ND01_1',dom_transition_contract:'DP01_1'});
 await f.core.startCommand(f.command);
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
 return f;
}

test('same native transition completes and the session can END with timely confirmation',async()=>{
 const f=await running();let callbacks=0;
 f.env.onNativeConfirmed=async()=>{callbacks++;};
 assert.equal(await f.core.nrBegin(await f.core.bundle()),true);
 for(let i=0;i<8&&(await f.core.bundle()).a.session_status==='NATIVE_VERIFYING';i++)await f.core.tick();
 assert.equal(callbacks,1);assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
 await f.core.end(f.command.session_id);
 assert.equal((await f.core.bundle()).a.session_status,'ENDED');
 assert.equal(f.rules().length,0);
});

test('confirmation delayed beyond the five-second fence reproduces UNKNOWN and retains the first failure',async()=>{
 const f=await running();let callbacks=0;
 f.env.onNativeConfirmed=async()=>{callbacks++;f.advance(5001);};
 assert.equal(await f.core.nrBegin(await f.core.bundle()),true);
 await assert.rejects(async()=>{
  for(let i=0;i<8;i++)await f.core.tick();
 },{message:'REVALIDATION_REQUIRED'});
 const b=await f.core.bundle();assert.equal(callbacks,1);assert.equal(b.a.session_status,'UNKNOWN');
 assert.ok(b.a.nr_first_failure);assert.notEqual(b.a.native_transition.phase,'CONFIRMED');
});

test('existing explicit Core END can release a failed transition only with current same-owner native evidence',async()=>{
 const f=await running();f.env.onNativeConfirmed=async()=>f.advance(5001);
 await f.core.nrBegin(await f.core.bundle());
 await assert.rejects(async()=>{for(let i=0;i<8;i++)await f.core.tick();},{message:'REVALIDATION_REQUIRED'});
 const before=await f.core.bundle(),first=structuredClone(before.a.nr_first_failure);
 await f.core.end(f.command.session_id);
 const after=await f.core.bundle();assert.equal(after.a.session_status,'ENDED');
 assert.deepEqual(after.a.nr_first_failure,first);
 assert.equal(after.state.journal.desired,'RELEASED');assert.equal(after.state.journal.observed,'RELEASED');
 assert.equal(after.bindings.some(b=>b.resolution==='NONE'||b.cleanup_pending),false);
 assert.equal(f.rules().length,0);
});

test('same explicit END rejects changed ownership and preserves the failed transition',async()=>{
 const f=await running();f.env.onNativeConfirmed=async()=>f.advance(5001);
 await f.core.nrBegin(await f.core.bundle());
 await assert.rejects(async()=>{for(let i=0;i<8;i++)await f.core.tick();},{message:'REVALIDATION_REQUIRED'});
 const first=structuredClone((await f.core.bundle()).a.nr_first_failure),owner=f.owner.owner_key,rules=structuredClone(f.rules());
 f.owner.owner_key='MEMBER:2';
 await assert.rejects(f.core.end(f.command.session_id),{message:'OWNER_MISMATCH'});
 f.owner.owner_key=owner;
 const after=await f.core.bundle();assert.equal(after.a.session_status,'UNKNOWN');
 assert.deepEqual(after.a.nr_first_failure,first);assert.deepEqual(f.rules(),rules);
});

test('lost release response preserves END intent and cleanup debt without reporting restoration',async()=>{
 const f=await running();f.env.onNativeConfirmed=async()=>f.advance(5001);
 await f.core.nrBegin(await f.core.bundle());
 await assert.rejects(async()=>{for(let i=0;i<8;i++)await f.core.tick();},{message:'REVALIDATION_REQUIRED'});
 const first=structuredClone((await f.core.bundle()).a.nr_first_failure);
 f.chrome.tabs.sendMessage=async()=>{throw Error('STORE_UNCONFIRMED');};
 await f.core.end(f.command.session_id);
 const after=await f.core.bundle();assert.notEqual(after.a.session_status,'ENDED');
 assert.equal(after.a.intent,'END');assert.deepEqual(after.a.nr_first_failure,first);
 assert.ok(after.bindings.some(b=>b.resolution==='NONE'||b.cleanup_pending));
 assert.notEqual(after.state.journal.observed,'RELEASED');
});

for(const phase of ['confirmation','followup-read'])test('separate '+phase+' delay crosses the existing deadline without extending it',async()=>{
 const f=await running();let confirmedLocally=false,afterConfirmation=false;
 f.env.onNativeConfirmed=async()=>{
  const b=await f.core.bundle();confirmedLocally=b.a.native_transition.phase==='CONFIRMED';
  if(phase==='confirmation')f.advance(5001);
  // Model the two existing awaited operations separately. No fake Chrome result
  // is promoted to a real server receipt by this core-only contract test.
  await Promise.resolve();afterConfirmation=true;
  if(phase==='followup-read')f.advance(5001);
 };
 await f.core.nrBegin(await f.core.bundle());const deadline=(await f.core.bundle()).a.native_transition.deadline_at;
 await assert.rejects(async()=>{for(let i=0;i<8;i++)await f.core.tick();},{message:'REVALIDATION_REQUIRED'});
 const b=await f.core.bundle();assert.equal(confirmedLocally,true);assert.equal(afterConfirmation,true);
 assert.equal(b.a.native_transition.deadline_at,deadline);assert.equal(b.a.session_status,'UNKNOWN');
 assert.equal(f.core.firstFailureDiagnostic.stage,'NATIVE_TRANSITION_GUARD');
 assert.deepEqual([...f.core.firstFailureDiagnostic.rejected_fields],['deadline_at']);
});

test('observed 4934ms local confirmation followed by 133ms awaited work expires the unchanged fence by 67ms',async t=>{
 // A logical-clock replay is not a CPU scheduling benchmark.
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
 const f=await running();let callbacks=0;
 await f.core.nrBegin(await f.core.bundle());
 const transition=structuredClone((await f.core.bundle()).a.native_transition);
 f.advance(4934);
 f.env.onNativeConfirmed=async()=>{
  callbacks++;
  assert.equal((await f.core.bundle()).a.native_transition.phase,'CONFIRMED');
  // Replay observed elapsed time, not real HTTP or Chrome acceptance.
  f.advance(133);
 };
 await assert.rejects(async()=>{for(let i=0;i<8;i++)await f.core.tick();},{message:'REVALIDATION_REQUIRED'});
 const after=await f.core.bundle();
 assert.equal(callbacks,1);assert.equal(after.a.session_status,'UNKNOWN');
 assert.equal(after.a.native_transition.deadline_at,transition.deadline_at);
 assert.equal(f.core.firstFailureDiagnostic.stage,'NATIVE_TRANSITION_GUARD');
 assert.deepEqual([...f.core.firstFailureDiagnostic.rejected_fields],['deadline_at']);
 assert.ok(after.a.nr_first_failure);
});

test('Worker recreation does not restore RUNNING from a prior generation without fresh native confirmation',async()=>{
 const f=await running();const before=await f.core.bundle();f.advance(1000);
 await f.restart();const pending=await f.core.bundle();
 assert.notEqual(pending.a.session_status,'RUNNING');
 assert.equal(pending.a.session_id,before.a.session_id);
 assert.equal(pending.a.native_transition.phase,'VERIFYING');
 assert.notEqual(pending.a.native_transition.boot,before.a.boot_epoch);
 for(let i=0;i<8&&(await f.core.bundle()).a.session_status==='NATIVE_VERIFYING';i++)await f.core.tick();
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
