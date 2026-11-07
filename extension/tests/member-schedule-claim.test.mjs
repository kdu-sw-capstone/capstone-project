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
 const h={a,body,calls,schedule,occurrence,session,result:occurrence,ticks:()=>ticks,bundle:null,registryRows:[],root:null,startIntent:null,idleChecks:0};
 let coreTail=Promise.resolve();a.core.serial=f=>{const p=coreTail.then(f);coreTail=p.catch(()=>{});return p;};
 a.core.bundle=async()=>structuredClone(h.bundle);a.core.registry={rows:async()=>structuredClone(h.registryRows)};
 a.authority.current=async()=>structuredClone(h.root);a.authority.idle=async()=>{h.idleChecks++;if(h.root?.phase==='ACTIVE')throw Error('ROOT_OBLIGATION_EXISTS');};
 a.read=async key=>key==='member:start-intent'?structuredClone(h.startIntent):null;
 a.status=async()=>({local_status:h.bundle?.a.session_status??'IDLE',session_id:h.bundle?.a.session_id??null});
 a.request=async(path,payload,headers={},beforeSend=null)=>{const read=()=>{calls.push({path,payload:structuredClone(payload)});if(path.startsWith('/schedules?'))return {items:[schedule],has_more:false,next_cursor:null};if(path.endsWith('/occurrences'))return {items:[{...occurrence,session_id:session.session_id}],has_more:false,next_cursor:null};if(path==='/schedule-occurrences/claim')return structuredClone(h.result);if(path.startsWith('/sessions/'))return structuredClone(session);throw Error('UNEXPECTED_ROUTE');};if(beforeSend){const sent=await beforeSend(()=>({response:Promise.resolve(read())}));return sent.response;}return read();};
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
 h.a.request=async(p,b,...rest)=>{if(p==='/schedule-occurrences/claim'&&first){first=false;h.calls.push({path:p,payload:structuredClone(b)});throw Error('NETWORK_UNCONFIRMED');}return request(p,b,...rest);};
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
 const h=setup(),read=h.a.request;h.a.request=async(p,b,...rest)=>{if(p==='/schedule-occurrences/claim')throw Error('CAPABILITY_NOT_VERIFIED');return read(p,b,...rest);};
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
 h.a.request=async(p,b,...rest)=>p.endsWith('/occurrences')?{items:[{...h.occurrence,session_id:randomUUID()}],has_more:false,next_cursor:null}:request(p,b,...rest);
 await assert.rejects(h.a.claimSchedule(h.body),/SESSION_UNCONFIRMED/);assert.equal(h.ticks(),0);
});
test('another local execution cannot be returned as this occurrence result',async()=>{
 const h=setup();h.result=h.session;h.a.tickInner=async()=>({session_id:randomUUID(),local_status:'RUNNING'});
 await assert.rejects(h.a.claimSchedule(h.body),/EXECUTION_UNCONFIRMED/);
});
test('unconfirmed paginated occurrence lookup is never treated as a binding proof',async()=>{
 const h=setup();h.result=h.session;const request=h.a.request;
 h.a.request=async(p,b,...rest)=>p.endsWith('/occurrences')?{items:[],has_more:true,next_cursor:'opaque'}:request(p,b,...rest);
 await assert.rejects(h.a.claimSchedule(h.body),/OCCURRENCE_UNCONFIRMED/);assert.equal(h.ticks(),0);
});

test('shipped adapter bundle preserves occurrence binding and default activation denial',async()=>{
 const world=vm.createContext({crypto:globalThis.crypto,structuredClone,fetch:globalThis.fetch,AbortController,setTimeout,clearTimeout});
 vm.runInContext(readFileSync(new URL('../integration/member-a1-adapter.bundle.js',import.meta.url),'utf8'),world);
 const h=setup(world.FocurveMemberA1Adapter.MemberA1Adapter);h.result=h.session;
 assert.equal((await h.a.claimSchedule(h.body)).execution.session_id,h.session.session_id);
 delete h.a.core.verifyScheduledDeadline;
 await assert.rejects(h.a.claimSchedule(h.body),/SCHEDULE_FIXED_END_UNSUPPORTED/);
 busy(h);const before=h.calls.length;
 await assert.rejects(h.a.claimSchedule(h.body),/CLEANUP_REQUIRED/);
 assert.ok(h.calls.slice(before).every(c=>c.payload===undefined));
});

function busy(h,id=randomUUID(),status='UNKNOWN'){
 h.bundle={a:{session_id:id,owner_context:owner.owner_key,executor_id:owner.executor_id,session_status:status,cleanup_pending:true},state:{journal:{desired:'APPLIED',observed:'UNCONFIRMED'}},bindings:[]};
 return id;
}
test('P2 different UNKNOWN member execution blocks Server claim before mutation',async()=>{
 const h=setup();busy(h);await assert.rejects(h.a.claimSchedule(h.body),/CLEANUP_REQUIRED/);
 assert.equal(h.calls.filter(c=>c.path==='/schedule-occurrences/claim').length,0);assert.equal(h.ticks(),0);
});

