import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fixture} from './member-fixture.mjs';
import {MemberA1Adapter} from '../integration/member-a1-adapter.mjs';
import {MemberAuth} from '../src/member-auth.js';

test('END-only auth fence rejects background refresh before loading, writing or sending uncertain tokens',async()=>{
 let reads=0,posts=0;const auth=new MemberAuth({store:{get:async()=>{reads++;throw Error('must not load');}},fetch:async()=>{posts++;throw Error('must not send');}}),prior=globalThis.__memberA1;
 try{globalThis.__memberA1={auth,preservedEndScope:{}};await assert.rejects(auth.credentials(),{message:'PRESERVED_END_ONLY'});assert.equal(reads,0);assert.equal(posts,0);}finally{globalThis.__memberA1=prior;}
});

async function setup({unreachable=false}={}){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 const authorize=f.env.authorize;f.env.authorize=async c=>{const r=await authorize(c);r.admission.authority='https://localhost:30179/api/v1';return r;};
 await f.core.startCommand(f.command);await f.core.markUnknown('UNAUTHORIZED_SENDER');
 f.chrome.declarativeNetRequest.getDynamicRules=async()=>[];
 const i={owner_key:'MEMBER:1',executor_id:f.owner.installation_id,authority:'http://127.0.0.1/fixture'};let released=0,credentials=0;
 const adapter=new MemberA1Adapter({auth:{status:async()=>({phase:'AUTH_RECOVERY_REQUIRED',owner_user_id:'1',executor_id:i.executor_id,server_url:i.authority}),credentials:async()=>{credentials++;throw Error('EXPIRED_AUTH_MUST_NOT_BE_USED');}},core:f.core,db:f.db,authority:{released:async()=>released++},inspectGuest:async()=>({})});
 const scope={session_id:f.command.session_id,executor_id:i.executor_id,owner_user_id:'1',origin:'https://localhost:30179',policy_snapshot_id:f.command.snapshot.policy_snapshot_id,base_revision:1,not_before:new Date(Date.now()+1000).toISOString()};
 // Fixture uses a path authority; bind scope to the same API shape as production.
 i.authority=scope.origin+'/api/v1';adapter.auth.status=async()=>({phase:'AUTH_RECOVERY_REQUIRED',owner_user_id:'1',executor_id:i.executor_id,server_url:i.authority});
 if(unreachable)f.frames[0].documentLifecycle='cached';
 return {f,adapter,i,scope,released:()=>released,credentials:()=>credentials};
}

test('expired member UNKNOWN uses existing offline END, verifies DOM release, and creates one immutable action without credentials',async()=>{
 const x=await setup(),before=await x.f.core.bundle();
 assert.equal((await x.adapter.offlineEnd()).local_release_confirmed,true);
 const after=await x.adapter.verifyRelease();assert.equal(after.a.session_status,'ENDED');assert.equal(after.bindings.some(b=>b.cleanup_pending||b.resolution==='NONE'),false);
 assert.deepEqual(after.a.diagnostic_codes,before.a.diagnostic_codes);
 const rows=await x.adapter.pendingOutbox(x.i);assert.equal(rows.length,1);assert.equal(rows[0].kind,'LOCAL_END');
 await x.adapter.offlineEnd();assert.deepEqual(await x.adapter.pendingOutbox(x.i),rows);assert.equal(x.credentials(),0);assert.equal(x.released(),0);
});

test('unreachable DOM preserves obligation and cannot produce a confirmed local END or release root claim',async()=>{
 const x=await setup({unreachable:true});await assert.rejects(x.adapter.offlineEnd(),{message:'RELEASE_UNCONFIRMED'});
 assert.equal(await x.adapter.read('member:local-end:'+x.scope.session_id),null);assert.equal(x.released(),0);assert((await x.f.core.bundle()).bindings.some(b=>b.resolution==='NONE'));
});

