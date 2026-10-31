import test from 'node:test';
import assert from 'node:assert/strict';
import { locks } from 'node:worker_threads';
import { IDBFactory } from 'fake-indexeddb';
import { createMemberDB } from '../member-a1/db.mjs';
import { digest } from '../a1/contract.mjs';
import { AdditionalDnrStore } from '../src/additional-dnr-store.js';
import { AdditionalDnrCoordinator } from '../src/additional-dnr-coordinator.js';
import { SiteTimeDnrEvidence } from '../src/additional-dnr-site-time-evidence.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rule=(n=100000)=>({id:n,priority:1,action:{type:'block'},condition:{urlFilter:'||example.test^'}});
const key='amvp_journal_v1:site-time-dnr-evidence';
async function harness(options={}){
 const base=createMemberDB(new IDBFactory(),'site-time-evidence');let abortWhen=()=>false;
 const db={transaction(mode,work){return base.transaction(mode,(tx,done)=>work(tx,result=>{if(abortWhen(mode,result))tx.abort();else done(result);}));}};
 const banks={SESSION:[],DYNAMIC:[]},calls=[],dnr={};
 for(const [bank,suffix] of [['SESSION','Session'],['DYNAMIC','Dynamic']]){
  dnr[`get${suffix}Rules`]=async()=>structuredClone(banks[bank]);
  dnr[`update${suffix}Rules`]=async({removeRuleIds})=>{calls.push({bank,removeRuleIds});banks[bank]=banks[bank].filter(r=>!removeRuleIds.includes(r.id));};
 }
 const store=new AdditionalDnrStore(db);
 // SYNTHETIC writer coverage and issued policy authority; no product provider.
 const args={store,dnr,locks,assertWritersGuarded:()=>true,verifyAdoption:()=>true};
 const coordinator=new AdditionalDnrCoordinator(args),epoch=await coordinator.startWriter();
 const service=new SiteTimeDnrEvidence({coordinator,verifyBinding:()=>true,...options});
 const context={operation_id:id(10),owner_binding_id:id(2),executor_id:id(3),runtime_execution_id:id(4),package_id:id(5),runtime_revision:1,generation:1};
 const policy={kind:'SITE_TIME',policy_id:id(6),version:1,site_id:null,scope:{host:'example.test',include_subdomains:true},enabled:true,tracking_scope:'BROWSER_ALWAYS',daily_limit_ms:60000,windows:[]};
 const makeClaim=async(bank='SESSION',number=100000,claimId=20,owner=2)=>({claim_id:id(claimId),owner_binding_id:id(owner),generation:1,writer_epoch:epoch,rule_key:{rule_store:bank,rule_id:number},rule_sha256:await digest(rule(number)),restore_state:'APPLIED'});
 const claims=[await makeClaim()],input={context,policy,claims};
 const adopt=async(claim=claims[0])=>{const r=rule(claim.rule_key.rule_id);if(!banks[claim.rule_key.rule_store].some(x=>x.id===r.id))banks[claim.rule_key.rule_store].push(r);return coordinator.adopt(epoch,claim,r);};
 const release=()=>coordinator.releaseOwner(epoch,{operationId:id(30),ownerBindingId:id(2),generation:1});
 const dump=()=>db.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').getAll();r.onsuccess=()=>done(r.result);});
 return {db,store,coordinator,args,epoch,service,banks,calls,context,policy,claims,input,makeClaim,adopt,release,dump,fault:f=>{abortWhen=f;}};
}
test('pre-effect registration is neither installation nor ownership',async()=>{
 const h=await harness();await h.service.register(h.input);const r=await h.service.read(h.context);
 assert.equal(r.registration.claims[0].registered,false);assert.equal(r.current.claims[0].comparison,'MISSING');
 assert.equal(r.current.claims[0].live_footprint_matches,false);assert.equal(r.current.claims[0].release_footprint_verified,false);
 assert.deepEqual((await h.store.read()).claims,[]);assert.equal(h.calls.length,0);assert.equal(r.runtime_report,false);
});
test('post-effect read binds original policy/version/operation and does not write',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();const before=await h.dump(),r=await h.service.read(h.context);
 assert.equal(r.policy_id,h.policy.policy_id);assert.equal(r.policy_version,1);assert.equal(r.context.operation_id,h.context.operation_id);
 assert.equal(r.current.claims[0].live_footprint_matches,true);assert.equal(r.current.claims[0].cleanup_pending,true);
 assert.equal(r.registration.claims[0].comparison,'MISSING');assert.deepEqual(await h.dump(),before);assert.equal(h.calls.length,0);assert.ok(!JSON.stringify(r).includes('example.test'));
});
test('release needs existing durable receipt and actual absent footprint',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();await h.release();const r=await h.service.read(h.context);
 assert.equal(r.current.claims[0].release_footprint_verified,true);assert.equal(r.current.claims[0].cleanup_pending,false);
 assert.equal(r.current.operations[0].operation_id,id(30));assert.equal(r.current.operations[0].state,'RELEASED');assert.equal(h.calls.length,1);
});
test('another owner keeps shared rule while only own cleanup is verified',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();await h.adopt(await h.makeClaim('SESSION',100000,21,7));await h.release();
 const r=await h.service.read(h.context);assert.equal(r.current.claims[0].release_footprint_verified,true);assert.equal(r.current.claims[0].comparison,'MATCH');
 assert.deepEqual(r.current.claims[0].other_live_claim_ids,[id(21)]);assert.equal(h.banks.SESSION.length,1);assert.equal(h.calls.length,0);
});
test('unregistered matching rule never becomes application or ownership proof',async()=>{
 const h=await harness();h.banks.SESSION.push(rule());await h.service.register(h.input);const r=await h.service.read(h.context);
 assert.equal(r.current.claims[0].comparison,'MATCH');assert.equal(r.current.claims[0].registered,false);assert.equal(r.current.claims[0].live_footprint_matches,false);
 assert.equal(r.current.unmanaged_rule_keys.length,1);assert.deepEqual((await h.store.read()).claims,[]);
});
test('missing or altered live rule keeps cleanup unconfirmed',async()=>{
 for(const altered of [false,true]){const h=await harness();await h.service.register(h.input);await h.adopt();if(altered)h.banks.SESSION[0].priority=9;else h.banks.SESSION=[];
  const c=(await h.service.read(h.context)).current.claims[0];assert.equal(c.live_footprint_matches,false);assert.equal(c.release_footprint_verified,false);assert.equal(c.cleanup_pending,true);assert.equal(h.calls.length,0);}
});
test('either store read failure is UNKNOWN, never successful empty rules',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();h.coordinator.dnr.getDynamicRules=async()=>{throw Error('secret URL https://private.test');};
 const r=await h.service.read(h.context);assert.equal(r.current.stores.DYNAMIC.status,'UNKNOWN');assert.equal(r.current.claims[0].live_footprint_matches,false);assert.equal(r.current.claims[0].cleanup_pending,true);assert.ok(!JSON.stringify(r).includes('private.test'));
});
test('resolved removal promise without actual removal is not release proof',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();h.coordinator.dnr.updateSessionRules=async()=>{};
 await assert.rejects(h.release(),/DNR_RELEASE_UNCONFIRMED/);const r=await h.service.read(h.context);
 assert.equal(r.current.operations[0].state,'IN_DOUBT');assert.equal(r.current.claims[0].release_footprint_verified,false);assert.equal(r.current.claims[0].cleanup_pending,true);
});
test('partial two-store cleanup and new writer preserve registration and obligations',async()=>{
 const h=await harness();h.claims.push(await h.makeClaim('DYNAMIC',100001,22));await h.service.register(h.input);for(const c of h.claims)await h.adopt(c);
 const update=h.coordinator.dnr.updateDynamicRules;h.coordinator.dnr.updateDynamicRules=async()=>{throw Error('API failure');};await assert.rejects(h.release(),/API failure/);
 const r=await h.service.read(h.context);assert.deepEqual(r.current.claims.map(c=>c.comparison),['MISSING','MATCH']);assert.ok(r.current.claims.every(c=>c.cleanup_pending&&!c.release_footprint_verified));
 h.coordinator.dnr.updateDynamicRules=update;const next=new AdditionalDnrCoordinator(h.args),epoch=await next.startWriter();
 await next.releaseOwner(epoch,{operationId:id(30),ownerBindingId:id(2),generation:1});
 const reader=new SiteTimeDnrEvidence({coordinator:next,verifyBinding:()=>true}),final=await reader.read(h.context);
 assert.deepEqual(final.registration,r.registration);assert.ok(final.current.claims.every(c=>c.release_footprint_verified));assert.equal(h.calls.length,2);
});
test('effect without durable receipt stays pending after store reopening',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();h.fault((mode,result)=>mode==='readwrite'&&result==='RELEASED');
 await assert.rejects(h.release(),/DNR_STORAGE_UNCONFIRMED/);h.fault(()=>false);
 const next=new AdditionalDnrCoordinator({...h.args,store:new AdditionalDnrStore(h.db)}),reader=new SiteTimeDnrEvidence({coordinator:next,verifyBinding:()=>true});
 const r=await reader.read(h.context);assert.equal(r.current.claims[0].comparison,'MISSING');assert.equal(r.current.claims[0].release_footprint_verified,false);assert.equal(r.current.claims[0].cleanup_pending,true);
 const epoch=await next.startWriter();await next.releaseOwner(epoch,{operationId:id(30),ownerBindingId:id(2),generation:1});assert.equal((await reader.read(h.context)).current.claims[0].release_footprint_verified,true);
});
test('reappearing unowned rule invalidates present release verification without rewriting receipt',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();await h.release();h.banks.SESSION.push(rule());const before=await h.dump();
 const r=await h.service.read(h.context);assert.equal(r.current.claims[0].release_footprint_verified,false);assert.equal(r.current.claims[0].cleanup_pending,true);assert.deepEqual(await h.dump(),before);
});
test('operation identity is immutable and policy version cannot change its body',async()=>{
 const h=await harness();await h.service.register(h.input);assert.equal((await h.service.register(h.input)).duplicate,true);
 await assert.rejects(h.service.register({...h.input,context:{...h.context,package_id:id(50)}}),/SITE_TIME_OPERATION_CONFLICT/);
 await assert.rejects(h.service.register({...h.input,context:{...h.context,operation_id:id(51)},policy:{...h.policy,daily_limit_ms:120000}}),/SITE_TIME_POLICY_VERSION_CONFLICT/);
});
test('read requires exact owner/executor/execution/package/revision/generation context',async()=>{
 const h=await harness();await h.service.register(h.input);
 for(const field of ['owner_binding_id','executor_id','runtime_execution_id','package_id'])await assert.rejects(h.service.read({...h.context,[field]:id(90)}),/SITE_TIME_CONTEXT_MISMATCH/);
 for(const field of ['runtime_revision','generation'])await assert.rejects(h.service.read({...h.context,[field]:2}),/SITE_TIME_CONTEXT_MISMATCH/);
 await assert.rejects(h.service.read({...h.context,operation_id:id(90)}),/SITE_TIME_EVIDENCE_NOT_FOUND/);
});
test('policy authority and writer coverage are denied by default',async()=>{
 const h=await harness(),closed=new SiteTimeDnrEvidence({coordinator:h.coordinator});await assert.rejects(closed.register(h.input),/SITE_TIME_BINDING_UNVERIFIED/);
 h.service.verifyBinding=()=>({authorized:true});await assert.rejects(h.service.register(h.input),/SITE_TIME_BINDING_UNVERIFIED/);
 h.service.verifyBinding=()=>true;await h.service.register(h.input);h.service.verifyBinding=()=>false;await assert.rejects(h.service.read(h.context),/SITE_TIME_BINDING_UNVERIFIED/);
 h.coordinator.assertWritersGuarded=()=>false;await assert.rejects(h.service.read(h.context),/LEGACY_WRITER_NOT_FENCED/);assert.equal(h.calls.length,0);
});
test('capacity never evicts unresolved entries and exact retry remains possible',async()=>{
 const h=await harness({capacity:1});await h.service.register(h.input);await h.adopt();await assert.rejects(h.service.register({...h.input,context:{...h.context,operation_id:id(55)}}),/SITE_TIME_EVIDENCE_CAPACITY/);
 assert.equal((await h.service.register(h.input)).duplicate,true);assert.equal((await h.service.read(h.context)).current.claims[0].cleanup_pending,true);
});
test('failed evidence transaction cannot install rules or erase DNR registry',async()=>{
 const h=await harness();await h.adopt();const before=await h.store.read();h.fault((mode,result)=>mode==='readwrite'&&result?.duplicate===false);
 await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STORAGE_UNCONFIRMED/);h.fault(()=>false);
 assert.deepEqual(await h.store.read(),before);assert.equal(h.banks.SESSION.length,1);await assert.rejects(h.service.read(h.context),/SITE_TIME_EVIDENCE_NOT_FOUND/);
});
test('persisted intent corruption fails closed without issuing cleanup',async()=>{
 const h=await harness();await h.service.register(h.input);await h.db.transaction('readwrite',(tx,done)=>{const m=tx.objectStore('metadata'),r=m.get(key);r.onsuccess=()=>{r.result.entries[0].intent.policy.daily_limit_ms=120000;m.put(r.result);done(null);};});
 await assert.rejects(h.service.read(h.context),/SITE_TIME_EVIDENCE_HASH_MISMATCH/);assert.equal(h.calls.length,0);
});
test('writer bypassing lock during observation cannot return stable journal evidence',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();const original=h.coordinator.dnr.getSessionRules;let once=true;
 h.coordinator.dnr.getSessionRules=async()=>{if(once){once=false;await h.store.mutate(s=>++s.writer_epoch);}return original();};
 await assert.rejects(h.service.read(h.context),/SITE_TIME_EVIDENCE_STATE_CHANGED/);assert.equal(h.calls.length,0);
});
test('input and verifier mutation cannot retarget a queued registration',async()=>{
 const h=await harness();h.service.verifyBinding=copy=>{copy.context.operation_id=id(66);copy.policy.version=99;return true;};
 const original=structuredClone(h.context),pending=h.service.register(h.input);h.context.operation_id=id(77);h.policy.version=22;await pending;
 const r=await h.service.read(original);assert.equal(r.context.operation_id,original.operation_id);assert.equal(r.policy_version,1);
});
test('a RELEASED label with wrong release semantic hash cannot discharge an obligation',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();await h.release();
 await h.store.mutate(s=>{s.operations[0].hash='0'.repeat(64);});
 const r=await h.service.read(h.context);assert.equal(r.current.operations[0].scope_verified,false);assert.equal(r.current.claims[0].release_footprint_verified,false);assert.equal(r.current.claims[0].cleanup_pending,true);
});
test('equal rule IDs in SESSION and DYNAMIC are independent physical footprints',async()=>{
 const h=await harness();h.claims.push(await h.makeClaim('DYNAMIC',100000,22));await h.service.register(h.input);for(const c of h.claims)await h.adopt(c);h.banks.DYNAMIC[0].priority=8;
 const r=await h.service.read(h.context);assert.deepEqual(r.current.claims.map(c=>c.comparison),['MATCH','MISMATCH']);assert.deepEqual(r.current.claims.map(c=>c.live_footprint_matches),[true,false]);
});
test('malformed policy or claim owner is rejected before any durable binding',async()=>{
 const h=await harness();await assert.rejects(async()=>h.service.register({...h.input,policy:{...h.policy,kind:'CONTENT'}}),/INVALID_SITE_TIME_BINDING/);
 await assert.rejects(async()=>h.service.register({...h.input,claims:[{...h.claims[0],owner_binding_id:id(80)}]}),/SITE_TIME_CLAIM_SCOPE_MISMATCH/);
 assert.equal(h.calls.length,0);await assert.rejects(h.service.read(h.context),/SITE_TIME_EVIDENCE_NOT_FOUND/);
});
test('stale claim epoch cannot register an operation under a newer writer',async()=>{
 const h=await harness();await h.coordinator.startWriter();await assert.rejects(h.service.register(h.input),/STALE_DNR_WRITER/);await assert.rejects(h.service.read(h.context),/SITE_TIME_EVIDENCE_NOT_FOUND/);
});
test('read storage failure cannot become an empty successful evidence response',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();h.fault(mode=>mode==='readonly');await assert.rejects(h.service.read(h.context),/SITE_TIME_EVIDENCE_STORAGE_UNCONFIRMED/);h.fault(()=>false);assert.equal((await h.service.read(h.context)).current.claims[0].cleanup_pending,true);
});
test('changed registry claim scope cannot be reused as proof for its old policy context',async()=>{
 const h=await harness();await h.service.register(h.input);await h.adopt();await h.store.mutate(s=>{s.claims[0].generation=2;});
 const r=await h.service.read(h.context);assert.equal(r.current.claims[0].identity_matches,false);assert.equal(r.current.claims[0].live_footprint_matches,false);assert.equal(r.current.claims[0].cleanup_pending,true);
});
