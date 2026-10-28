import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fixture} from './member-fixture.mjs';
const world={TextEncoder};
vm.runInNewContext(await readFile(new URL('../safety/reader.js',import.meta.url),'utf8'),world);
async function running(){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 f.command.snapshot.sites.push({...structuredClone(f.command.snapshot.sites[0]),site_id:'2',canonical_host:'example.com',access_policy:'BLOCK',purpose:'DISTRACTION',feature_policies:[]});
 await f.core.startCommand(f.command);assert.equal(f.rules().length,1);return f;
}
const row=f=>f.core.store.read('member:first-failure:'+f.command.session_id);
const invalidate=f=>f.core.invalidate('BFCACHE',f.frames[0].tabId,f.frames[0].documentId);

test('Core.invalidate persists the original observation before UNKNOWN and a later STORE_UNCONFIRMED cannot replace it',async()=>{
 const f=await running(),before=await f.core.bundle(),rules=structuredClone(f.rules());
 await f.core.nrBegin(before);await invalidate(f);const first=await row(f),b=await f.core.bundle();
 assert.equal(first.diagnostic.code,'BFCACHE');assert.equal(first.diagnostic.stage,'CORE_INVALIDATE');
 assert.equal(first.request_id,before.state.session.start_request_id);assert.equal(first.authority_granted,false);
 assert.equal(f.core.firstFailurePersistence,'COMMIT_ACKNOWLEDGED');assert.equal(b.a.session_status,'UNKNOWN');
 assert.deepEqual(f.rules(),rules);assert.equal(b.state.journal.observed,'APPLIED');assert.equal(b.bindings.filter(x=>x.resolution==='NONE').length,1);
 await f.core.markUnknown('STORE_UNCONFIRMED');assert.deepEqual(await row(f),first);
});

test('a diagnostic write failure preserves UNKNOWN and the original binding/journal/DNR obligations',async()=>{
 const f=await running(),rules=structuredClone(f.rules());
 f.core.persistFirstFailure=async()=>{throw Error('INJECTED_WRITE_FAILURE');};await invalidate(f);
 assert.equal(f.core.firstFailurePersistence,'UNCONFIRMED');assert.equal(await row(f),null);
 const b=await f.core.bundle();assert.equal(b.a.session_status,'UNKNOWN');assert.deepEqual(f.rules(),rules);
 assert.equal(b.state.journal.desired,'APPLIED');assert.equal(b.bindings[0].resolution,'NONE');
});

test('lost diagnostic commit ACK is not reported as success; committed evidence survives Worker recreation',async()=>{
 const f=await running(),save=f.core.persistFirstFailure.bind(f.core);
 f.core.persistFirstFailure=async b=>{await save(b);throw Error('INJECTED_ACK_LOSS_AFTER_COMMIT');};
 await invalidate(f);assert.equal(f.core.firstFailurePersistence,'UNCONFIRMED');const first=await row(f);assert(first);
 const old=f.core,boot=old.boot;await f.restart();assert.notEqual(f.core,old);assert.notEqual(f.core.boot,boot);
 assert.equal(f.core.firstFailureDiagnostic,undefined);assert.deepEqual(await row(f),first);
 const b=await f.core.bundle(),observed=world.R2LocalSafety.projectStoredFirstFailure({metadata:[b.a,first],sessions:[b.state.session]},first.session_id,first.owner_key,first.executor_id);
 assert.equal(observed.status,'STORED_FIRST_FAILURE');assert.equal(observed.requestId,first.request_id);
});

test('a committed diagnostic with a non-returning acknowledgement cannot hold the UNKNOWN transition',async()=>{
 const f=await running(),save=f.core.persistFirstFailure.bind(f.core);let committed;
 const atCommit=new Promise(resolve=>committed=resolve);
 f.core.persistFirstFailure=async b=>{await save(b);committed();return new Promise(()=>{});};
 const transition=invalidate(f);await atCommit;
 const b=await f.core.bundle();assert.equal(b.a.session_status,'UNKNOWN');
 await transition;assert.notEqual(f.core.firstFailurePersistence,'COMMIT_ACKNOWLEDGED');assert(await row(f));
});

test('duplicate invalidations and subsequent errors preserve exactly the first diagnostic',async()=>{
 const f=await running();await invalidate(f);const first=await row(f);
 await invalidate(f);await f.core.markUnknown('OWNER_MISMATCH');assert.deepEqual(await row(f),first);
});

test('an existing UNKNOWN without evidence is never backfilled by invalidate',async()=>{
 const f=await running(),save=f.core.persistFirstFailure.bind(f.core);
 f.core.persistFirstFailure=async()=>false;await f.core.markUnknown('STORE_UNCONFIRMED');
 f.core.persistFirstFailure=save;await invalidate(f);assert.equal(await row(f),null);
});