async function reconciliation({loseAckAt=-1,terminalMismatch=false,foreign=false}={}){
 const x=await setup();await x.adapter.offlineEnd();let ended=false,posts=0,lost=false;const accepted=new Map(),calls=[];
 for(let n=0;n<50;n++){
  const body={report_id:crypto.randomUUID(),command_id:x.f.command.command_id,session_id:x.scope.session_id,executor_id:x.i.executor_id,desired_revision:1,result:n===49?'UNCONFIRMED':'APPLIED',observed_at:new Date(Date.now()-1000).toISOString(),intervals:[]};
  await x.adapter.put('member:outbox:'+body.report_id,{kind:'REPORT',body,acked:false,...x.i,...(foreign&&n===0?{authority:'https://foreign.invalid/api/v1'}:{})});
 }
 const send=async(path,body)=>{
  calls.push({path,body:structuredClone(body)});
  if(path.endsWith('/reconcile')){ended=true;return {desired_state:'RELEASED',acknowledged_actions:[body.local_actions[0].action_id]};}
  if(path.startsWith('/sessions/'))return {session_id:x.scope.session_id,executor_id:x.i.executor_id,owner_user_id:'1',policy_snapshot_id:x.scope.policy_snapshot_id,desired_revision:2,execution_status:terminalMismatch?'UNKNOWN':ended?'ENDED':'UNKNOWN',policy_released_at:ended?new Date().toISOString():null};
  if(path.endsWith('/reports')){assert(ended);const raw=JSON.stringify(body),old=accepted.get(body.report_id);if(old)assert.equal(old,raw);accepted.set(body.report_id,raw);if(posts++===loseAckAt&&!lost){lost=true;throw Error('ACK_LOST');}return {result:old?'DUPLICATE':'ACCEPTED',desired_revision:2};}
  return {session_id:x.scope.session_id,executor_id:x.i.executor_id,owner_user_id:'1',server_ended:ended,lock_released:ended,focus_allowed:false};
 };
 return {...x,send,calls,accepted};
}

test('LOCAL_END precedes 50 immutable reports; root is released only after terminal ACK and all reports',async()=>{
 const x=await reconciliation();const r=await x.adapter.reconcilePreservedEnd(x.scope,x.send);
 assert.equal(x.calls[0].path.endsWith('/reconcile'),true);assert.equal(x.accepted.size,50);assert.equal(x.released(),1);assert.equal(r.focus_allowed,false);assert.equal(r.hold_preserved,true);assert.equal((await x.adapter.pendingOutbox(x.i)).length,0);assert.equal(x.credentials(),0);
});

test('lost report ACK preserves unacknowledged row and retries the identical report ID/body without re-END',async()=>{
 const x=await reconciliation({loseAckAt:12});await assert.rejects(x.adapter.reconcilePreservedEnd(x.scope,x.send),{message:'ACK_LOST'});assert.equal(x.released(),0);
 await x.adapter.reconcilePreservedEnd(x.scope,x.send);assert.equal(x.accepted.size,50);assert.equal(x.calls.filter(c=>c.path.endsWith('/reconcile')).length,1);assert.equal(x.released(),1);
});

test('nonterminal server rejects before draining reports and preserves the root',async()=>{
 const x=await reconciliation({terminalMismatch:true});await assert.rejects(x.adapter.reconcilePreservedEnd(x.scope,x.send),{message:'SERVER_RELEASE_UNCONFIRMED'});assert.equal(x.accepted.size,0);assert.equal(x.released(),0);
});

test('foreign outbox obligations must not disappear through identity-filtered enumeration',async()=>{
 const x=await reconciliation({foreign:true});await assert.rejects(x.adapter.reconcilePreservedEnd(x.scope,x.send),{message:'OUTBOX_SCOPE_UNCONFIRMED'});assert.equal(x.released(),0);
});

test('termination scope permanently fences ordinary START, APPLY and polling on that adapter instance',async()=>{
 const x=await setup();x.adapter.preservedEndScope={};for(const op of [()=>x.adapter.start(2),()=>x.adapter.assertApply(),()=>x.adapter.tickInnerBody()])await assert.rejects(op(),{message:'PRESERVED_END_ONLY'});
});

