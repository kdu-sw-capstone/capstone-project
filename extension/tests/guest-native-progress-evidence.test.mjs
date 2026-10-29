import test from 'node:test';
import assert from 'node:assert/strict';
import {A1Core} from '../a1/core.mjs';

// Checkpoint semantics only: simulated atomic storage and clock. These tests
// distinguish what a retained timestamp proves, not the historical Chrome cause.
function fixture(){
 let now=1000,writes=0,a={record_version:crypto.randomUUID(),native_transition_contract:'NR01_1',intent:'RECOVER',
  native_transition:{version:'NR01_1',phase:'VERIFYING',profile:'profile',boot:'boot',started_at:1000,deadline_at:6000,last_seen_at:1000}};
 const core=Object.create(A1Core.prototype);Object.assign(core,{profile:'profile',boot:'boot',now:()=>now,
  bundle:async()=>({a:structuredClone(a)}),updateBundle:async(_expected,work)=>{
   const next=structuredClone(a),result=work({a:next,tx:{objectStore:()=>({put:()=>{writes++;}})}});a=next;return result;
  }});
 return {core,time:v=>{now=v;},state:()=>structuredClone(a),writes:()=>writes};
}

test('unchanged last_seen_at does not prove no progress: two checkpoints may share the start millisecond',async()=>{
 const f=fixture();await f.core.nrStage('FRESH_ATTEST');await f.core.nrStage('FRESH_APPLY');
 const n=f.state().native_transition;assert.equal(f.writes(),2);assert.equal(n.phase,'FRESH_APPLY');assert.equal(n.last_seen_at,n.started_at);
});
test('a later committed checkpoint updates last_seen_at without moving the deadline',async()=>{
 const f=fixture();f.time(1450);await f.core.nrStage('FRESH_ATTEST');f.time(1700);await f.core.nrStage('FRESH_APPLY');
 assert.equal(f.state().native_transition.last_seen_at,1700);assert.equal(f.state().native_transition.deadline_at,6000);
});
test('work delayed before its first checkpoint leaves the start timestamp and cannot commit after the fence',async()=>{
 const f=fixture();let resume;const blocked=new Promise(resolve=>{resume=resolve;});
 const work=(async()=>{await blocked;return f.core.nrStage('FRESH_ATTEST');})();
 f.time(6027);assert.equal(f.writes(),0);assert.equal(f.state().native_transition.last_seen_at,1000);resume();
 await assert.rejects(work,/REVALIDATION_REQUIRED/);assert.equal(f.writes(),0);assert.equal(f.state().native_transition.deadline_at,6000);
});
test('an uncertain checkpoint write is not treated as recorded progress',async()=>{
 const f=fixture(),before=f.state();f.time(1200);f.core.updateBundle=async()=>{throw Error('STORE_UNCONFIRMED');};
 await assert.rejects(f.core.nrStage('FRESH_ATTEST'),/STORE_UNCONFIRMED/);assert.deepEqual(f.state(),before);
});

test('console trace binds the same request and transition, excludes raw state, and never writes authority',t=>{
 const f=fixture(),records=[];t.mock.method(console,'info',(_tag,value)=>records.push(JSON.parse(value)));
 const b={a:{...f.state(),session_id:crypto.randomUUID(),credential:'private-value',native_transition:{...f.state().native_transition,transition_id:crypto.randomUUID()}},state:{session:{start_request_id:crypto.randomUUID(),token:'private-value'}}};
 const before=structuredClone(b);f.core.traceNative('CHECK_ENTER',b);f.core.traceNative('CHECK_ENTER',b);
 f.core.traceNative('FAILURE',b,'REVALIDATION_REQUIRED');assert.equal(records.length,2);
 assert(records.every(r=>r.request_id===b.state.session.start_request_id&&r.transition_id===b.a.native_transition.transition_id&&r.authority_granted===false));
 assert(!JSON.stringify(records).includes('private-value'));assert.deepEqual(b,before);assert.equal(f.writes(),0);
});
test('trace rejects unbound requests and redacts unknown failure text',t=>{
 const f=fixture(),records=[];t.mock.method(console,'info',(_tag,value)=>records.push(JSON.parse(value)));
 const b={a:{...f.state(),session_id:crypto.randomUUID()},state:{session:{start_request_id:'not-a-request-id'}}};
 f.core.traceNative('FAILURE',b,'secret error text');assert.equal(records.length,0);
 b.state.session.start_request_id=crypto.randomUUID();f.core.traceNative('FAILURE',b,'secret error text');
 assert.equal(records[0].code,'OTHER');assert(!JSON.stringify(records).includes('secret error text'));
});
test('a failed console sink cannot prevent the original execution failure',t=>{
 const f=fixture();t.mock.method(console,'info',()=>{throw Error('CONSOLE_FAILED');});
 const b={a:{...f.state(),session_id:crypto.randomUUID()},state:{session:{start_request_id:crypto.randomUUID()}}};
 assert.doesNotThrow(()=>f.core.traceNative('FAILURE',b,'REVALIDATION_REQUIRED'));assert.equal(f.writes(),0);
});
