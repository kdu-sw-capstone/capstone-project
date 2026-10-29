import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './member-fixture.mjs';

async function interruptedBootstrap({guest=false}={}){
 const f=await fixture({guest,experimental:true,nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 if(guest){await f.core.start(3,crypto.randomUUID());f.command.session_id=(await f.core.bundle()).a.session_id;}else await f.core.startCommand(f.command);
 f.frames.push({tabId:2,frameId:0,documentId:'document-new',url:'https://www.youtube.com/shorts/new',documentLifecycle:'active'});
 const send=f.chrome.tabs.sendMessage;let lost=false;
 f.chrome.tabs.sendMessage=async(tab,m,target)=>{const result=await send(tab,m,target);if(!lost&&target.documentId==='document-new'&&['D06_MEMBER_P1_PROBE','D06_P1_PROBE'].includes(m.type)){lost=true;throw Error('STORE_UNCONFIRMED');}return result;};
 await assert.rejects(async()=>{for(let i=0;i<8;i++)await f.core.tick();},{message:'STORE_UNCONFIRMED'});
 f.chrome.tabs.sendMessage=send;assert.equal(lost,true);
 const b=await f.core.bundle(),provisional=b.bindings.find(x=>x.scope.document_id==='document-new');
 assert.equal(b.a.session_status,'UNKNOWN');assert.equal(provisional.readiness,'PROVISIONAL');assert.equal(provisional.ledger.length,0);
 const proof=await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+provisional.scope.binding_id);
 assert.equal(proof.phase,'ATTESTED');return {f,provisional,proof,first:structuredClone(b.a.nr_first_failure)};
}

test('lost P1 response after committed proof can be explicitly released through a fresh same-owner challenge',async()=>{
 const {f,provisional,proof,first}=await interruptedBootstrap();let probes=0;
 const send=f.chrome.tabs.sendMessage;f.chrome.tabs.sendMessage=async(...a)=>{if(a[1].type==='D06_MEMBER_P1_PROBE')probes++;return send(...a);};
 await f.core.end(f.command.session_id);
 const after=await f.core.bundle();assert.equal(after.a.session_status,'ENDED');assert(probes>0,'a stored proof alone is not fresh cleanup authority');
 assert.deepEqual(await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+provisional.scope.binding_id),proof);
 assert.deepEqual(after.a.nr_first_failure,first);assert.equal(after.state.journal.observed,'RELEASED');
 assert.equal(after.bindings.some(x=>x.resolution==='NONE'||x.cleanup_pending),false);assert.equal(f.rules().length,0);
});

test('reentry never trusts an old proof for a replaced or absent native document',async()=>{
 const {f,provisional,proof}=await interruptedBootstrap();
 f.frames.find(x=>x.documentId==='document-new').documentId='different-document';
 await f.core.end(f.command.session_id);const after=await f.core.bundle();assert.notEqual(after.a.session_status,'ENDED');
 assert.equal(after.bindings.find(x=>x.scope.binding_id===provisional.scope.binding_id).resolution,'NONE');
 assert.deepEqual(await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+provisional.scope.binding_id),proof);
});

test('reentry cannot cross an owner change and leaves the original failure and proof intact',async()=>{
 const {f,provisional,proof,first}=await interruptedBootstrap();f.owner.owner_key='MEMBER:2';
 await assert.rejects(f.core.end(f.command.session_id),{message:'OWNER_MISMATCH'});f.owner.owner_key='MEMBER:1';
 assert.deepEqual((await f.core.bundle()).a.nr_first_failure,first);
 assert.deepEqual(await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+provisional.scope.binding_id),proof);
});


test('guest committed attestation with a lost reply also requires a fresh challenge before END',async()=>{
 const {f,provisional,proof,first}=await interruptedBootstrap({guest:true});let probes=0;const send=f.chrome.tabs.sendMessage;
 f.chrome.tabs.sendMessage=async(...a)=>{if(a[1].type==='D06_P1_PROBE')probes++;return send(...a);};
 await f.core.end(f.command.session_id);const b=await f.core.bundle();assert.equal(b.a.session_status,'ENDED');assert(probes>0);
 assert.deepEqual(await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+provisional.scope.binding_id),proof);assert.deepEqual(b.a.nr_first_failure,first);
 assert.equal(b.bindings.some(x=>x.resolution==='NONE'||x.cleanup_pending),false);assert.equal(b.state.journal.observed,'RELEASED');assert.equal(f.rules().length,0);
});