const claims=h=>h.calls.filter(c=>c.path==='/schedule-occurrences/claim');
test('same occurrence UNKNOWN recovery is GET-only and preserves cleanup without replay',async()=>{
 const h=setup();busy(h,h.session.session_id);const before=structuredClone(h.bundle);
 // A recovery read does not require or activate the currently unsupported deadline capability.
 delete h.a.core.verifyScheduledDeadline;
 const r=await h.a.claimSchedule(h.body);
 assert.equal(r.occurrence_session_id,h.session.session_id);assert.equal(r.execution.local_status,'UNKNOWN');
 assert.equal(r.read_only,true);assert.equal(r.recovery_required,true);
 assert.equal(claims(h).length,0);assert.equal(h.ticks(),0);assert.ok(h.calls.every(c=>c.payload===undefined));assert.deepEqual(h.bundle,before);
});
test('same session cannot substitute a different occurrence start, version or schedule',async()=>{
 for(const change of [{scheduled_start_at:'2026-11-03T00:00:00.000Z'},{version:3},{schedule_id:randomUUID()}]){
  const h=setup();busy(h,h.session.session_id);
  await assert.rejects(h.a.claimSchedule({...h.body,...change}),/CLEANUP_REQUIRED/);
  assert.equal(claims(h).length,0);assert.equal(h.ticks(),0);
 }
});
test('read-only occurrence recovery rejects foreign saved owner or changed fixed end',async()=>{
 for(const field of ['owner_user_id','executor_id','planned_end_at','source']){
  const h=setup();busy(h,h.session.session_id);h.session[field]='wrong';
  await assert.rejects(h.a.claimSchedule(h.body),/SESSION_UNCONFIRMED/);assert.equal(claims(h).length,0);
 }
});
test('terminal status alone cannot erase unresolved binding or operation debt',async()=>{
 for(const kind of ['binding','operation']){
  const h=setup(),sid=randomUUID();busy(h,sid,'ENDED');h.bundle.a.cleanup_pending=false;h.bundle.state.journal={desired:'RELEASED',observed:'RELEASED'};
  h.registryRows=[kind==='binding'?{record_kind:'A1_BINDING',resolution:'NONE',cleanup_pending:true,scope:{session_id:sid,owner_context:owner.owner_key}}:{record_kind:'A1_OPERATION',phase:'IN_DOUBT',command:{owner_context:owner.owner_key,payload:{scope:{session_id:sid}}}}];
  await assert.rejects(h.a.claimSchedule(h.body),/CLEANUP_REQUIRED/);assert.equal(claims(h).length,0);assert.equal(h.ticks(),0);
 }
});
test('fully released terminal aggregate permits a new claim',async()=>{
 const h=setup();busy(h,randomUUID(),'ENDED');h.bundle.a.cleanup_pending=false;h.bundle.state.journal={desired:'RELEASED',observed:'RELEASED'};
 assert.equal((await h.a.claimSchedule(h.body)).status,'WAITING_CONFLICT');assert.equal(claims(h).length,1);assert.ok(h.idleChecks>0);
});
test('unresolved manual start intent blocks claim and completed intent does not',async()=>{
 const h=setup();h.startIntent={id:randomUUID(),completed:false};
 await assert.rejects(h.a.claimSchedule(h.body),/START_INTENT_CONFLICT/);assert.equal(claims(h).length,0);
 h.startIntent.completed=true;await h.a.claimSchedule(h.body);assert.equal(claims(h).length,1);
});
test('root authority and foreign cleanup prohibit new Server mutation',async()=>{
 for(const kind of ['root','foreign-binding']){
  const h=setup();
  if(kind==='root')h.root={...owner,session_id:randomUUID(),phase:'ACTIVE',owner_key:'MEMBER:8'};
  else h.registryRows=[{record_kind:'A1_BINDING',scope:{owner_context:'MEMBER:8',session_id:h.session.session_id},resolution:'NONE'}];
  await assert.rejects(h.a.claimSchedule(h.body),/ROOT_OBLIGATION_EXISTS|CLEANUP_REQUIRED/);assert.equal(claims(h).length,0);
 }
});
test('authority idle refusal and storage failure both stop claim before POST',async()=>{
 for(const kind of ['authority','storage']){
  const h=setup();if(kind==='authority')h.a.authority.idle=async()=>{throw Error('ROOT_OBLIGATION_EXISTS');};else h.a.core.registry.rows=async()=>{throw Error('STORE_UNCONFIRMED');};
  await assert.rejects(h.a.claimSchedule(h.body),/ROOT_OBLIGATION_EXISTS|STORE_UNCONFIRMED/);assert.equal(claims(h).length,0);
 }
});
test('busy state arising during async fixed-end verification blocks mutation',async()=>{
 const h=setup();h.a.core.verifyScheduledDeadline=async()=>{busy(h);return true;};
 await assert.rejects(h.a.claimSchedule(h.body),/CLEANUP_REQUIRED/);assert.equal(claims(h).length,0);
});
test('real transport rechecks local obligations after async credential acquisition',async()=>{
 const h=setup(),mock=h.a.request;let posts=0;
 h.a.auth.credentials=async()=>{busy(h);return {...owner,access_token:'synthetic'};};
 h.a.fetch=async()=>{posts++;throw Error('MUST_NOT_SEND');};
 h.a.request=async(p,b,headers,guard)=>p==='/schedule-occurrences/claim'?MemberA1Adapter.prototype.request.call(h.a,p,b,headers,guard):mock(p,b,headers,guard);
 await assert.rejects(h.a.claimSchedule(h.body),/CLEANUP_REQUIRED/);assert.equal(posts,0);assert.equal(h.ticks(),0);
});
test('real transport still sends one claim when final local guard confirms idle',async()=>{
 const h=setup(),mock=h.a.request;let posts=0;
 h.a.auth.credentials=async()=>({...owner,access_token:'synthetic'});
 h.a.fetch=async(url,init)=>{posts++;assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),h.body);return {ok:true,json:async()=>h.occurrence};};
 h.a.request=async(p,b,headers,guard)=>p==='/schedule-occurrences/claim'?MemberA1Adapter.prototype.request.call(h.a,p,b,headers,guard):mock(p,b,headers,guard);
 await h.a.claimSchedule(h.body);assert.equal(posts,1);
});

