import test from 'node:test';
import assert from 'node:assert/strict';
import { locks } from 'node:worker_threads';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createMemberDB } from '../member-a1/db.mjs';
import { AdditionalDnrStore } from '../src/additional-dnr-store.js';
import { LegacyDnrWriter,installMemberDnrWriter,LEGACY_DNR_REGISTRY_DB } from '../src/additional-dnr-legacy-writer.js';
import { buildDnrWriter } from '../scripts/build-dnr-writer.mjs';
import { fixture } from './member-fixture.mjs';
const id=()=>crypto.randomUUID();
async function harness(dnr){
 const db=createMemberDB(new IDBFactory(),'writer-test'),store=new AdditionalDnrStore(db),calls=[];
 dnr??={updateSessionRules:async r=>{calls.push(structuredClone(r));},updateDynamicRules:async r=>{calls.push(structuredClone(r));}};
 const writer=new LegacyDnrWriter({store,dnr,locks});
 const protect=async(ruleId=100000,bank='SESSION',state='APPLIED')=>store.mutate(s=>{s.writer_epoch=2;s.claims.push({claim_id:id(),owner_binding_id:id(),generation:1,writer_epoch:1,rule_key:{rule_store:bank,rule_id:ruleId},rule_sha256:'a'.repeat(64),restore_state:state});});
 return {db,store,writer,calls,protect};
}
test('legacy unclaimed writes pass through shared gate without changing registry',async()=>{
 const h=await harness(),before=await h.store.read(),request={removeRuleIds:[12]};
 await h.writer.write('SESSION',request,send=>send());assert.deepEqual(h.calls,[request]);assert.deepEqual(await h.store.read(),before);
});
test('every unresolved restore state protects IDs from add, remove and replacement',async()=>{
 for(const state of ['RESERVED','APPLIED','RELEASE_PENDING','UNCONFIRMED']){
  const h=await harness();await h.protect(12,'SESSION',state);
  for(const request of [{removeRuleIds:[12]},{addRules:[{id:12}]},{removeRuleIds:[12],addRules:[{id:12}]}])await assert.rejects(h.writer.write('SESSION',request,send=>send()),/DNR_RUNTIME_CLAIM_PROTECTED/);
  assert.equal(h.calls.length,0);assert.equal((await h.store.read()).claims[0].restore_state,state);
 }
});
test('equal IDs in another physical store do not block an unrelated legacy write',async()=>{
 const h=await harness();await h.protect(12,'DYNAMIC');await h.writer.write('SESSION',{removeRuleIds:[12]},send=>send());assert.equal(h.calls.length,1);assert.equal((await h.store.read()).claims[0].restore_state,'APPLIED');
});
test('queued writer rereads protected claims after acquiring the common lock',async()=>{
 const h=await harness();let release,entered;const gate=new Promise(r=>{release=r;});const held=new Promise(r=>{entered=r;});
 const existing=locks.request('focurve:amvp:dnr-writer',async()=>{entered();await gate;await h.protect(12);});await held;
 const request={removeRuleIds:[12]},pending=h.writer.write('SESSION',request,send=>send());request.removeRuleIds[0]=13;release();await existing;
 await assert.rejects(pending,/DNR_RUNTIME_CLAIM_PROTECTED/);assert.equal(h.calls.length,0);
});
test('unavailable lock or registry read cannot authorize a mutation',async()=>{
 const h=await harness();h.writer.locks=null;assert.throws(()=>h.writer.write('SESSION',{removeRuleIds:[12]},send=>send()),/DNR_WRITER_LOCK_UNAVAILABLE/);
 h.writer.locks=locks;h.writer.store={read:async()=>{throw Error('DNR_STORAGE_UNCONFIRMED');}};await assert.rejects(h.writer.write('SESSION',{removeRuleIds:[12]},send=>send()),/DNR_STORAGE_UNCONFIRMED/);assert.equal(h.calls.length,0);
});
test('actor refusal or missing dispatch never falls back to raw mutation',async()=>{
 const h=await harness();await assert.rejects(h.writer.write('SESSION',{removeRuleIds:[12]},()=>{throw Error('GENERATION_CHANGED');}),/GENERATION_CHANGED/);
 await assert.rejects(h.writer.write('SESSION',{removeRuleIds:[12]},()=>({})),/DNR_WRITE_NOT_DISPATCHED/);assert.equal(h.calls.length,0);
});
test('native API failure is preserved and does not rewrite cleanup state',async()=>{
 const failure=Error('native failure'),h=await harness({updateSessionRules:()=>Promise.reject(failure)}),before=await h.store.read();
 await assert.rejects(h.writer.write('SESSION',{removeRuleIds:[12]},send=>send()),e=>e===failure);assert.deepEqual(await h.store.read(),before);
});
test('only exact mutation shape reaches the actor preflight',async()=>{
 const h=await harness();for(const request of [{removeRuleIds:[0]},{removeRuleIds:[12,12]},{addRules:[{id:12},{id:12}]},{removeRuleIds:[12],bypass:true}])assert.throws(()=>h.writer.write('SESSION',request,send=>send()),/INVALID_LEGACY_DNR_WRITE/);assert.equal(h.calls.length,0);
});
test('guarded actual Member A1 APPLY and END preserve original effect/cleanup behavior',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);let guarded=0;
 f.env.dnrWriter=(r,send)=>{guarded++;return h.writer.write('SESSION',r,send);};
 await f.core.startCommand(f.command);assert.equal((await f.core.bundle()).a.session_status,'RUNNING');assert.ok(f.rules().length>0);
 await f.core.end(f.command.session_id);assert.equal((await f.core.bundle()).a.session_status,'ENDED');assert.equal(f.rules().length,0);assert.ok(guarded>=2);
});
test('protected runtime reservation blocks actual Member APPLY before native mutation',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);await h.protect(100000);f.env.dnrWriter=(r,send)=>h.writer.write('SESSION',r,send);
 await assert.rejects(f.core.startCommand(f.command),/DNR_RUNTIME_CLAIM_PROTECTED/);assert.equal(f.rules().length,0);assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');assert.equal((await h.store.read()).claims[0].restore_state,'APPLIED');
});
test('runtime-owned rule cannot be removed by actual Member END and obligations stay pending',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);f.env.dnrWriter=(r,send)=>h.writer.write('SESSION',r,send);
 await f.core.startCommand(f.command);const count=f.rules().length;await h.protect(f.rules()[0].id);
 await assert.rejects(f.core.end(f.command.session_id),/DNR_RUNTIME_CLAIM_PROTECTED/);const b=await f.core.bundle();assert.notEqual(b.a.session_status,'ENDED');assert.equal(b.a.cleanup_pending,true);assert.equal(f.rules().length,count);
});
test('APPLY deadline is checked again after waiting for writer lock',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);f.env.dnrWriter=(r,dispatch)=>{f.advance(120000);return h.writer.write('SESSION',r,dispatch);};
 await assert.rejects(f.core.startCommand(f.command),/MEMBER_ADMISSION_REJECTED/);assert.equal(f.rules().length,0);
});
test('END intent committed while queued cannot be overwritten by a delayed APPLY',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);let once=true;
 f.env.dnrWriter=async(r,dispatch)=>{if(once&&r.addRules){once=false;await f.core.endIntent(f.command.session_id,'TIME_LIMIT');}return h.writer.write('SESSION',r,dispatch);};
 await assert.rejects(f.core.startCommand(f.command),/GENERATION_CHANGED|END_WINS/);assert.equal(f.rules().length,0);assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');
});
test('scope change while queued prevents dispatch even when rule IDs still match',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);let once=true;
 f.env.dnrWriter=async(r,dispatch)=>{if(once&&r.addRules){once=false;await f.core.store.atomic((tx,done)=>{const m=tx.objectStore('metadata'),q=m.get('a1:owner-fence');q.onsuccess=()=>{q.result.epoch=id();m.put(q.result);done(null);};});}return h.writer.write('SESSION',r,dispatch);};
 await assert.rejects(f.core.startCommand(f.command),/GENERATION_CHANGED/);assert.equal(f.rules().length,0);
});
test('generated Worker installs immutable Member-only gate using the existing root DB',async()=>{
 const actual=readFileSync(new URL('../background/additional-dnr-writer.bundle.js',import.meta.url),'utf8');assert.equal(actual,buildDnrWriter());
 const h=await harness(),world=vm.createContext({chrome:{declarativeNetRequest:{updateSessionRules:async()=>{}}},indexedDB:new IDBFactory(),navigator:{locks},crypto,structuredClone});
 vm.runInContext(actual,world);assert.equal(world.FocurveMemberDnrWriter.registry_db,LEGACY_DNR_REGISTRY_DB);assert.equal(Object.getOwnPropertyDescriptor(world,'FocurveMemberDnrWriter').writable,false);
 const worker=readFileSync(new URL('../background/service-worker.js',import.meta.url),'utf8'),bootstrap=readFileSync(new URL('../integration/member-a1-bootstrap.js',import.meta.url),'utf8');
 assert.ok(worker.indexOf('additional-dnr-writer.bundle.js')<worker.indexOf('member-a1-bootstrap.js'));assert.ok(bootstrap.includes('dnrWriter:globalThis.FocurveMemberDnrWriter?.write'));
 assert.ok(bootstrap.includes('dnrAuthorityState=()=>FocurveMemberAuth.AuthStore.writeState()'));assert.ok(bootstrap.includes('MemberA1Factory({dnrAuthorityState,'));
 const noCoverage=world.FocurveMemberDnrWriter.assertWritersGuarded;assert.equal(noCoverage,undefined);assert.equal(h.calls.length,0);
});
test('actual Member suspend uses the same gate and keeps session recovery distinct from END',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);let writes=0;f.env.dnrWriter=(r,dispatch)=>{writes++;return h.writer.write('SESSION',r,dispatch);};
 await f.core.startCommand(f.command);await f.core.suspend();assert.equal(f.rules().length,0);assert.ok(writes>=2);assert.notEqual((await f.core.bundle()).a.session_status,'ENDED');
});
test('actual UNKNOWN missing-rule recovery also respects runtime reservations',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);
 await f.core.startCommand(f.command);await f.core.suspend();await h.protect(100000);
 await assert.rejects(f.core.tick(),/DNR_RUNTIME_CLAIM_PROTECTED/);assert.equal(f.rules().length,0);assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');
});
test('Chrome response wait does not keep the Core readonly transaction open or prevent END intent',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);await f.core.startCommand(f.command);
 const state=(await f.core.bundle()).state,original=f.chrome.declarativeNetRequest.updateSessionRules;let complete,entered;
 const waiting=new Promise(r=>{entered=r;});f.chrome.declarativeNetRequest.updateSessionRules=()=>{entered();return new Promise(r=>{complete=r;});};
 const mutation=f.core.guardedDnrUpdate(state,{removeRuleIds:state.journal.rules.map(r=>r.id)});await waiting;
 let timer;try{await Promise.race([f.core.endIntent(f.command.session_id,'TIME_LIMIT'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('DB_HELD_BY_CHROME')),1000);})]);}finally{clearTimeout(timer);complete();}
 await mutation;assert.equal((await f.core.bundle()).a.intent,'END');f.chrome.declarativeNetRequest.updateSessionRules=original;await f.core.finish();assert.equal((await f.core.bundle()).a.session_status,'ENDED');
});
test('caller mutation cannot make preflight validate a different removal than the dispatched request',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);await f.core.startCommand(f.command);
 const state=(await f.core.bundle()).state,owned=f.rules()[0].id,foreign=900000;
 await f.chrome.declarativeNetRequest.updateSessionRules({addRules:[{id:foreign,priority:1,action:{type:'block'},condition:{urlFilter:'||other.test^'}}]});
 const request={removeRuleIds:[foreign]};f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,send=>{request.removeRuleIds[0]=owned;return dispatch(send);});
 await assert.rejects(f.core.guardedDnrUpdate(state,request),/OWNER_MISMATCH/);assert.ok(f.rules().some(r=>r.id===foreign));assert.ok(f.rules().some(r=>r.id===owned));
});
test('shipped NR01/ND01/DP01 Member flags retain normal APPLY and END through the gate',async()=>{
 const f=await fixture({shortsDocumentGate:true,nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true}),h=await harness(f.chrome.declarativeNetRequest);
 Object.assign(f.command,{native_transition_contract:'NR01_1',document_transition_contract:'ND01_1',dom_transition_contract:'DP01_1'});f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);
 await f.core.startCommand(f.command);assert.equal((await f.core.bundle()).a.session_status,'RUNNING');await f.core.end(f.command.session_id);assert.equal((await f.core.bundle()).a.session_status,'ENDED');assert.equal(f.rules().length,0);
});
test('new Worker gate reopens canonical registry and preserves RootAuthority metadata',async()=>{
 const indexedDB=new IDBFactory(),calls=[],native={declarativeNetRequest:{updateSessionRules:async r=>calls.push(r)}};
 const first=installMemberDnrWriter(native,indexedDB,locks,{}),root={key:'member:root-authority',phase:'ACTIVE',owner_key:'MEMBER:1',session_id:id()};
 await first.store.db.transaction('readwrite',(tx,done)=>{tx.objectStore('metadata').put(root);done(null);});
 await first.store.mutate(s=>{s.writer_epoch=1;s.claims.push({claim_id:id(),owner_binding_id:id(),generation:1,writer_epoch:1,rule_key:{rule_store:'SESSION',rule_id:12},rule_sha256:'a'.repeat(64),restore_state:'UNCONFIRMED'});});
 const next=installMemberDnrWriter(native,indexedDB,locks,{});await assert.rejects(next.write({removeRuleIds:[12]},send=>send()),/DNR_RUNTIME_CLAIM_PROTECTED/);assert.equal(calls.length,0);
 const saved=await next.store.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').get(root.key);q.onsuccess=()=>done(q.result);});assert.deepEqual(saved,root);
});
test('existing native transition deadline is not bypassed by waiting for DNR lock',async()=>{
 const f=await fixture({shortsDocumentGate:true,nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true}),h=await harness(f.chrome.declarativeNetRequest);
 Object.assign(f.command,{native_transition_contract:'NR01_1',document_transition_contract:'ND01_1',dom_transition_contract:'DP01_1'});f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);
 await f.core.startCommand(f.command);await f.core.nrBegin(await f.core.bundle());const state=(await f.core.bundle()).state;let writes=0;
 const native=f.chrome.declarativeNetRequest.updateSessionRules;f.chrome.declarativeNetRequest.updateSessionRules=r=>{writes++;return native(r);};
 f.env.dnrWriter=(r,dispatch)=>{f.advance(6000);return h.writer.write('SESSION',r,dispatch);};
 await assert.rejects(f.core.guardedDnrUpdate(state,{addRules:state.journal.rules},true),/REVALIDATION_REQUIRED/);assert.equal(writes,0);
});

