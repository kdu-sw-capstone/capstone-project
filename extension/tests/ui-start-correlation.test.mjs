import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {MemberA1Adapter} from '../integration/member-a1-adapter.mjs';
import {buildMemberA1} from '../scripts/build-member-a1.mjs';

test('shipped adapter is rebuilt deterministically from the current source modules',()=>{
 assert.equal(fs.readFileSync(new URL('../integration/member-a1-adapter.bundle.js',import.meta.url),'utf8'),buildMemberA1().adapter);
});
import {digest} from '../member-a1/contract.mjs';
const ui='13ddd97b-7f5b-4dd6-a69d-7b274140b1c0',intentId='11111111-1111-4111-8111-111111111111';
function fixture(Adapter=MemberA1Adapter){
 const rows=new Map(),calls=[];
 const a=new Adapter({auth:{},core:{bundle:async()=>null},db:{},authority:{idle:async()=>{}},inspectGuest:async()=>({active:false,unresolved:false,cleanup:false})});
 a.identity=async()=>({owner_key:'MEMBER:1',executor_id:intentId,authority:'https://localhost:29511/api/v1'});
 a.read=async key=>rows.get(key)??null;a.put=async(key,value)=>{rows.set(key,structuredClone(value));return value;};
 a.request=async(...args)=>{calls.push(args);return {session_id:'22222222-2222-4222-8222-222222222222',execution_status:'STARTING'};};
 a.tickInner=async()=>{};a.status=async()=>({local_status:'RUNNING'});return {a,rows,calls};
}
test('UI request and existing server idempotency intent are durably linked',async()=>{
 const f=fixture();await f.a.start(10,ui);const row=f.rows.get('member:start-intent');
 assert.equal(row.ui_request_id,ui);assert.equal(row.completed,true);assert.equal(f.calls[0][2]['Idempotency-Key'],row.id);
 assert.equal(row.id,ui);assert.equal(row.session_id,'22222222-2222-4222-8222-222222222222');
});
test('legacy unresolved intent cannot be retroactively attributed to this UI request',async()=>{
 const f=fixture();const old={id:intentId,minutes:10,completed:false};f.rows.set('member:start-intent',old);
 await assert.rejects(f.a.start(10,ui),/START_REQUEST_CORRELATION_UNCONFIRMED/);assert.equal(f.calls.length,0);assert.deepEqual(f.rows.get('member:start-intent'),old);
});
test('different UI request cannot reuse an unresolved intent',async()=>{
 const f=fixture();f.rows.set('member:start-intent',{id:intentId,minutes:10,completed:false,ui_request_id:intentId});
 await assert.rejects(f.a.start(10,ui),/START_INTENT_CONFLICT/);assert.equal(f.calls.length,0);
});
test('same completed UI request never creates another server START',async()=>{
 const f=fixture();await f.a.start(10,ui);await assert.rejects(f.a.start(10,ui),/START_REQUEST_ALREADY_RECORDED/);assert.equal(f.calls.length,1);
});
test('response loss preserves correlated intent without replay or synthetic completion',async()=>{
 const f=fixture();f.a.request=async()=>{f.calls.push('POST');throw Error('SYNTHETIC_RESPONSE_LOSS');};
 await assert.rejects(f.a.start(10,ui),/SYNTHETIC_RESPONSE_LOSS/);const row=f.rows.get('member:start-intent');
 assert.equal(row.ui_request_id,ui);assert.equal(row.completed,false);assert.equal(f.calls.length,1);
});
test('runtime forwards the validated UI request ID to the member adapter',async()=>{
 let listener,reply,argumentsSeen;
 const chrome={alarms:{create(){},onAlarm:{addListener(){}}},runtime:{id:'a'.repeat(32),getURL:x=>'chrome-extension://'+'a'.repeat(32)+'/'+x,onMessage:{addListener:f=>listener=f}}};
 const world={chrome,importScripts(){},__memberA1:{start:async(...args)=>{argumentsSeen=args;return {}; }},FocurveUserAdmission:{start:async fn=>fn()},seedMemberFeatureBaseline:async()=>{},Promise,console};
 vm.runInNewContext(fs.readFileSync(new URL('../member-ui/runtime.js',import.meta.url),'utf8'),world);
 listener({type:'INDEPENDENT_MEMBER_UI',request_id:ui,action:'START',payload:{minutes:10}},{id:chrome.runtime.id,url:chrome.runtime.getURL('member-ui/popup.html'),frameId:0},r=>reply=r);
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(argumentsSeen,[10,ui]);assert.equal(reply.ok,true);
});

test('a correlated in-doubt UI request is not replayed after response loss',async()=>{
 const f=fixture();f.a.request=async()=>{f.calls.push('POST');throw Error('SYNTHETIC_RESPONSE_LOSS');};
 await assert.rejects(f.a.start(10,ui));await assert.rejects(f.a.start(10,ui),/START_REQUEST_OUTCOME_UNCONFIRMED/);
 assert.equal(f.calls.length,1);assert.equal(f.rows.get('member:start-intent').completed,false);
});
test('generated classic Worker bundle retains the same correlation guard',async()=>{
 const world={MemberA1Contract:{digest},crypto:globalThis.crypto,fetch:globalThis.fetch,Date,Error,JSON,Object,Array,Number,Promise,AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(new URL('../integration/member-a1-adapter.bundle.js',import.meta.url),'utf8'),world);
 const f=fixture(world.FocurveMemberA1Adapter.MemberA1Adapter);await f.a.start(10,ui);
 assert.equal(f.rows.get('member:start-intent').ui_request_id,ui);
 await assert.rejects(f.a.start(10,ui),/START_REQUEST_ALREADY_RECORDED/);assert.equal(f.calls.length,1);
});
