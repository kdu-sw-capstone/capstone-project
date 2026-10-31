import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {MemberA1Adapter} from '../integration/member-a1-adapter.mjs';
const owner={owner_key:'MEMBER:7',executor_id:randomUUID(),authority:'https://server.test/api/v1'};
const input=()=>({schedule_id:randomUUID(),version:2,scheduled_start_at:'2026-11-02T00:00:00.000Z'});
function setup(Adapter=MemberA1Adapter){
 const body=input(),calls=[];let ticks=0;
 const schedule={schedule_id:body.schedule_id,executor_id:owner.executor_id,version:2,enabled:true,deleted_at:null,duration_minutes:5};
 const occurrence={occurrence_id:randomUUID(),schedule_id:body.schedule_id,schedule_version:2,scheduled_start_at:body.scheduled_start_at,scheduled_end_at:'2026-11-02T00:05:00.000Z',status:'WAITING_CONFLICT',session_id:null,reason:null};
 const session={session_id:randomUUID(),executor_id:owner.executor_id,owner_user_id:'7',source:'SCHEDULE',origin:'MEMBER',planned_end_at:occurrence.scheduled_end_at,execution_status:'STARTING'};
 const a=new Adapter({auth:{},core:{verifyScheduledDeadline:async()=>true},db:{},authority:{},inspectGuest:async()=>({active:false,unresolved:false,cleanup:false})});
 a.identity=async()=>({...owner});
 const h={a,body,calls,schedule,occurrence,session,result:occurrence,ticks:()=>ticks};
 a.request=async(path,payload)=>{calls.push({path,payload:structuredClone(payload)});if(path.startsWith('/schedules?'))return {items:[schedule],has_more:false,next_cursor:null};if(path.endsWith('/occurrences'))return {items:[{...occurrence,session_id:session.session_id}],has_more:false,next_cursor:null};if(path==='/schedule-occurrences/claim')return structuredClone(h.result);if(path.startsWith('/sessions/'))return structuredClone(session);throw Error('UNEXPECTED_ROUTE');};
 a.tickInner=async()=>{ticks++;return {local_status:'NATIVE_VERIFYING',session_id:session.session_id};};return h;
}
test('conflict returns existing occurrence and never falls back to manual START',async()=>{
 const h=setup(),r=await h.a.claimSchedule(h.body);assert.equal(r.status,'WAITING_CONFLICT');assert.equal(h.ticks(),0);
 assert.deepEqual(h.calls[1],{path:'/schedule-occurrences/claim',payload:h.body});assert.ok(h.calls.every(c=>c.path!=='/sessions'));
});
test('STARTING re-read enters existing command path; transport result is not RUNNING',async()=>{
 const h=setup();h.result=h.session;const r=await h.a.claimSchedule(h.body);
 assert.equal(r.execution.local_status,'NATIVE_VERIFYING');assert.equal(h.ticks(),1);assert.equal(h.calls[3].path,'/sessions/'+h.session.session_id);
});
test('lost response retry uses exact occurrence identity, never creates a new START request',async()=>{
 const h=setup(),request=h.a.request;let first=true;
 h.a.request=async(p,b)=>{if(p==='/schedule-occurrences/claim'&&first){first=false;h.calls.push({path:p,payload:structuredClone(b)});throw Error('NETWORK_UNCONFIRMED');}return request(p,b);};
 await assert.rejects(h.a.claimSchedule(h.body),/NETWORK_UNCONFIRMED/);await h.a.claimSchedule(h.body);
 const claims=h.calls.filter(c=>c.path==='/schedule-occurrences/claim');assert.deepEqual(claims[0].payload,claims[1].payload);
});
test('owner, fixed end, source and version mismatches never reach Core dispatch',async()=>{
 for(const field of ['executor_id','owner_user_id','planned_end_at','source']){const h=setup();h.result={...h.session,[field]:'wrong'};await assert.rejects(h.a.claimSchedule(h.body),/SESSION_UNCONFIRMED/);assert.equal(h.ticks(),0);}
 const h=setup();h.schedule.version=3;await assert.rejects(h.a.claimSchedule(h.body),/VERSION_UNCONFIRMED/);assert.equal(h.calls.length,1);
});
test('session readback cannot substitute another session or fixed end',async()=>{
 const h=setup();h.result={...h.session};h.session.planned_end_at='2026-11-02T00:06:00.000Z';
 await assert.rejects(h.a.claimSchedule(h.body),/SESSION_UNCONFIRMED/);assert.equal(h.ticks(),0);
});
test('owner change after claim cannot consume receipt as current execution',async()=>{
 const h=setup();let n=0;h.a.identity=async()=>++n>=3?{...owner,owner_key:'MEMBER:8'}:{...owner};
 await assert.rejects(h.a.claimSchedule(h.body),/OWNER_MISMATCH/);assert.equal(h.ticks(),0);
});
test('missing actor is a real failure; no success or local session is manufactured',async()=>{
 const h=setup(),read=h.a.request;h.a.request=async(p,b)=>{if(p==='/schedule-occurrences/claim')throw Error('CAPABILITY_NOT_VERIFIED');return read(p,b);};
 await assert.rejects(h.a.claimSchedule(h.body),/CAPABILITY_NOT_VERIFIED/);assert.equal(h.ticks(),0);
});
test('invalid input, END-only context and Guest obligations block before claim',async()=>{
 const h=setup();await assert.rejects(h.a.claimSchedule({...h.body,version:0}),/INVALID/);assert.equal(h.calls.length,0);
 h.a.preservedEndScope={};await assert.rejects(h.a.claimSchedule(h.body),/PRESERVED_END_ONLY/);delete h.a.preservedEndScope;
 h.a.inspectGuest=async()=>({unresolved:true});await assert.rejects(h.a.claimSchedule(h.body),/GUEST_OBLIGATION_EXISTS/);assert.equal(h.calls.length,0);
});