for(const change of ['owner','executor','unavailable'])test(`queued actual Member tick rejects current identity ${change} before missing-rule APPLY`,async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);
 f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);
 await f.core.startCommand(f.command);await f.core.suspend();assert.equal(f.rules().length,0);const before=await f.core.bundle();
 const identity=structuredClone(await f.env.owner()),original=f.env.owner;
 let unlock,held,queued;const release=new Promise(r=>{unlock=r;}),entered=new Promise(r=>{held=r;}),waiting=new Promise(r=>{queued=r;});
 const blocker=locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
 let writes=0;const native=f.chrome.declarativeNetRequest.updateSessionRules;
 f.chrome.declarativeNetRequest.updateSessionRules=r=>{writes++;return native(r);};
 f.env.dnrWriter=(r,dispatch)=>{queued();return h.writer.write('SESSION',r,dispatch);};
 const tick=f.core.tick();const rejected=assert.rejects(tick,/OWNER_MISMATCH|IDENTITY_UNAVAILABLE/);await waiting;
 f.env.owner=change==='unavailable'?async()=>{throw Error('IDENTITY_UNAVAILABLE');}:async()=>({...identity,...(change==='owner'?{owner_key:'MEMBER:2'}:{installation_id:id()})});
 unlock();await blocker;await rejected;
 assert.equal(writes,0);assert.equal(f.rules().length,0);
 f.env.owner=original;const b=await f.core.bundle();assert.notEqual(b.a.session_status,'RUNNING');assert.equal(b.a.cleanup_pending,before.a.cleanup_pending);assert.deepEqual(b.bindings,before.bindings);
});