test('foreign selection and absent target cannot create a diagnostic or invalidate the current session',async()=>{
 const f=await running(),frame=f.frames[0];
 await assert.rejects(f.core.invalidate('BFCACHE',frame.tabId,frame.documentId,{session:crypto.randomUUID(),bindingIds:[]}),{message:'GENERATION_CHANGED'});
 await f.core.invalidate('BFCACHE',99999);assert.equal(await row(f),null);assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});

test('P1 native URL change can return STORE_UNCONFIRMED with successful storage; the actual postcheck error is retained',async()=>{
 const f=await running(),b=(await f.core.bundle()).bindings[0],frame=f.core.p1.frame.bind(f.core.p1);let reads=0;
 f.core.p1.frame=async(...a)=>{if(++reads===3)f.frames[0].url='https://www.youtube.com/results?search_query=synthetic';return frame(...a);};
 await assert.rejects(f.core.p1.attest(b,{revalidate:true}),{message:'STORE_UNCONFIRMED'});
 const first=await row(f);assert.equal(first.diagnostic.code,'STORE_UNCONFIRMED');assert.equal(first.diagnostic.stage,'P1_NATIVE_POSTCHECK');
 assert.deepEqual(first.diagnostic.rejected_fields,['native_url_sha256']);assert.equal(f.core.firstFailurePersistence,'COMMIT_ACKNOWLEDGED');
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
});

test('P1 missing native frame is distinguished from a URL postcheck change without exposing native errors',async()=>{
 const f=await running(),b=(await f.core.bundle()).bindings[0],frame=f.core.p1.frame.bind(f.core.p1);let once=true;
 f.core.p1.frame=async(...a)=>{if(once){once=false;throw Error('PRIVATE_NATIVE_API_ERROR');}return frame(...a);};
 await assert.rejects(f.core.p1.after({binding:b.key,native_hash:'0'.repeat(64)},{payload:{action:'READ'}}),{message:'STORE_UNCONFIRMED'});
 const first=await row(f);assert.equal(first.diagnostic.stage,'P1_NATIVE_POSTCHECK');assert.deepEqual(first.diagnostic.rejected_fields,['native_frame']);
 assert(!JSON.stringify(first).includes('PRIVATE_NATIVE_API_ERROR'));
});

test('normal policy ACK and END restoration remain unchanged and produce no false first failure',async()=>{
 const f=await running();assert.equal((await f.core.bundle()).a.session_status,'RUNNING');assert.equal(await row(f),null);
 await f.core.end(f.command.session_id);const b=await f.core.bundle();assert.equal(b.a.session_status,'ENDED');
 assert.equal(b.state.journal.observed,'RELEASED');assert.equal(b.bindings.some(x=>x.resolution==='NONE'||x.cleanup_pending),false);assert.equal(f.rules().length,0);assert.equal(await row(f),null);
});

test('authenticated Registry invalidation stores its first diagnostic with the UNKNOWN transaction',async()=>{
 const f=await running(),receiver=f.receivers.get(f.frames[0].documentId);
 await receiver.client.commit({kind:'INVALIDATE',reason:'PAGEHIDE'});
 const first=await row(f);assert.equal(first.diagnostic.stage,'REGISTRY_INVALIDATE');assert.equal(first.diagnostic.code,'BFCACHE');
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');assert.equal(f.core.registry.firstFailurePersistence,'COMMIT_ACKNOWLEDGED');
 await f.restart();assert.deepEqual(await row(f),first);
});

test('a failed Registry diagnostic add does not suppress normal ledger writes or overwrite existing evidence',async()=>{
 const f=await running(),b=await f.core.bundle();f.core.captureFirstFailure(Error('STORE_UNCONFIRMED'),b);await f.core.persistFirstFailure(b);const first=await row(f);
 const original=f.core.registry.recordInvalidationDiagnostic.bind(f.core.registry);
 // Inject a diagnostic-only duplicate add: fake-indexeddb emits a real async
 // ConstraintError. Ordinary journal/binding writes are not intercepted.
 f.core.registry.recordInvalidationDiagnostic=(rows,...args)=>original(rows.filter(r=>r.key!==first.key),...args);
 await f.receivers.get(f.frames[0].documentId).client.commit({kind:'INVALIDATE',reason:'PAGEHIDE'});
 assert.equal(f.core.registry.firstFailurePersistence,'UNCONFIRMED');assert.deepEqual(await row(f),first);
 const after=await f.core.bundle();assert.equal(after.a.session_status,'UNKNOWN');assert.equal(after.bindings[0].resolution,'NONE');assert.equal(f.rules().length,1);
});