test('queued call captures immutable request before caller can mutate it',async()=>{
 const h=setup(),expected=structuredClone(h.body),pending=h.a.claimSchedule(h.body);h.body.version=99;
 await pending;assert.deepEqual(h.calls[1].payload,expected);
});

test('production default without fixed-end authority refuses before Server claim',async()=>{
 const h=setup();delete h.a.core.verifyScheduledDeadline;
 await assert.rejects(h.a.claimSchedule(h.body),/SCHEDULE_FIXED_END_UNSUPPORTED/);
 assert.equal(h.calls.filter(c=>c.path==='/schedule-occurrences/claim').length,0);assert.equal(h.ticks(),0);
});

test('different durable occurrence session cannot reach command dispatch',async()=>{
 const h=setup();h.result=h.session;const request=h.a.request;
 h.a.request=async(p,b)=>p.endsWith('/occurrences')?{items:[{...h.occurrence,session_id:randomUUID()}],has_more:false,next_cursor:null}:request(p,b);
 await assert.rejects(h.a.claimSchedule(h.body),/SESSION_UNCONFIRMED/);assert.equal(h.ticks(),0);
});
test('another local execution cannot be returned as this occurrence result',async()=>{
 const h=setup();h.result=h.session;h.a.tickInner=async()=>({session_id:randomUUID(),local_status:'RUNNING'});
 await assert.rejects(h.a.claimSchedule(h.body),/EXECUTION_UNCONFIRMED/);
});
test('unconfirmed paginated occurrence lookup is never treated as a binding proof',async()=>{
 const h=setup();h.result=h.session;const request=h.a.request;
 h.a.request=async(p,b)=>p.endsWith('/occurrences')?{items:[],has_more:true,next_cursor:'opaque'}:request(p,b);
 await assert.rejects(h.a.claimSchedule(h.body),/OCCURRENCE_UNCONFIRMED/);assert.equal(h.ticks(),0);
});

test('shipped adapter bundle preserves occurrence binding and default activation denial',async()=>{
 const world=vm.createContext({crypto:globalThis.crypto,structuredClone,fetch:globalThis.fetch,AbortController,setTimeout,clearTimeout});
 vm.runInContext(readFileSync(new URL('../integration/member-a1-adapter.bundle.js',import.meta.url),'utf8'),world);
 const h=setup(world.FocurveMemberA1Adapter.MemberA1Adapter);h.result=h.session;
 assert.equal((await h.a.claimSchedule(h.body)).execution.session_id,h.session.session_id);
 delete h.a.core.verifyScheduledDeadline;
 await assert.rejects(h.a.claimSchedule(h.body),/SCHEDULE_FIXED_END_UNSUPPORTED/);
});