test('queued exact old-owner removal remains available after current identity changes',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);
 f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);await f.core.startCommand(f.command);
 const state=(await f.core.bundle()).state,original=f.env.owner,identity=structuredClone(await original());
 let unlock,held,queued;const release=new Promise(r=>{unlock=r;}),entered=new Promise(r=>{held=r;}),waiting=new Promise(r=>{queued=r;});
 const blocker=locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
 f.env.dnrWriter=(r,dispatch)=>{queued();return h.writer.write('SESSION',r,dispatch);};
 const cleanup=f.core.guardedDnrUpdate(state,{removeRuleIds:state.journal.rules.map(r=>r.id)});await waiting;
 f.env.owner=async()=>({...identity,owner_key:'MEMBER:2'});unlock();await blocker;await cleanup;
 assert.equal(f.rules().length,0);f.env.owner=original;
 const b=await f.core.bundle();assert.notEqual(b.a.session_status,'ENDED');assert.equal(b.state.journal.observed,state.journal.observed);
});

function authFence(storage){
 const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../background/member-auth.js',import.meta.url),'utf8'),context);
 const Store=context.FocurveMemberAuth.AuthStore;return {state:()=>Store.writeState(),store:new Store({setAccessLevel:async()=>{},...storage})};
}

test('auth write starting after identity read fences final dispatch even when applying flag is omitted',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest),auth=authFence({set:async()=>{}});
 f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);f.env.dnrAuthorityState=auth.state;
 await f.core.startCommand(f.command);const state=(await f.core.bundle()).state,native=f.chrome.declarativeNetRequest.updateSessionRules;
 let writes=0,write;f.chrome.declarativeNetRequest.updateSessionRules=r=>{writes++;return native(r);};
 const db=f.env.db,transaction=db.transaction;let once=true;
 // Inject only at the final snapshot, after the locked actor's identity read.
 f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,send=>{
  f.env.db={...db,transaction:(mode,callback)=>transaction(mode,(tx,done)=>{if(once&&mode==='readonly'){once=false;write=auth.store.put({owner_user_id:'2'});}return callback(tx,done);})};
  return dispatch(send);
 });
 await assert.rejects(f.core.guardedDnrUpdate(state,{addRules:state.journal.rules}),/OWNER_MISMATCH/);await write;
 assert.equal(writes,0);assert.equal(auth.state().pending,false);f.env.db=db;
 await f.core.end(f.command.session_id);assert.equal(f.rules().length,0);
});