const ctx=vm.createContext({Date,URL,AbortController,setTimeout,clearTimeout});vm.runInContext(await readFile(new URL('../integration/preserved-end.js',import.meta.url),'utf8'),ctx);
test('default Worker fetch keeps WorkerGlobalScope receiver instead of the controller instance',async()=>{
 const source=await readFile(new URL('../integration/preserved-end.js',import.meta.url),'utf8');
 for(const old of [true,false]){
  const worker=vm.createContext({});vm.runInContext("globalThis.fetch=function(){if(this!==globalThis)throw TypeError('Illegal invocation');return 'FETCH_OK';}",worker);
  vm.runInContext(old?source.replace('fetch=globalThis.fetch.bind(globalThis)','fetch=globalThis.fetch'):source,worker);
  if(old)assert.throws(()=>vm.runInContext('new FocurvePreservedEnd.PreservedEnd({}).fetch()',worker),/Illegal invocation/);
  else assert.equal(vm.runInContext('new FocurvePreservedEnd.PreservedEnd({}).fetch()',worker),'FETCH_OK');
 }
});
async function controller(){
 const x=await setup(),now=Date.now();
 const grant={contract:'FOCURVE_PRESERVED_END_SCOPE_1',installation_id:'a'.repeat(32),extension_id:'a'.repeat(32),profile_instance:'b'.repeat(32),operation_id:'c'.repeat(32),...x.scope,not_before:new Date(now-1000).toISOString(),not_after:new Date(now+600000).toISOString()};
 grant.callback='chrome-extension://'+grant.extension_id+'/popup/popup.html';let sends=0,serverEnded=false;const actions=[];
 x.adapter.authority.current=async()=>({phase:'ACTIVE',session_id:grant.session_id,owner_key:x.i.owner_key,executor_id:x.i.executor_id,authority:x.i.authority});
 const raw={phase:'AUTH_RECOVERY_REQUIRED',owner_user_id:'1',executor_id:x.i.executor_id,server_url:x.i.authority,web_origin:grant.origin,installation_proof:'LOCAL_ONLY_PROOF',access_token:'EXPIRED_NEVER_SEND',refresh_token:'UNCERTAIN_NEVER_SEND'};
 const actor=new ctx.FocurvePreservedEnd.PreservedEnd({readGrant:async()=>structuredClone(grant),getAdapter:()=>x.adapter,getRawAuth:async()=>raw,getInstallation:async()=>({installation_id:x.i.executor_id}),identity:()=>({extensionId:grant.extension_id,origin:grant.origin,profileInstance:grant.profile_instance}),fetch:async(url,options)=>{
  sends++;assert.equal(options.headers.Authorization,undefined);assert.equal(options.headers['X-Installation-Proof'],raw.installation_proof);assert.notEqual(options.body?.includes(raw.refresh_token),true);
  if(url.endsWith('/reconcile')){const body=JSON.parse(options.body);actions.push(structuredClone(body));serverEnded=true;return {ok:true,json:async()=>({desired_state:'RELEASED',acknowledged_actions:[body.local_actions[0].action_id]})};}
  if(url.includes('/sessions/'))return {ok:true,json:async()=>({session_id:grant.session_id,executor_id:grant.executor_id,owner_user_id:'1',policy_snapshot_id:grant.policy_snapshot_id,desired_revision:2,execution_status:'ENDED',policy_released_at:new Date().toISOString()})};
  return {ok:true,json:async()=>({operation_id:grant.operation_id,session_id:grant.session_id,owner_user_id:'1',executor_id:grant.executor_id,server_ended:serverEnded,lock_released:serverEnded,focus_allowed:false})};
 }});
 return {...x,grant,actor,raw,actions,sends:()=>sends};
}

test('explicit product controller admits one local END under expired auth, preserves HOLD and rejects duplicate END',async()=>{
 const x=await controller();const first=await x.actor.run('END_LOCAL');assert.equal(first.local_release_confirmed,true);assert.equal(first.server_ended_confirmed,false);assert.equal(first.hold_preserved,true);
 await assert.rejects(x.actor.run('END_LOCAL'),{message:'PRESERVED_END_STATE_NOT_ALLOWED'});assert.equal((await x.adapter.pendingOutbox(x.i)).filter(r=>r.kind==='LOCAL_END').length,1);
 assert.equal((await x.actor.inspect()).local_release_confirmed,true,'a reopened page can resume report reconciliation, never another END');
});

test('identity mismatch denies before network or local mutation and response-loss attempt is not replayable',async()=>{
 const x=await controller();x.raw.owner_user_id='2';await assert.rejects(x.actor.run('END_LOCAL'),{message:'PRESERVED_END_OWNER_MISMATCH'});assert.equal(x.sends(),0);
 x.raw.owner_user_id='1';let attempts=0;x.adapter.offlineEnd=async()=>{attempts++;throw Error('NATIVE_RESPONSE_LOST');};
 await assert.rejects(x.actor.run('END_LOCAL'),{message:'NATIVE_RESPONSE_LOST'});await assert.rejects(x.actor.run('END_LOCAL'));assert.equal(attempts,1);assert.equal(x.released(),0);const attempt=await x.adapter.read('member:preserved-end:'+x.grant.operation_id);assert.equal(attempt.failure_code,'NATIVE_RESPONSE_LOST');assert.equal(attempt.owner_key,'MEMBER:1');assert.equal((await x.actor.inspect()).can_end_local,false);
 await assert.rejects(x.actor.run('RECONCILE'),{message:'PRESERVED_END_LOCAL_RELEASE_REQUIRED'});
});

test('Core Worker recreation keeps cached-document release unconfirmed rather than manufacturing a lease',async()=>{
 const x=await setup({unreachable:true});await x.f.restart();x.adapter.core=x.f.core;
 await assert.rejects(x.adapter.offlineEnd());assert.equal(x.released(),0);assert.equal(await x.adapter.read('member:local-end:'+x.scope.session_id),null);
});

