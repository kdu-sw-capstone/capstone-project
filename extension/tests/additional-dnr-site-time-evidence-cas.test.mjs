import test from 'node:test';
import assert from 'node:assert/strict';
import {locks} from 'node:worker_threads';
import {IDBFactory} from 'fake-indexeddb';
import {createMemberDB} from '../member-a1/db.mjs';
import {digest} from '../a1/contract.mjs';
import {AdditionalDnrStore} from '../src/additional-dnr-store.js';
import {AdditionalDnrCoordinator} from '../src/additional-dnr-coordinator.js';
import {SiteTimeDnrEvidence} from '../src/additional-dnr-site-time-evidence.js';

const KEY='amvp_journal_v1:site-time-dnr-evidence';
const id=()=>crypto.randomUUID();
async function fixture(){
  const base=createMemberDB(new IDBFactory(),id());let beforeWrite=null,failNextRead=false;
  const db={async transaction(mode,work){
    if(mode==='readonly'&&failNextRead){failNextRead=false;return base.transaction(mode,tx=>tx.abort());}
    if(mode==='readwrite'&&beforeWrite){const change=beforeWrite;beforeWrite=null;await change();}
    return base.transaction(mode,work);
  }};
  let writes=0;
  const dnr={getSessionRules:async()=>[],getDynamicRules:async()=>[],
    updateSessionRules:async()=>{writes++;},updateDynamicRules:async()=>{writes++;}};
  const store=new AdditionalDnrStore(db),rawStore=new AdditionalDnrStore(base);
  // SYNTHETIC issued policy verifier and writer coverage; no product authority.
  const coordinator=new AdditionalDnrCoordinator({store,dnr,locks,assertWritersGuarded:()=>true});
  const epoch=await coordinator.startWriter();
  const context={operation_id:id(),owner_binding_id:id(),executor_id:id(),runtime_execution_id:id(),package_id:id(),runtime_revision:1,generation:1};
  const policy={kind:'SITE_TIME',policy_id:id(),version:1,site_id:null,scope:{host:'example.org',include_subdomains:true},enabled:true,tracking_scope:'BROWSER_ALWAYS',daily_limit_ms:60000,windows:[]};
  const claims=[{claim_id:id(),owner_binding_id:context.owner_binding_id,generation:1,writer_epoch:epoch,
    rule_key:{rule_store:'SESSION',rule_id:100000},rule_sha256:await digest({rule:'SYNTHETIC'}),restore_state:'RESERVED'}];
  const service=new SiteTimeDnrEvidence({coordinator,verifyBinding:()=>true}),input={context,policy,claims};
  const read=()=>base.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get(KEY);r.onsuccess=()=>done(r.result??null);});
  const put=state=>base.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(state);done();});
  const second=()=>({...structuredClone(input),context:{...context,operation_id:id()}});
  return {base,db,store,rawStore,coordinator,service,input,context,read,put,second,writes:()=>writes,
    beforeWrite:change=>{beforeWrite=change;},failNextRead:()=>{failNextRead=true;}};
}
async function rewritePolicy(h){
  const state=await h.read(),entry=state.entries[0];entry.intent.policy.daily_limit_ms=120000;
  entry.intent_sha256=await digest(entry.intent);const {entry_sha256,...payload}=entry;
  entry.entry_sha256=await digest(payload);await h.put(state);return state;
}