test('pending and failed auth writes block new effects without blocking exact cleanup',async()=>{
 const f=await fixture({shortsDocumentGate:true}),h=await harness(f.chrome.declarativeNetRequest);let finish,entered;
 const waiting=new Promise(r=>{entered=r;}),auth=authFence({set:()=>{entered();return new Promise((_,reject)=>{finish=()=>reject(Error('AUTH_SAVE_FAILED'));});}});
 f.env.dnrWriter=(r,dispatch)=>h.writer.write('SESSION',r,dispatch);f.env.dnrAuthorityState=auth.state;
 await f.core.startCommand(f.command);const state=(await f.core.bundle()).state;
 const saving=auth.store.put({owner_user_id:'2'}),failed=assert.rejects(saving,/AUTH_SAVE_FAILED/);await waiting;
 await assert.rejects(f.core.guardedDnrUpdate(state,{addRules:state.journal.rules},true),/OWNER_MISMATCH/);
 await f.core.guardedDnrUpdate(state,{removeRuleIds:state.journal.rules.map(r=>r.id)});assert.equal(f.rules().length,0);
 finish();await failed;assert.equal(auth.state().pending,false);
 await f.core.guardedDnrUpdate(state,{addRules:state.journal.rules},true);assert.ok(f.rules().length>0);
 await f.core.end(f.command.session_id);assert.equal(f.rules().length,0);
});

test('auth write fence covers concurrent AuthStore instances until every write settles',async()=>{
 const pending=[],auth=authFence({set:()=>new Promise(resolve=>pending.push(resolve))}),original=auth.state();
 const second=new auth.store.constructor(auth.store.storage),one=auth.store.put({owner_user_id:'1'}),two=second.put({owner_user_id:'2'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,2);assert.notEqual(auth.state(),original);assert.equal(auth.state().pending,true);
 pending[0]();await one;assert.equal(auth.state().pending,true);pending[1]();await two;assert.equal(auth.state().pending,false);assert.notEqual(auth.state(),original);
});
