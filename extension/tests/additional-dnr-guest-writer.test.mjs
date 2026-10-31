import test from 'node:test';
import assert from 'node:assert/strict';
import {locks} from 'node:worker_threads';
import {IDBFactory} from 'fake-indexeddb';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fixture} from './member-fixture.mjs';
import {createMemberDB} from '../member-a1/db.mjs';
import {AdditionalDnrStore} from '../src/additional-dnr-store.js';
import {LegacyDnrWriter,installMemberDnrWriter} from '../src/additional-dnr-legacy-writer.js';
import {buildA1} from '../scripts/build-a1.mjs';

async function guest(options={}){
 const f=await fixture({guest:true,...options}),sites=await f.env.sites.list();
 sites.items.push({...sites.items[0],site_id:crypto.randomUUID(),canonical_host:'example.com',display_name:'Example',purpose:'DISTRACTION',access_policy:'BLOCK',feature_policies:[]});
 f.env.sites.list=async()=>structuredClone(sites);
 const store=new AdditionalDnrStore(createMemberDB(new IDBFactory(),'guest-writer-root'));
 const writer=new LegacyDnrWriter({store,dnr:f.chrome.declarativeNetRequest,locks});
 f.env.dnrWriter=(r,dispatch)=>writer.write('SESSION',r,dispatch);
 const start=()=>f.core.start(5,crypto.randomUUID());
 const protect=async ruleId=>store.mutate(s=>{s.writer_epoch=2;s.claims.push({claim_id:crypto.randomUUID(),owner_binding_id:crypto.randomUUID(),generation:1,writer_epoch:1,rule_key:{rule_store:'SESSION',rule_id:ruleId},rule_sha256:'a'.repeat(64),restore_state:'UNCONFIRMED'});});
 return Object.assign(f,{store,writer,start,protect});
}
async function queue(f,operation){
 let held,unlock,queued;const entered=new Promise(r=>{held=r;}),release=new Promise(r=>{unlock=r;}),waiting=new Promise(r=>{queued=r;});
 const blocker=locks.request('focurve:amvp:dnr-writer',async()=>{held();await release;});await entered;
 f.env.dnrWriter=(r,dispatch)=>{queued();return f.writer.write('SESSION',r,dispatch);};
 const work=operation();work.catch(()=>{});await waiting;
 return {work,release:async()=>{unlock();await blocker;}};
}
function authRuntime(auth,root={idle:async()=>true}){
 const context=vm.createContext({__memberIntegration:{auth},__memberRootAuthority:root});
 const worker=readFileSync(new URL('../background/service-worker.js',import.meta.url),'utf8');
 vm.runInContext(worker.slice(worker.indexOf('globalThis.MemberAuthRuntime='),worker.indexOf('importScripts("a0-core.bundle.js")')),context);
 return context.MemberAuthRuntime;
}

