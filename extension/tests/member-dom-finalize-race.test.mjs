import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './member-fixture.mjs';
import {control} from '../member-a1/domain.mjs';

async function prepared(initialPlan=true,{blockedSite=false}={}){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 if(blockedSite)f.command.snapshot.sites.push({...structuredClone(f.command.snapshot.sites[0]),site_id:'2',canonical_host:'example.com',include_subdomains:false,purpose:'DISTRACTION',access_policy:'BLOCK',feature_policies:[]});
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 await f.core.startCommand(f.command);
 const bundle=await f.core.bundle(),binding=bundle.bindings[0],actor=f.receivers.get(binding.scope.document_id);
 const operation=(await f.core.registry.rows()).find(x=>x.phase==='COMPLETED'&&x.command.payload.operation==='APPLY');
 const plan=async (node,confirm=true)=>{
  const b=await f.core.bundle(),current=b.bindings[0];
  await actor.client.commit({kind:'LEDGER_PLAN',operation_id:operation.operation_id,entries:[...current.ledger,{node_id:node,display:'grid',priority:'',inert:false}]});
  if(confirm)await actor.checkpoint();
 };
 if(initialPlan){await plan(2);assert.equal((await f.core.bundle()).a.effect_transition.grants[0].phase,'CONFIRMED');}
 return {f,actor,plan};
}

test('member DOM finalization replans a confirmed-aborted CAS after a new valid ledger plan',async()=>{
 const {f,plan}=await prepared(),frame=f.core.p1.frame.bind(f.core.p1);let injected=false;
 f.core.p1.frame=async b=>{const result=await frame(b);if(!injected){injected=true;await plan(3);}return result;};
 await f.core.tick();
 const result=await f.core.bundle();
 assert.equal(injected,true);assert.equal(result.a.session_status,'RUNNING');
 assert.deepEqual(result.a.diagnostic_codes,[]);
 assert.equal(result.bindings[0].ledger.length,3);
 assert.equal(result.a.effect_transition.phase,'CONFIRMED');
});

test('a Core bundle is one readonly snapshot and cannot turn a new DOM plan into cleanup',async()=>{
 const {f,plan}=await prepared(false),transaction=f.db.transaction;let armed=true,injected=false,releases=0;
 const inject=async result=>{if(armed){armed=false;await plan(2,false);injected=true;}return result;};
 const db={...f.db,load:async()=>inject(await f.db.load()),transaction:async(mode,work)=>{const result=await transaction(mode,work);return mode==='readonly'?inject(result):result;}};f.env.db=db;f.core.store.db=db;
 const selected=await f.core.bundle();
 assert.equal(injected,true);
 assert.equal(selected.state.session.status,selected.a.session_status,'Session and Aggregate must share a snapshot');
 assert.equal(selected.a.session_status,'RUNNING');
 assert.equal(selected.bindings[0].ordinary_authority,'ACTIVE','later DOM inactivity cannot leak into earlier RUNNING bundle');
 f.core.release=async()=>{releases++;throw Error('UNEXPECTED_RELEASE');};
 await f.core.cleanupInactive(selected);assert.equal(releases,0);
 const latest=await f.core.bundle();assert.equal(latest.a.session_status,'EFFECT_VERIFYING');
 assert.equal(latest.bindings[0].ordinary_authority,'INACTIVE');
});

test('a later unconfirmed DOM plan cannot be promoted by an earlier confirmation',async()=>{
 const {f,actor,plan}=await prepared(),frame=f.core.p1.frame.bind(f.core.p1);let injected=false;
 f.core.p1.frame=async b=>{const result=await frame(b);if(!injected){injected=true;await plan(3,false);}return result;};
 await f.core.tick();let result=await f.core.bundle();
 assert.equal(result.a.session_status,'EFFECT_VERIFYING');assert.equal(result.bindings[0].ordinary_authority,'INACTIVE');
 assert.equal(result.a.effect_transition.grants[0].phase,'OPEN');
 await actor.checkpoint();await f.core.tick();result=await f.core.bundle();
 assert.equal(result.a.session_status,'RUNNING');
});

test('concurrent END retains priority and is never classified as a DOM replan',async()=>{
 const {f}=await prepared(),frame=f.core.p1.frame.bind(f.core.p1);let injected=false;
 f.core.p1.frame=async b=>{const result=await frame(b);if(!injected){injected=true;await f.core.endIntent(f.command.session_id);}return result;};
 await assert.rejects(f.core.tick(),{message:'GENERATION_CHANGED'});
 const result=await f.core.bundle();assert.equal(result.a.intent,'END');assert.notEqual(result.a.session_status,'RUNNING');
 assert.equal(result.a.effect_transition.phase,'CANCELLED');
});

