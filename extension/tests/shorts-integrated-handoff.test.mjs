import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixture} from './member-fixture.mjs';
import {DocumentCoordinator} from '../execution/document-coordinator.mjs';
import {DocumentLifecycle} from '../execution/document-lifecycle.mjs';
import {A1Content} from '../member-a1/content.mjs';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

async function setup({experimental=true,ContentClass=A1Content}={}){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true,ContentClass});
 f.env.experimentalDocumentCoordinator=experimental;
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 return f;
}
async function move(f,url,{sender='current'}={}){
 const frame=f.frames[0];frame.url=url;
 if(sender==='current')f.senderUrls.set(frame.documentId,url);
 const engine=new DocumentCoordinator(f.core);
 await engine.event('COMMITTED',{...frame,timeStamp:f.core.now()});
 await engine.event('HISTORY',{...frame,timeStamp:f.core.now()});
 return f.core.tick();
}
async function restored(f){
 assert.equal((await f.core.end(f.command.session_id)).session.status,'ENDED');
 const b=await f.core.bundle();assert.equal(b.state.journal.observed,'RELEASED');
 assert.equal(b.bindings.some(x=>x.cleanup_pending||x.resolution==='NONE'),false);
 assert.equal(f.rules().length,0);
}
test('configured NR baseline still rejects changed sender URL; failure and original debt remain',async()=>{
 const f=await setup({experimental:false});await f.core.startCommand(f.command);
 await assert.rejects(move(f,'https://www.youtube.com/shorts/changed'),/CLEANUP_REQUIRED/);
 const b=await f.core.bundle();assert.equal(b.a.session_status,'UNKNOWN');
 assert(b.bindings.some(x=>x.resolution==='NONE'));assert.equal(f.core.p1.handoffs.size,0);
});
for(const sender of ['current','original'])test('same-document scoped handoff supports '+sender+' Chrome sender convention and verified END',async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 const before=(await f.core.registry.rows()).find(x=>x.record_kind==='NATIVE_BINDING_PROOF');
 assert.equal((await move(f,'https://www.youtube.com/shorts/changed',{sender})).session.status,'RUNNING');
 assert.deepEqual(await f.core.store.read(before.key),before);
 await restored(f);
});
test('repeated search/watch/Shorts/back-like transitions preserve immutable proofs and end all bindings',async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 for(const path of ['/results?search_query=cats','/watch?v=normal','/shorts/one','/watch?v=normal']){
  assert.equal((await move(f,'https://www.youtube.com'+path)).session.status,'RUNNING');
  const b=await f.core.bundle();assert.equal(b.a.native_transition.phase,'CONFIRMED');
 }
 await restored(f);
 const before=JSON.stringify((await f.core.bundle()).state);
 await f.restart();assert.equal(JSON.stringify((await f.core.bundle()).state),before);
 assert.equal(f.core.p1.handoffs.size,0);
});
for(const changed of ['boot','profile','generation','transition','expires','proof_version','scope_hash','native_hash','fence_epoch'])test('handoff rejects stale/foreign '+changed,async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 const old=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE');
 const frame=f.frames[0];frame.url='https://www.youtube.com/shorts/next';f.senderUrls.set(frame.documentId,frame.url);
 await f.core.navigation({...frame,timeStamp:f.core.now()},{sameUrlHistory:true});
 const b=await f.core.store.read(old.key);await f.core.p1.attest(b,{revalidate:true});
 const bundle=await f.core.bundle(),p=await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id);
 const h=f.core.p1.handoffs.get(b.key);assert(h);
 assert.equal(f.core.p1.handoffMatches({...h,[changed]:'wrong'},bundle.a,b,p,h.native_hash,bundle.ownerFenceEpoch),false);
});
test('handoff cannot be reconstructed by Worker recreation or accept END/UNKNOWN/expired window',async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 const old=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE'),frame=f.frames[0];
 frame.url='https://www.youtube.com/shorts/next';f.senderUrls.set(frame.documentId,frame.url);
 await f.core.navigation({...frame,timeStamp:f.core.now()},{sameUrlHistory:true});
 const b=await f.core.store.read(old.key);await f.core.p1.attest(b,{revalidate:true});
 const current=await f.core.bundle(),p=await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id),h=f.core.p1.handoffs.get(b.key);
 for(const a of [{...current.a,intent:'END'},{...current.a,nr_first_failure:{code:'FAILED'}},
  {...current.a,native_transition:{...current.a.native_transition,deadline_at:f.core.now()}}])
  assert.equal(f.core.p1.handoffMatches(h,a,b,p,h.native_hash,current.ownerFenceEpoch),false);
 const Fresh=f.core.p1.constructor,recreated=new Fresh(f.core);
 assert.equal(recreated.handoffMatches(recreated.handoffs.get(b.key),current.a,b,p,h.native_hash,current.ownerFenceEpoch),false);
});
test('route capability never allows old Binding effect writes',async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 const old=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE'),frame=f.frames[0];
 frame.url='https://www.youtube.com/shorts/next';f.senderUrls.set(frame.documentId,frame.url);
 await f.core.navigation({...frame,timeStamp:f.core.now()},{sameUrlHistory:true});
 const b=await f.core.store.read(old.key);await f.core.p1.attest(b,{revalidate:true});
 const actor=f.receivers.get(frame.documentId);
 for(const kind of ['LEDGER_PLAN','CHECKPOINT','DOM_CONFIRM']){
  await assert.rejects(actor.client.commit({kind,entries:[],operation_id:crypto.randomUUID()}));
 }
 assert.equal((await f.core.bundle()).bindings.find(x=>x.key===b.key).ordinary_authority,'INACTIVE');
});
test('outgoing READY/HISTORY cannot clear a pending Root navigation',()=>{
 const m=new DocumentLifecycle(),d={tabId:1,frameId:0,documentId:'old',url:'https://www.youtube.com/watch?v=1',timeStamp:1};
 m.observe('COMMITTED',d);m.observe('READY',{...d,timeStamp:2});m.observe('BEFORE',{...d,timeStamp:3});
 assert.equal(m.observe('READY',{...d,timeStamp:4}).reason,'NAVIGATION_PENDING');
 assert.equal(m.observe('HISTORY',{...d,timeStamp:5}).reason,'NAVIGATION_PENDING');
 assert.equal(m.tabs.get(1).pending,true);
 m.observe('COMMITTED',{...d,documentId:'new',timeStamp:6});assert.equal(m.tabs.get(1).pending,false);
});
test('duplicate COMMITTED cannot downgrade a ready document; BEFORE tab capacity is bounded',()=>{
 const m=new DocumentLifecycle(),d={tabId:1,frameId:0,documentId:'old',url:'https://www.youtube.com/',timeStamp:1};
 m.observe('COMMITTED',d);m.observe('READY',{...d,timeStamp:2});
 assert.equal(m.observe('COMMITTED',{...d,timeStamp:3}).phase,'READY_ROOT_OBSERVED');
 const other=new DocumentLifecycle();for(let i=0;i<128;i++)other.observe('BEFORE',{...d,tabId:i});
 assert.throws(()=>other.observe('BEFORE',{...d,tabId:128}),/STORE_CAPACITY/);
});
test('integrated real DOM effect + durable Core: search, SPA Shorts, general video, END restoration',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><a href="/shorts/one">Shorts</a><a href="/watch?v=normal">Normal</a><ytd-shorts style="display:grid"><video></video></ytd-shorts></body></html>',{url:'https://www.youtube.com/shorts/0'});
 const d=dom.window.document,w=dom.window;
 Object.defineProperty(w.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 Object.defineProperties(d.documentElement,{clientWidth:{get:()=>1265},clientHeight:{get:()=>720}});
 w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1265,height:720,right:1265,bottom:720});
 const computed=w.getComputedStyle.bind(w);w.getComputedStyle=el=>el.hasAttribute('data-focurve-restriction')?
  {display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto'}:computed(el);
 let paused=false;const media=d.querySelector('video');Object.defineProperty(media,'paused',{get:()=>paused});media.pause=()=>{paused=true;};
 class DOMContent extends A1Content{constructor(config,runtime,_doc,options){super(config,runtime,d,{...options,effect:new A0ShortsEffect(d,{preserveOnFailure:true})});}}
 try{
  const f=await setup({ContentClass:DOMContent});await f.core.startCommand(f.command);
  for(const path of ['/results?search_query=cats','/shorts/one','/watch?v=normal']){
   w.history.pushState({},'',path);assert.equal((await move(f,w.location.href)).session.status,'RUNNING');
   const current=f.receivers.get(f.frames[0].documentId),e=current.effect.evidence();
   assert.equal(e.error_count,0);assert.equal(d.querySelector('a[href="/shorts/one"]').style.display,'none');
   assert.notEqual(d.querySelector('a[href="/watch?v=normal"]').style.display,'none');
   if(path.startsWith('/shorts/')){assert.equal(e.hidden_viewer_count,1);assert.equal(e.paused_media_count,1);assert.equal(e.inert_viewer_count,1);}
  }
  await restored(f);assert.equal(d.querySelector('ytd-shorts').style.display,'grid');
  assert.equal(d.querySelector('a[href="/shorts/one"]').style.display,'');
  assert.equal(d.querySelector('ytd-shorts').inert,false);
 }finally{w.close();}
});