test('Guest and Member aliases refer to the identical immutable physical gate',()=>{
 const world={},service=installMemberDnrWriter({declarativeNetRequest:{}},new IDBFactory(),locks,world);
 assert.equal(world.FocurveDnrWriter,service);assert.equal(world.FocurveMemberDnrWriter,service);
 assert.equal(Object.getOwnPropertyDescriptor(world,'FocurveDnrWriter').writable,false);assert.equal(service.assertWritersGuarded,undefined);
});
test('Guest normal APPLY/END and Content cleanup use the guarded paths',async()=>{
 const f=await guest();let calls=0;f.env.dnrWriter=(r,dispatch)=>{calls++;return f.writer.write('SESSION',r,dispatch);};
 await f.start();const b=await f.core.bundle();assert.equal(b.a.session_status,'RUNNING');assert.ok(b.bindings.length>0);assert.equal(f.rules().length,1);
 await f.core.end(b.a.session_id);assert.equal((await f.core.bundle()).a.session_status,'ENDED');assert.equal(f.rules().length,0);assert.ok(calls>=2);
 assert.ok([...f.effects.values()].every(e=>!e.running&&e.control.changes.size===0));
});
test('Guest initial APPLY cannot overwrite a runtime reservation',async()=>{
 const f=await guest();await f.protect(100000);await assert.rejects(f.start(),/DNR_RUNTIME_CLAIM_PROTECTED/);
 assert.equal(f.rules().length,0);assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');assert.equal((await f.store.read()).claims[0].restore_state,'UNCONFIRMED');
});
test('Guest END keeps rule and cleanup pending while another claim protects its ID',async()=>{
 const f=await guest();await f.start();const b=await f.core.bundle();await f.protect(f.rules()[0].id);
 await assert.rejects(f.core.end(b.a.session_id),/DNR_RUNTIME_CLAIM_PROTECTED/);
 assert.equal(f.rules().length,1);assert.equal((await f.core.bundle()).a.cleanup_pending,true);assert.notEqual((await f.core.bundle()).a.session_status,'ENDED');
});
test('Guest suspend and UNKNOWN missing-rule repair both use the shared gate',async()=>{
 const f=await guest();await f.start();await f.core.suspend();assert.equal(f.rules().length,0);await f.core.tick();assert.equal(f.rules().length,1);
 await f.core.suspend();await f.protect(100000);await assert.rejects(f.core.tick(),/DNR_RUNTIME_CLAIM_PROTECTED/);assert.equal(f.rules().length,0);
});
for(const kind of ['owner','executor','unavailable'])test(`Guest queued recovery refuses current identity ${kind}`,async()=>{
 const f=await guest();await f.start();await f.core.suspend();const original=f.env.owner,owner=structuredClone(await original());
 const queued=await queue(f,()=>f.core.tick());
 f.env.owner=kind==='unavailable'?async()=>{throw Error('IDENTITY_UNAVAILABLE');}:async()=>({...owner,...(kind==='owner'?{owner_key:'GUEST:'+crypto.randomUUID()}:{installation_id:crypto.randomUUID()})});
 const rejected=assert.rejects(queued.work,/OWNER_MISMATCH|IDENTITY_UNAVAILABLE/);await queued.release();await rejected;assert.equal(f.rules().length,0);
 f.env.owner=original;assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');
});
test('Guest queued APPLY loses to END without discarding original cleanup obligations',async()=>{
 const f=await guest();await f.start();await f.core.suspend();const before=await f.core.bundle(),queued=await queue(f,()=>f.core.tick());
 await f.core.endIntent(before.a.session_id,'TIME_LIMIT');const rejected=assert.rejects(queued.work,/GENERATION_CHANGED|END_WINS/);await queued.release();await rejected;
 assert.equal(f.rules().length,0);assert.equal((await f.core.bundle()).a.intent,'END');await f.core.finish();assert.equal((await f.core.bundle()).a.session_status,'ENDED');
});
test('Guest queued cleanup of exact old footprint survives a current owner change',async()=>{
 const f=await guest();await f.start();const b=await f.core.bundle(),original=f.env.owner,owner=structuredClone(await original());
 const queued=await queue(f,()=>f.core.releaseDnr(b.state));f.env.owner=async()=>({...owner,owner_key:'GUEST:'+crypto.randomUUID()});
 await queued.release();await queued.work;assert.equal(f.rules().length,0);f.env.owner=original;
 const after=await f.core.bundle();assert.equal(after.a.record_version,b.a.record_version);assert.deepEqual(after.bindings,b.bindings);
});
test('Guest DNR response wait leaves END intent writable',async()=>{
 const f=await guest();await f.start();const b=await f.core.bundle(),native=f.chrome.declarativeNetRequest.updateSessionRules;let entered,complete;
 const waiting=new Promise(r=>{entered=r;});f.chrome.declarativeNetRequest.updateSessionRules=()=>{entered();return new Promise(r=>{complete=r;});};
 const work=f.core.releaseDnr(b.state);await waiting;let timer;
 try{await Promise.race([f.core.endIntent(b.a.session_id,'TIME_LIMIT'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('END_DB_BLOCKED')),1000);})]);}finally{clearTimeout(timer);complete();}
 await work;f.chrome.declarativeNetRequest.updateSessionRules=native;assert.equal((await f.core.bundle()).a.intent,'END');await f.core.finish();assert.equal(f.rules().length,0);
});
test('Guest final gate refuses changed auth token after local auth validation',async()=>{
 const f=await guest();let token=Object.freeze({pending:false});f.env.dnrAuthorityState=()=>token;
 await f.start();await f.core.suspend();f.env.assertDnrApply=async()=>{token=Object.freeze({pending:false});};
 await assert.rejects(f.core.tick(),/OWNER_MISMATCH/);assert.equal(f.rules().length,0);
});
test('Guest serialized START does not recursively acquire MemberAuth.serial',async()=>{
 const context=vm.createContext({});vm.runInContext(readFileSync(new URL('../background/member-auth.js',import.meta.url),'utf8'),context);
 const Auth=context.FocurveMemberAuth,auth=new Auth.MemberAuth({store:{get:async()=>null},fetch:()=>{throw Error('UNEXPECTED_AUTH_NETWORK');}}),runtime=authRuntime(auth);
 const f=await guest();f.env.assertDnrApply=()=>runtime.assertGuestDnrApply();f.env.dnrAuthorityState=()=>Auth.AuthStore.writeState();
 let timer;try{await Promise.race([runtime.guardGuestStart(()=>f.start()),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('AUTH_SERIAL_DEADLOCK')),1000);})]);}finally{clearTimeout(timer);}
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
});
for(const reason of ['member','root','unready'])test(`Guest queued apply rejects ${reason} authority without suppressing cleanup`,async()=>{
 let phase='UNREGISTERED',rootActive=false;
 const runtime=authRuntime({load:async()=>({phase})},{idle:async()=>{if(rootActive)throw Error('ROOT_OBLIGATION_EXISTS');}}),f=await guest();
 f.env.assertDnrApply=()=>runtime.assertGuestDnrApply();await f.start();await f.core.suspend();
 const queued=await queue(f,()=>f.core.tick());if(reason==='member')phase='LINKED';if(reason==='root')rootActive=true;
 if(reason==='unready')f.env.assertDnrApply=()=>authRuntime(undefined).assertGuestDnrApply();
 const rejected=assert.rejects(queued.work,/ACCOUNT_TRANSITION_ACTIVE|ROOT_OBLIGATION_EXISTS|MEMBER_ADAPTER_NOT_READY/);await queued.release();await rejected;assert.equal(f.rules().length,0);
});
test('generated Guest bootstrap requires the canonical gate before runtime installation',()=>{
 const source=readFileSync(new URL('../background/a1-core.bundle.js',import.meta.url),'utf8'),worker=readFileSync(new URL('../background/service-worker.js',import.meta.url),'utf8');
 assert.equal(source,buildA1().core);assert.ok(source.includes('dnrWriter:globalThis.FocurveDnrWriter.write'));assert.ok(source.includes('assertDnrApply:()=>MemberAuthRuntime.assertGuestDnrApply()'));
 assert.ok(worker.includes("importScripts('additional-dnr-writer.bundle.js',\"a1-core.bundle.js\")"));assert.equal((worker.match(/additional-dnr-writer.bundle.js/g)??[]).length,1);
});

test('Guest deployed NR01/ND01/DP01 flags retain normal START and END',async()=>{
 const f=await guest({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 await f.start();const b=await f.core.bundle();assert.equal(b.a.session_status,'RUNNING');await f.core.end(b.a.session_id);
 assert.equal((await f.core.bundle()).a.session_status,'ENDED');assert.equal(f.rules().length,0);
});
test('Guest queued native transition expiry cannot dispatch a delayed repair',async()=>{
 const f=await guest({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 await f.start();await f.core.nrBegin(await f.core.bundle());const b=await f.core.bundle();
 const queued=await queue(f,()=>f.core.guardedDnrUpdate(b.state,{addRules:b.state.journal.rules},true));f.advance(6000);
 const rejected=assert.rejects(queued.work,/REVALIDATION_REQUIRED/);await queued.release();await rejected;
 assert.equal(f.rules().length,1);assert.deepEqual(f.rules(),b.state.journal.rules);
});
