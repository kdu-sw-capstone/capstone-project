import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
import {A1Content as MemberContent} from '../member-a1/content.mjs';
import {A1Content as GuestContent} from '../a1/content.mjs';
import {fixture} from './member-fixture.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

// Await MutationObserver delivery as well as ledger-backed scan work. Do not
// call refresh(): the regression is the missing automatic observation itself.
async function settle(effect){
 await new Promise(resolve=>setImmediate(resolve));
 for(let pending;;){pending=effect.pending;await pending;if(pending===effect.pending)break;}
}
for(const target of ['relative link','absolute link','protocol-relative link','Shorts shelf'])test('attribute-only '+target+' discovery persists before hiding and restores on release',async()=>{
 const dom=new JSDOM('<!doctype html><a id="target" href="/watch?v=one" style="display:inline-flex"></a><ytd-rich-shelf-renderer style="display:grid"></ytd-rich-shelf-renderer><a id="normal" href="/watch?v=normal"></a>',{url:'https://www.youtube.com/results?search_query=test'});
 const d=dom.window.document;
 Object.defineProperty(dom.window.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 const node=target==='Shorts shelf'?d.querySelector('ytd-rich-shelf-renderer'):d.querySelector('#target');
 const original=node.style.display,effect=new A0ShortsEffect(d,{preserveOnFailure:true});
 const saved=[];
 try{
  assert.equal((await effect.start(async plan=>{
   if(plan.some(row=>row.node_id===effect.nodeIds.get(node))){
    assert.equal(node.style.display,original,'durable plan must precede the first hide');
    saved.push(structuredClone(plan));
   }
  })).result_state,'NOT_APPLICABLE');
  if(target==='Shorts shelf')node.setAttribute('is-shorts','');
  else node.setAttribute('href',target==='relative link'?'/shorts/new':target==='absolute link'?'https://www.youtube.com/shorts/new':'//www.youtube.com/shorts/new');
  await settle(effect);
  assert.equal(node.style.display,'none');assert.equal(node.inert,true);assert.equal(saved.length,1);
  assert.equal(saved[0][0].display,original);assert.equal(effect.errors,0);
  assert.equal(d.querySelector('#normal').style.display,'');
  const released=await effect.release();assert.equal(released.owned_changes_restored,true);
  assert.equal(released.remaining_owned_changes,0);assert.equal(released.listeners_removed,true);
  assert.equal(node.style.display,original);assert.equal(node.inert,false);
  node.setAttribute('href','/shorts/after-release');await settle(effect);
  assert.equal(node.style.display,original,'released observer must stay stopped');
 }finally{await effect.release();dom.window.close();}
});

test('watch links mentioning Shorts in query remain visible after attribute-only updates',async()=>{
 const dom=new JSDOM('<!doctype html><a href="/watch?v=normal"></a>',{url:'https://www.youtube.com/'});
 const node=dom.window.document.querySelector('a'),effect=new A0ShortsEffect(dom.window.document);
 try{
  await effect.start(async()=>{});node.href='/watch?v=normal&next=/shorts/one';await settle(effect);
  assert.equal(node.style.display,'');assert.equal(effect.control.changes.size,0);
 }finally{await effect.release();dom.window.close();}
});

for(const guest of [false,true])test((guest?'guest':'member')+' attribute discovery uses real Content ledger, Core confirmation and normal END',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const dom=new JSDOM('<!doctype html><a href="/watch?v=normal" style="display:inline-flex"></a>',{url:'https://www.youtube.com/results?search_query=test'}),d=dom.window.document;
 Object.defineProperty(dom.window.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 const Base=guest?GuestContent:MemberContent;
 class DOMContent extends Base{constructor(config,runtime,_document,options){super(config,runtime,d,{...options,effect:new A0ShortsEffect(d,{preserveOnFailure:true})});}}
 const f=await fixture({guest,ContentClass:DOMContent,dp01:true,nr01:true,nd01:true,p1:true,d1b5:true,limitedProduct11:true});
 f.frames[0].url=d.location.href;
 Object.assign(f.command,{dom_transition_contract:'DP01_1',native_transition_contract:'NR01_1',document_transition_contract:'ND01_1'});
 try{
  if(guest)await f.core.start(3,crypto.randomUUID());else await f.core.startCommand(f.command);
  assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
  const content=f.receivers.get('document-0'),node=d.querySelector('a');
  node.href='/shorts/discovered';await settle(content.effect);
  assert.equal(node.style.display,'none');assert.equal(content.inactive,false);
  for(let i=0;i<5;i++)await f.core.tick();
  const b=await f.core.bundle();assert.equal(b.a.session_status,'RUNNING');
  const binding=b.bindings.find(row=>row.resolution==='NONE');assert(binding);
  assert.equal(binding.cleanup_pending,true,'active owned DOM changes retain restoration debt until END');
  assert.equal(content.coverage().hidden_candidate_count,1);
  assert.equal((await f.core.end(b.a.session_id)).session.status,'ENDED');
  const ended=await f.core.bundle();assert.equal(ended.state.journal.observed,'RELEASED');
  assert.equal(ended.bindings.some(row=>row.resolution==='NONE'||row.cleanup_pending),false);
  assert.equal(node.style.display,'inline-flex');assert.equal(node.inert,false);assert.equal(f.rules().length,0);
 }finally{for(const content of f.receivers.values()){dom.window.clearInterval(content.heartbeat);content.effect.stopEpoch();}dom.window.close();}
});