test('ENDING can finish on an existing verified native tab-removal event without forging a Content restoration ACK',async()=>{
 const x=await setup({unreachable:true});await assert.rejects(x.adapter.offlineEnd(),{message:'RELEASE_UNCONFIRMED'});
 assert.equal((await x.f.core.bundle()).a.session_status,'ENDING');
 await x.f.emitRemoved(1);const retired=await x.f.core.bundle();
 assert.equal(retired.bindings[0].resolution,'GONE_NATIVE');
 assert.equal(retired.bindings[0].native_resolution_event,'TAB_REMOVED');
 assert.equal(retired.bindings[0].native_resolution_proof.kind,'ROOT_TAB_REMOVED');
 assert.equal(retired.bindings[0].release_evidence,null);
 await x.f.core.serial(()=>x.f.core.finish());
 assert.equal((await x.adapter.verifyRelease()).a.session_status,'ENDED');
 assert.equal(x.released(),0,'local completion alone cannot release the server/root claim');
});

test('ENDING plus missing document without a native lifecycle event preserves debt and cannot finish',async()=>{
 const x=await setup({unreachable:true});await assert.rejects(x.adapter.offlineEnd(),{message:'RELEASE_UNCONFIRMED'});
 x.f.frames.splice(0,x.f.frames.length); // Absence observation, deliberately no Native callback.
 await x.f.core.serial(()=>x.f.core.finish());
 const b=await x.f.core.bundle();assert.equal(b.a.session_status,'ENDING');assert.equal(b.bindings[0].resolution,'NONE');assert.equal(b.bindings[0].cleanup_pending,true);
 assert.equal(b.bindings[0].native_resolution_proof??null,null);
 await assert.rejects(x.adapter.verifyRelease(),{message:'RELEASE_UNCONFIRMED'});assert.equal(x.released(),0);
});

test('termination grant remains bounded to exact profile, origin, callback and fresh twenty-minute scope',()=>{
 const now=Date.now(),g={contract:'FOCURVE_PRESERVED_END_SCOPE_1',installation_id:'a'.repeat(32),extension_id:'a'.repeat(32),profile_instance:'b'.repeat(32),operation_id:'c'.repeat(32),executor_id:crypto.randomUUID(),owner_user_id:'1',session_id:crypto.randomUUID(),policy_snapshot_id:crypto.randomUUID(),base_revision:1,origin:'https://localhost:30179',callback:'chrome-extension://'+'a'.repeat(32)+'/popup/popup.html',not_before:new Date(now-1000).toISOString(),not_after:new Date(now+600000).toISOString()};
 const identity={extensionId:g.extension_id,profileInstance:g.profile_instance,origin:g.origin};assert.equal(ctx.FocurvePreservedEnd.validate(g,identity,now),g);
 for(const patch of [{profile_instance:'d'.repeat(32)},{callback:'https://foreign.invalid'},{not_after:new Date(now-1).toISOString()},{not_after:new Date(now+1200000).toISOString()},{extra:true}])assert.throws(()=>ctx.FocurvePreservedEnd.validate({...g,...patch},identity,now));
});


test('fresh scope reconciles the existing immutable local END after a prior scope ended, without another Core END',async()=>{
 const x=await controller();let ends=0;const original=x.adapter.offlineEnd.bind(x.adapter);x.adapter.offlineEnd=()=>{ends++;return original();};
 await x.actor.run('END_LOCAL');const rows=await x.adapter.pendingOutbox(x.i),body=structuredClone(rows[0].body);
 const begin=Date.parse(body.local_actions[0].report.observed_at)+1000;
 x.grant.operation_id='e'.repeat(32);x.grant.not_before=new Date(begin).toISOString();x.grant.not_after=new Date(begin+600000).toISOString();x.actor.now=()=>begin+100;
 const result=await x.actor.run('RECONCILE');assert.equal(result.server_ended_confirmed,true);assert.equal(ends,1);assert.deepEqual(x.actions,[body]);
});
const negativeScopes=['no receipt','receipt without verified restoration','foreign member'];
for(const variant of negativeScopes)test('fresh reconciliation scope rejects '+variant+' without executing END or sending reports',async()=>{
 const x=await controller();let ends=0;x.adapter.offlineEnd=async()=>{ends++;throw Error('END_MUST_NOT_RUN');};
 if(variant==='receipt without verified restoration')await x.adapter.put('member:local-end:'+x.grant.session_id,{confirmed:true,action_id:crypto.randomUUID()});
 if(variant==='foreign member')x.raw.owner_user_id='2';
 await assert.rejects(x.actor.run('RECONCILE'));assert.equal(ends,0);assert.equal(x.actions.length,0);assert.equal(x.released(),0);
});