test('P2 final identity wait cannot bypass the last local obligation check',async()=>{
 const h=setup();let identities=0,posts=0,release,entered,checking=false;
 const waiting=new Promise(r=>{entered=r;});const paused=new Promise(r=>{release=r;});
 h.a.identity=async()=>{if(!checking&&++identities===3){entered();await paused;}return {...owner};};
 h.a.auth.credentials=async()=>({...owner,access_token:'synthetic'});
 h.a.fetch=async()=>{posts++;return {ok:true,json:async()=>h.occurrence};};
 const dispatch=async send=>{checking=true;try{await h.a.guardScheduleClaim(owner);}finally{checking=false;}return send?.();};
 const pending=MemberA1Adapter.prototype.request.call(h.a,'/schedule-occurrences/claim',h.body,{},dispatch);
 await waiting;busy(h);release();
 await assert.rejects(pending,/CLEANUP_REQUIRED/);assert.equal(posts,0);
});

test('final admission waits for earlier queued Core UNKNOWN and sends no POST',async()=>{
 const h=setup(),mock=h.a.request;let posts=0;
 h.a.auth.credentials=async()=>{h.a.core.serial(()=>busy(h));return {...owner,access_token:'synthetic'};};
 h.a.fetch=async()=>{posts++;throw Error('MUST_NOT_SEND');};
 h.a.request=async(p,b,headers,dispatch)=>p==='/schedule-occurrences/claim'?MemberA1Adapter.prototype.request.call(h.a,p,b,headers,dispatch):mock(p,b,headers,dispatch);
 await assert.rejects(h.a.claimSchedule(h.body),/CLEANUP_REQUIRED/);assert.equal(posts,0);
});
test('guard and fetch start share Core serial but a pending network does not block cleanup',async()=>{
 const h=setup(),mock=h.a.request,events=[];let resolveResponse,queued;
 const response=new Promise(r=>{resolveResponse=r;});const guard=h.a.guardScheduleClaim.bind(h.a);
 h.a.guardScheduleClaim=async i=>{await guard(i);if(h.inFinal){queued=h.a.core.serial(()=>{events.push('core-transition');busy(h);});events.push('guard');}};
 const original=h.a.dispatchScheduleClaim.bind(h.a);
 h.a.dispatchScheduleClaim=(i,send)=>original(i,()=>{h.inFinal=false;return send();});
 h.a.auth.credentials=async()=>({...owner,access_token:'synthetic'});
 h.a.fetch=()=>{events.push('fetch-start');return response;};
 h.a.request=async(p,b,headers,dispatch)=>p==='/schedule-occurrences/claim'?MemberA1Adapter.prototype.request.call(h.a,p,b,headers,send=>{h.inFinal=true;return dispatch(send);}):mock(p,b,headers,dispatch);
 const pending=h.a.claimSchedule(h.body);
 // A bounded timeout distinguishes a boxed response from holding serial until HTTP completion.
 const wait=async()=>{while(!queued)await new Promise(r=>setImmediate(r));await queued;};
 let timer;try{await Promise.race([wait(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('CORE_HELD_BY_NETWORK')),1000);})]);}finally{clearTimeout(timer);}
 assert.deepEqual(events,['guard','fetch-start','core-transition']);
 resolveResponse({ok:true,json:async()=>h.occurrence});await pending;
});
test('claim cannot dispatch without the Core admission serialization boundary',async()=>{
 const h=setup();delete h.a.core.serial;
 await assert.rejects(h.a.claimSchedule(h.body),/SCHEDULE_ADMISSION_UNSUPPORTED/);assert.equal(claims(h).length,0);
});