for(const guest of [false,true]){
 const label=guest?'guest':'member';
 async function lifecycleFixture(){
  const f=await fixture({guest,experimental:true,documentRetirement:true,nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
  Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
  if(guest)await f.core.start(2,crypto.randomUUID());else await f.core.startCommand(f.command);
  return f;
 }
 test(label+' same-document history/fragment handoff, repeated navigation, END and data preservation',async()=>{
  const f=await lifecycleFixture();
  for(const path of ['/results?search_query=cats','/shorts/two','/watch?v=normal#chapter']){
   assert.equal((await move(f,'https://www.youtube.com'+path)).session.status,'RUNNING');
  }
  const sid=(await f.core.bundle()).a.session_id;assert.equal((await f.core.end(sid)).session.status,'ENDED');
  const ended=await f.core.bundle();assert.equal(ended.bindings.some(x=>x.resolution==='NONE'),false);assert.equal(f.rules().length,0);
  const before=JSON.stringify(ended.state);await f.restart();assert.equal(JSON.stringify((await f.core.bundle()).state),before);
 });
 test(label+' repeated exact Root reload retirement preserves ledger/proof evidence and permits END',async()=>{
  const f=await lifecycleFixture();
  const originals=new Map();
  for(let i=0;i<3;i++){
   const b=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE');
   originals.set(b.key,{ledger:structuredClone(b.ledger),proof:await f.core.store.read('a1:p1:NATIVE_BINDING_PROOF:'+b.scope.binding_id)});
   const frame=f.frames[0];await f.core.navigation({...frame,timeStamp:f.core.now()});
   const before=(await f.core.bundle()).a.native_transition.deadline_at;
   frame.documentId='reload-document-'+i;await f.emitCommitted({...frame,timeStamp:f.core.now(),transitionType:'reload'});
   assert.equal(f.core.d1.lastFailure,undefined);
   assert.equal((await f.core.tick()).session.status,'RUNNING');
   assert.equal((await f.core.bundle()).a.native_transition.deadline_at,before);
  }
  const sid=(await f.core.bundle()).a.session_id;assert.equal((await f.core.end(sid)).session.status,'ENDED');
  for(const [key,original] of originals){
   const b=await f.core.store.read(key);assert.equal(b.resolution,'GONE_NATIVE');
   assert.equal(b.native_resolution_event,'DOCUMENT_RETIRED');
   assert.deepEqual(b.ledger,original.ledger);
   assert.deepEqual(await f.core.store.read(original.proof.key),original.proof);
  }
  assert.equal(f.rules().length,0);
 });
 test(label+' absent original document alone is never retirement or restoration evidence',async()=>{
  const f=await lifecycleFixture(),b=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE');
  f.frames[0].documentId='unobserved-document';
  await assert.rejects(f.core.tick());
  assert.equal((await f.core.store.read(b.key)).resolution,'NONE');
  assert((await f.core.bundle()).bindings.some(x=>x.cleanup_pending||x.resolution==='NONE'));
 });
}
test('Root fragment event reaches shared policy re-evaluation and listeners dispose cleanly',async()=>{
 const event=()=>({listeners:new Set(),addListener(f){this.listeners.add(f);},removeListener(f){this.listeners.delete(f);}});
 const fragment=event(),chrome={webNavigation:{onReferenceFragmentUpdated:fragment},tabs:{}};
 const calls=[],core={ready:Promise.resolve(),serial:f=>f(),navigation:(d,o)=>calls.push({d,o}),requestCheck(){}};
 const {installDocumentCoordinator}=await import('../execution/document-coordinator.mjs');
 const installed=installDocumentCoordinator(core,chrome);
 for(const fn of fragment.listeners)fn({tabId:1,frameId:0,documentId:'same',url:'https://www.youtube.com/shorts/one#x',timeStamp:Date.now()});
 await installed.coordinator.idle();assert.equal(calls.length,1);assert.equal(calls[0].o.sameUrlHistory,true);
 installed.dispose();assert.equal(fragment.listeners.size,0);
});

for(const field of ['id','tab','frameId','documentId','documentLifecycle','origin','url'])test('route challenge still rejects forged sender '+field,async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 const old=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE'),frame=f.frames[0];
 frame.url='https://www.youtube.com/shorts/next';f.senderUrls.set(frame.documentId,frame.url);
 await f.core.navigation({...frame,timeStamp:f.core.now()},{sameUrlHistory:true});
 const b=await f.core.store.read(old.key);await f.core.p1.attest(b,{revalidate:true});
 const sender={id:'trial',tab:{id:frame.tabId},frameId:0,documentId:frame.documentId,documentLifecycle:'active',origin:'https://www.youtube.com',url:frame.url};
 sender[field]=field==='tab'?{id:99}:field==='frameId'?1:field==='url'?'https://www.youtube.com/watch?v=forged':'wrong';
 const m={payload:{registration_id:b.registration_id,scope:b.scope,channel_credential:b.channel_credential}};
 await assert.rejects(f.core.p1.admission(m,sender),/UNAUTHORIZED_SENDER/);
});
test('lost attestation response never permits a cleanup replay or fabricates RELEASE',async()=>{
 const f=await setup();await f.core.startCommand(f.command);
 const b=(await f.core.bundle()).bindings.find(x=>x.resolution==='NONE'),frame=f.frames[0];
 frame.url='https://www.youtube.com/shorts/next';f.senderUrls.set(frame.documentId,frame.url);
 await f.core.navigation({...frame,timeStamp:f.core.now()},{sameUrlHistory:true});
 const send=f.chrome.tabs.sendMessage;f.chrome.tabs.sendMessage=async(...args)=>{if(args[1].type==='D06_MEMBER_P1_PROBE')throw Error('STORE_UNCONFIRMED');return send(...args);};
 await assert.rejects(f.core.p1.attest(await f.core.store.read(b.key),{revalidate:true}),/STORE_UNCONFIRMED/);
 assert.equal(f.core.p1.handoffs.size,0);
 assert.equal((await f.core.store.read(b.key)).resolution,'NONE');
});
test('review bundles explicitly choose experimental routing; compatibility build stays opt-out',async()=>{
 const {buildA1}=await import('../scripts/build-a1.mjs'),{buildMemberA1}=await import('../scripts/build-member-a1.mjs');
 const vm=await import('node:vm');
 for(const build of [buildA1,buildMemberA1]){
  const enabled=build({experimentalDocumentCoordinator:true}),disabled=build({experimentalDocumentCoordinator:false});
  assert.notEqual(enabled.core,disabled.core);
  assert.equal(enabled.content,disabled.content);
  assert.doesNotThrow(()=>new vm.Script(enabled.core));
  assert.doesNotThrow(()=>new vm.Script(disabled.core));
 }
 assert.match(buildA1({experimentalDocumentCoordinator:true}).core,/installWorker\(\{experimentalDocumentCoordinator:true,/);
 assert.match(buildMemberA1({experimentalDocumentCoordinator:true}).core,/installMemberWorker\(\{\.\.\.env,experimentalDocumentCoordinator:true\}\)/);
});