test('same-length evidence rewrite after validation cannot publish conflicting same-version policy',async()=>{
  const h=await fixture();await h.service.register(h.input);let changed;
  h.beforeWrite(async()=>{changed=await rewritePolicy(h);});
  await assert.rejects(h.service.register(h.second()),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  assert.deepEqual(await h.read(),changed);assert.equal(h.writes(),0);
});
test('DNR journal change after observation cannot commit a registration for the old snapshot',async()=>{
  const h=await fixture();const original=await h.store.read();let changed;
  h.beforeWrite(async()=>{await h.rawStore.mutate(s=>{s.writer_epoch++;});changed=await h.rawStore.read();});
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  assert.equal(await h.read(),null);assert.deepEqual(await h.rawStore.read(),changed);
  assert.equal(changed.writer_epoch,original.writer_epoch+1);assert.equal(h.writes(),0);
});
test('duplicate cannot claim durable registration when its entry changes after hash validation',async()=>{
  const h=await fixture();await h.service.register(h.input);let changed;
  const original=h.service.checkedEntry.bind(h.service);
  h.service.checkedEntry=async entry=>{const result=await original(entry);changed=await rewritePolicy(h);return result;};
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  assert.deepEqual(await h.read(),changed);assert.equal(h.writes(),0);
});

test('same-epoch DNR cleanup obligation change cannot be attached to an old registration snapshot',async()=>{
  const h=await fixture();let changed;
  h.beforeWrite(async()=>{
    await h.rawStore.mutate(s=>{s.claims.push({...h.input.claims[0],restore_state:'APPLIED'});});
    changed=await h.rawStore.read();
  });
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  assert.deepEqual(await h.rawStore.read(),changed);assert.equal(changed.claims[0].restore_state,'APPLIED');
  assert.equal(await h.read(),null);assert.equal(h.writes(),0);
});
test('missing DNR metadata cannot be reconstructed as registration success',async()=>{
  const h=await fixture();
  h.beforeWrite(()=>h.base.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').delete('amvp_journal_v1:dnr');done();}));
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  assert.equal(await h.read(),null);assert.equal((await h.rawStore.read()).writer_epoch,0);assert.equal(h.writes(),0);
});
test('exact historical retry stays valid after a new writer epoch without overwriting registration',async()=>{
  const h=await fixture();await h.service.register(h.input);const before=await h.read();
  await h.coordinator.startWriter();const root=await h.rawStore.read();
  assert.equal((await h.service.register(h.input)).duplicate,true);
  assert.deepEqual(await h.read(),before);assert.deepEqual(await h.rawStore.read(),root);assert.equal(h.writes(),0);
});
test('after CAS conflict caller must re-read and validate a new writer before retry',async()=>{
  const h=await fixture();h.beforeWrite(()=>h.rawStore.mutate(s=>{s.writer_epoch++;}));
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  await assert.rejects(h.service.register(h.input),/STALE_DNR_WRITER/);
  const next=structuredClone(h.input);next.claims[0].writer_epoch=(await h.rawStore.read()).writer_epoch;
  assert.equal((await h.service.register(next)).duplicate,false);assert.equal((await h.read()).entries.length,1);assert.equal(h.writes(),0);
});
test('same-version policy conflict after an aborted registration remains explicit on retry',async()=>{
  const h=await fixture();await h.service.register(h.input);const next=h.second();
  h.beforeWrite(()=>rewritePolicy(h));
  await assert.rejects(h.service.register(next),/SITE_TIME_EVIDENCE_STATE_CHANGED/);const before=await h.read();
  await assert.rejects(h.service.register(next),/SITE_TIME_POLICY_VERSION_CONFLICT/);
  assert.deepEqual(await h.read(),before);assert.equal(before.entries.length,1);
});
test('entry removal while checking duplicate cannot return a stale durable acknowledgment',async()=>{
  const h=await fixture();await h.service.register(h.input);
  const original=h.service.checkedEntry.bind(h.service);
  h.service.checkedEntry=async entry=>{const result=await original(entry);const state=await h.read();state.entries=[];await h.put(state);return result;};
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STATE_CHANGED/);
  assert.deepEqual((await h.read()).entries,[]);assert.equal(h.writes(),0);
});
test('metadata property order alone is not a semantic state conflict',async()=>{
  const h=await fixture();await h.service.register(h.input);
  h.beforeWrite(async()=>{const state=await h.read();await h.put({entries:state.entries,version:state.version,key:state.key});});
  assert.equal((await h.service.register(h.second())).duplicate,false);assert.equal((await h.read()).entries.length,2);
});
test('unrelated metadata remains intact and does not falsely conflict with registration',async()=>{
  const h=await fixture();
  h.beforeWrite(()=>h.base.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put({key:'unrelated-canary',value:'keep'});done();}));
  assert.equal((await h.service.register(h.input)).duplicate,false);
  const canary=await h.base.transaction('readonly',(tx,done)=>{const r=tx.objectStore('metadata').get('unrelated-canary');r.onsuccess=()=>done(r.result);});
  assert.equal(canary.value,'keep');assert.equal(h.writes(),0);
});
test('read-only duplicate storage abort is not a successful durable acknowledgment',async()=>{
  const h=await fixture();await h.service.register(h.input);const before=await h.read();
  const original=h.service.checkedEntry.bind(h.service);
  h.service.checkedEntry=async entry=>{
    const result=await original(entry);h.failNextRead();return result;
  };
  await assert.rejects(h.service.register(h.input),/SITE_TIME_EVIDENCE_STORAGE_UNCONFIRMED/);
  assert.deepEqual(await h.read(),before);assert.equal(h.writes(),0);
});
