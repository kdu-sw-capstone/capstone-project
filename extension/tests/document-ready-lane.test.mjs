import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentCoordinator,installDocumentCoordinator} from '../execution/document-coordinator.mjs';
import {fixture as memberFixture} from './member-fixture.mjs';

const root=(extra={})=>({tabId:7,frameId:0,documentId:'root-a',documentLifecycle:'active',
 url:'https://www.youtube.com/watch?v=a',timeStamp:100,...extra});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const drain=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function setup(){
 const calls=[],wait=deferred();
 const core={ready:Promise.resolve(),d1:{},navigation:async e=>{calls.push(['NAV',e.documentId]);await wait.promise;},
  serial:fn=>fn(),nativeDocumentReady:e=>calls.push(['READY',e.documentId,e.url]),requestCheck:()=>calls.push(['CHECK'])};
 return {core,calls,wait,q:new DocumentCoordinator(core)};
}
for(const kind of ['BEFORE','HISTORY'])test('current Root READY bypasses delayed '+kind+' without bypassing Core policy work',async()=>{
 const f=setup();await f.q.event('COMMITTED',root());
 const pending=f.q.event(kind,root({timeStamp:101}));await drain();
 if(kind==='BEFORE')await f.q.event('COMMITTED',root({timeStamp:102}));
 const result=await f.q.event('READY',root({timeStamp:103}));
 assert.equal(result.accepted,true);assert.equal(f.calls.filter(x=>x[0]==='READY').length,1);
 assert(f.q.pending.size>=1);f.wait.resolve();await pending;await f.q.idle();
});
test('duplicate navigation shares original work and does not create a new observer epoch',async()=>{
 const f=setup(),e=root();const first=f.q.event('BEFORE',e),duplicate=f.q.event('BEFORE',e);
 assert.equal(first,duplicate);await drain();assert.equal(f.calls.filter(x=>x[0]==='NAV').length,1);
 f.wait.resolve();await first;
});
test('duplicate READY is idempotent both during and after initialization',async()=>{
 const f=setup(),init=deferred();f.core.ready=init.promise;
 const a=f.q.event('COMMITTED',root()),r=f.q.event('READY',root({timeStamp:101}));
 assert.equal(r,f.q.event('READY',root({timeStamp:101})));init.resolve();await Promise.all([a,r]);
 assert.equal((await f.q.event('READY',root({timeStamp:102}))).reason,'DUPLICATE_READY');
 assert.equal(f.calls.filter(x=>x[0]==='READY').length,1);
});
test('outgoing READY stays denied while replacement has not committed',async()=>{
 const f=setup();await f.q.event('COMMITTED',root());const before=f.q.event('BEFORE',root({timeStamp:101}));
 assert.equal((await f.q.event('READY',root({timeStamp:102}))).reason,'NAVIGATION_PENDING');
 await f.q.event('COMMITTED',root({documentId:'root-b',timeStamp:103}));
 assert.equal((await f.q.event('READY',root({timeStamp:104}))).reason,'OTHER_DOCUMENT');
 assert.equal((await f.q.event('READY',root({documentId:'root-b',timeStamp:105}))).accepted,true);
 assert.deepEqual(f.calls.filter(x=>x[0]==='READY').map(x=>x[1]),['root-b']);f.wait.resolve();await before;
});
test('READY waiting for Core initialization is rejected after document replacement',async()=>{
 const f=setup(),init=deferred();f.core.ready=init.promise;
 const a=f.q.event('COMMITTED',root()),ready=f.q.event('READY',root({timeStamp:101}));
 const b=f.q.event('COMMITTED',root({documentId:'root-b',timeStamp:102}));init.resolve();
 await Promise.all([a,b]);assert.equal((await ready).reason,'SUPERSEDED_DOCUMENT');
 assert.equal(f.calls.filter(x=>x[0]==='READY').length,0);
});
test('back/forward to same URL cannot replay an earlier READY observer generation',async()=>{
 const f=setup(),init=deferred();f.core.ready=init.promise;f.wait.resolve();
 const tasks=[f.q.event('COMMITTED',root()),f.q.event('READY',root({timeStamp:101})),
  f.q.event('HISTORY',root({url:'https://www.youtube.com/shorts/b',timeStamp:102})),
  f.q.event('HISTORY',root({timeStamp:103})),f.q.event('READY',root({timeStamp:104}))];
 init.resolve();const results=await Promise.all(tasks);
 assert.equal(results[1].reason,'SUPERSEDED_DOCUMENT');assert.equal(results[4].accepted,true);
 assert.equal(f.calls.filter(x=>x[0]==='READY').length,1);
});
test('tab removal invalidates pending READY and never fabricates disappearance proof',async()=>{
 const f=setup(),init=deferred();f.core.ready=init.promise;
 const a=f.q.event('COMMITTED',root()),ready=f.q.event('READY',root({timeStamp:101})),removed=f.q.removed(7);
 init.resolve();await Promise.all([a,removed]);assert.equal((await ready).reason,'SUPERSEDED_DOCUMENT');
 assert.equal((await f.q.event('READY',root({timeStamp:102}))).reason,'RETIRED_DOCUMENT');
 assert.equal(f.calls.filter(x=>x[0]==='READY').length,0);
});
test('a new pending navigation invalidates READY captured before Core initialization',async()=>{
 const f=setup(),init=deferred();f.core.ready=init.promise;
 const a=f.q.event('COMMITTED',root()),r=f.q.event('READY',root({timeStamp:101}));
 const n=f.q.event('BEFORE',root({timeStamp:102}));init.resolve();await a;
 assert.equal((await r).reason,'SUPERSEDED_DOCUMENT');f.wait.resolve();await n;
});
test('stale timestamp, subframe, wrong URL and inactive READY do not reach Core',async()=>{
 const f=setup();await f.q.event('COMMITTED',root());
 for(const e of [root({timeStamp:99}),root({frameId:1}),root({url:'https://www.youtube.com/watch?v=other'}),
  root({documentLifecycle:'cached'}),root({url:'http://www.youtube.com/watch?v=a'}),root({url:'https://attacker.test/'})]){
  assert.equal((await f.q.event('READY',e)).accepted,false);
 }
 assert.equal(f.calls.filter(x=>x[0]==='READY').length,0);
});
test('READY from runtime/content messages has no route into Root observation lane',()=>{
 const channel=()=>({addListener:()=>{},removeListener:()=>{}});let messageListeners=0;
 const chrome={runtime:{onMessage:{addListener:()=>messageListeners++}},webNavigation:{onBeforeNavigate:channel(),onCommitted:channel(),
  onDOMContentLoaded:channel(),onHistoryStateUpdated:channel()},tabs:{onUpdated:channel(),onRemoved:channel()}};
 const f=setup(),installed=installDocumentCoordinator(f.core,chrome);assert.equal(messageListeners,0);installed.dispose();
});
async function realCore(){
 const f=await memberFixture({experimental:true,nr01:true,nd01:true,dp01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',document_transition_contract:'ND01_1',dom_transition_contract:'DP01_1'});
 await f.core.startCommand(f.command);await f.core.nrBegin(await f.core.bundle());return f;
}
test('independent READY restores real Core revalidation inside unchanged five-second window and permits normal END',async t=>{
 // The fixture advances its logical clock; CPU scheduling must not advance request timers separately.
 t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.now()});
 const f=await realCore(),wait=deferred(),query=f.chrome.tabs.query;
 f.chrome.tabs.query=async()=> (await query()).map(t=>({...t,status:'loading'}));
 const e={...f.frames[0],timeStamp:f.core.now()},q=new DocumentCoordinator({ready:f.core.ready,navigation:()=>wait.promise,
  requestCheck:()=>{},nativeDocumentReady:d=>f.core.nativeDocumentReady(d)});
 const pending=q.event('BEFORE',e);await q.event('COMMITTED',e);await q.event('READY',e);
 f.advance(4990);assert.equal((await f.core.tick()).session.status,'RUNNING');
 assert.equal((await f.core.bundle()).a.native_transition.phase,'CONFIRMED');
 wait.resolve();await pending;
 assert.equal((await f.core.end(f.command.session_id)).session.status,'ENDED');
 const b=await f.core.bundle();assert.equal(b.state.journal.observed,'RELEASED');assert.equal(f.rules().length,0);
 assert.equal(b.bindings.filter(x=>x.resolution==='NONE'||x.cleanup_pending).length,0);
});
test('late READY cannot bypass expired NR deadline or clear the first UNKNOWN failure',async()=>{
 const f=await realCore();f.advance(5000);f.core.nativeDocumentReady({...f.frames[0],timeStamp:f.core.now()});
 await assert.rejects(f.core.tick(),/REVALIDATION_REQUIRED/);
 const b=await f.core.bundle();assert.equal(b.a.session_status,'UNKNOWN');
 assert(b.a.nr_first_failure);assert.equal(b.a.commit_fence,null);assert(b.bindings.some(x=>x.resolution==='NONE'));
});
test('late publication ACK cannot renew NR time even if READY is current',async()=>{
 const f=await realCore(),wait=deferred(),b=await f.core.bundle();
 const pending=f.core.waitNativePublication(b.a,()=>wait.promise);
 await drain();f.advance(5000);wait.resolve();await assert.rejects(pending,/REVALIDATION_REQUIRED/);
 assert.equal((await f.core.bundle()).a.native_transition.deadline_at,b.a.native_transition.deadline_at);
});