test('owner fence changes are rejected rather than replanned',async()=>{
 const {f}=await prepared(),frame=f.core.p1.frame.bind(f.core.p1);let injected=false;
 f.core.p1.frame=async b=>{const result=await frame(b);if(!injected){injected=true;await f.core.store.atomic((tx,done)=>{const q=tx.objectStore('metadata').get('a1:owner-fence');q.onsuccess=()=>{q.result.epoch=crypto.randomUUID();tx.objectStore('metadata').put(q.result);done();};});}return result;};
 await assert.rejects(f.core.tick(),{message:'OWNER_MISMATCH'});
 assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');
});

test('actual generation change is not converted to a benign DOM CAS race',async()=>{
 const {f}=await prepared(),frame=f.core.p1.frame.bind(f.core.p1);let injected=false;
 f.core.p1.frame=async b=>{const result=await frame(b);if(!injected){injected=true;await f.core.invalidate('BFCACHE');}return result;};
 await assert.rejects(f.core.tick(),{message:'GENERATION_CHANGED'});
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('uncertain store failure is never retried as a DOM race',async()=>{
 const {f}=await prepared(),update=f.core.updateBundle.bind(f.core);let attempts=0;
 f.core.updateBundle=(expected,work,options)=>{if(options?.domFinalize){attempts++;throw Error('STORE_UNCONFIRMED');}return update(expected,work,options);};
 await assert.rejects(f.core.tick(),{message:'STORE_UNCONFIRMED'});
 assert.equal(attempts,1);assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('continuous legitimate plan races stop after the existing bounded replan budget',async()=>{
 const {f,plan}=await prepared(),frame=f.core.p1.frame.bind(f.core.p1);let attempts=0,busy=false;
 f.core.p1.frame=async b=>{const result=await frame(b);if(!busy){busy=true;try{await plan(3+attempts++);}finally{busy=false;}}return result;};
 await assert.rejects(f.core.tick(),{message:'STALE_AGGREGATE'});
 assert.equal(attempts,3);assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('ordinary observation writers retain strict generation-changed rejection',async()=>{
 const {f,plan}=await prepared(),old=await f.core.bundle();await plan(3);let called=false;
 await assert.rejects(f.core.updateBundle(old,()=>{called=true;}),{message:'GENERATION_CHANGED'});
 assert.equal(called,false);
});

test('a new DOM plan at QUERY admission defers the read without issuing a command or committing UNKNOWN',async()=>{
 const {f,actor,plan}=await prepared(false),issue=f.core.registry.issue.bind(f.core.registry);let injected=false;
 f.core.registry.proofs.clear();
 const before=(await f.core.registry.rows()).filter(r=>r.record_kind==='A1_OPERATION').length;
 f.core.registry.issue=async(b,m,options)=>{if(m.payload.operation==='QUERY'&&!injected){injected=true;await plan(2,false);}return issue(b,m,options);};
 await f.core.tick();const selected=await f.core.bundle();assert.equal(injected,true);
 assert.equal(selected.a.session_status,'EFFECT_VERIFYING');assert.deepEqual(selected.a.diagnostic_codes,[]);
 assert.equal((await f.core.registry.rows()).filter(r=>r.record_kind==='A1_OPERATION').length,before);
 await actor.checkpoint();await f.core.tick();assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});

test('a DOM plan after QUERY issue but before delivery defers the never-begun command',async()=>{
 const {f,actor,plan}=await prepared(false),send=f.chrome.tabs.sendMessage;let injected=false,queryId;
 f.core.registry.proofs.clear();
 f.chrome.tabs.sendMessage=async(tab,m,options)=>{
  if(m.payload?.operation==='QUERY'&&!injected){injected=true;queryId=m.payload.operation_id;await plan(2,false);}
  return send(tab,m,options);
 };
 await f.core.tick();const result=await f.core.bundle();
 assert.equal(injected,true);assert.equal(result.a.session_status,'EFFECT_VERIFYING');
 assert.deepEqual(result.a.diagnostic_codes,[]);
 const query=(await f.core.registry.rows()).find(r=>r.record_kind==='A1_OPERATION'&&r.operation_id===queryId);
 assert.equal(query.phase,'ISSUED');
 assert.equal(query.first_response,null);
 await actor.checkpoint();await f.core.tick();assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});

for(const variant of ['BEGIN already recorded','changed request','missing plan receipt','changed owner fence','expired DOM window','changed native URL'])test('DOM QUERY deferral refuses '+variant,async()=>{
 const {f,plan}=await prepared(false),original=await f.core.bundle(),b=original.bindings[0],m=control(b,original.a,'QUERY');
 await f.core.registry.issue(b,m);await plan(2,false);
 assert.equal(await f.core.domQuerySupersededBeforeBegin(b,original.a,m),true);
 if(variant==='changed request')m.request_id=crypto.randomUUID();
 else if(variant==='changed native URL')f.frames[0].url='https://www.youtube.com/shorts/different';
 else await f.core.registry.update((rows,tx)=>{
  if(variant==='BEGIN already recorded'){const op=rows.find(x=>x.operation_id===m.payload.operation_id);op.phase='IN_FLIGHT';tx.objectStore('metadata').put(op);}
  if(variant==='missing plan receipt'){const a=rows.find(x=>x.key===original.a.key),g=a.effect_transition.grants[0];tx.objectStore('metadata').delete('a1:receipt:'+b.scope.binding_id+':'+g.plan_write_id);}
  if(variant==='changed owner fence'){const fence=rows.find(x=>x.key==='a1:owner-fence');fence.epoch=crypto.randomUUID();tx.objectStore('metadata').put(fence);}
  if(variant==='expired DOM window'){const a=rows.find(x=>x.key===original.a.key);a.effect_transition.deadline_at=Date.now()-1;tx.objectStore('metadata').put(a);}
 });
 if(variant==='expired DOM window')await assert.rejects(f.core.domQuerySupersededBeforeBegin(b,original.a,m),{message:'REVALIDATION_REQUIRED'});
 else assert.equal(await f.core.domQuerySupersededBeforeBegin(b,original.a,m),false);
});

test('existing explicit Core END preserves sender failure evidence and restores a failed DOM query session',async()=>{
 const {f,plan}=await prepared(false),send=f.chrome.tabs.sendMessage;let injected=false;
 // Reproduce the deployed pre-fix failure, without inventing a successful QUERY.
 f.core.domQuerySupersededBeforeBegin=async()=>false;f.core.registry.proofs.clear();
 f.chrome.tabs.sendMessage=async(tab,m,options)=>{
  if(m.payload?.operation==='QUERY'&&!injected){injected=true;await plan(2,false);}
  return send(tab,m,options);
 };
 await assert.rejects(f.core.tick(),{message:'UNAUTHORIZED_SENDER'});
 const failed=await f.core.bundle();assert.equal(failed.a.session_status,'UNKNOWN');
 const codes=structuredClone(failed.a.diagnostic_codes),first=structuredClone(failed.a.nr_first_failure);
 await f.core.end(f.command.session_id);
 const after=await f.core.bundle();assert.equal(after.a.session_status,'ENDED');
 assert.deepEqual(after.a.diagnostic_codes,codes);assert.deepEqual(after.a.nr_first_failure,first);
 assert.equal(after.state.journal.observed,'RELEASED');assert.equal(f.rules().length,0);
 assert.equal(after.bindings.some(b=>b.resolution==='NONE'||b.cleanup_pending),false);
});

for(const reachable of [true,false])test('explicit END with missing DNR '+(reachable?'still requires verified DOM restoration':'preserves unreachable DOM debt'),async()=>{
 const {f,plan}=await prepared(false,{blockedSite:true}),send=f.chrome.tabs.sendMessage;let injected=false;
 f.core.domQuerySupersededBeforeBegin=async()=>false;f.core.registry.proofs.clear();
 f.chrome.tabs.sendMessage=async(tab,m,options)=>{
  if(m.payload?.operation==='QUERY'&&!injected){injected=true;await plan(2,false);}
  return send(tab,m,options);
 };
 await assert.rejects(f.core.tick(),{message:'UNAUTHORIZED_SENDER'});
 const before=await f.core.bundle();assert(before.state.journal.rules.length>0);
 await f.chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:f.rules().map(r=>r.id)});
 if(!reachable)f.frames[0].documentLifecycle='cached';
 await f.core.end(f.command.session_id);
 const after=await f.core.bundle();assert.deepEqual(after.a.nr_first_failure,before.a.nr_first_failure);
 if(reachable){assert.equal(after.a.session_status,'ENDED');assert.equal(after.state.journal.observed,'RELEASED');assert.equal(after.bindings.some(b=>b.resolution==='NONE'||b.cleanup_pending),false);}
 else {assert.notEqual(after.a.session_status,'ENDED');assert(after.bindings.some(b=>b.resolution==='NONE'&&b.cleanup_pending));assert.notEqual(after.state.journal.observed,'RELEASED');}
 assert.equal(f.rules().length,0,'END must never re-APPLY the missing rules');
});
