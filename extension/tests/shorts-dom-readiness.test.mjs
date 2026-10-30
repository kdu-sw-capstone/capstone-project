import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {fixture} from './member-fixture.mjs';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
import {A1Content as MemberContent} from '../member-a1/content.mjs';
import {A1Content as GuestContent} from '../a1/content.mjs';

async function settle(effect){
 await new Promise(resolve=>setImmediate(resolve));
 for(let pending;;){pending=effect.pending;await pending;if(pending===effect.pending)break;}
}
async function prepared(t,guest){
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const dom=new JSDOM('<!doctype html><ytd-shorts style="display:grid"><video></video></ytd-shorts>',{url:'https://www.youtube.com/shorts/test'}),w=dom.window,d=w.document;
 Object.defineProperty(w.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 Object.defineProperties(d.documentElement,{clientWidth:{value:1280},clientHeight:{value:720}});
 w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,right:1280,bottom:720,width:1280,height:720});
 const computed=w.getComputedStyle.bind(w);w.getComputedStyle=el=>el.hasAttribute('data-focurve-restriction')?{display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto'}:computed(el);
 w.HTMLMediaElement.prototype.pause=function(){Object.defineProperty(this,'paused',{value:true,configurable:true});};
 const Base=guest?GuestContent:MemberContent;
 class Content extends Base{constructor(config,runtime,_document,options){super(config,runtime,d,{...options,effect:new A0ShortsEffect(d,{preserveOnFailure:true})});}}
 const f=await fixture({guest,ContentClass:Content,dp01:true,nr01:true,nd01:true,p1:true,d1b5:true,limitedProduct11:true});
 f.frames[0].url=d.location.href;
 Object.assign(f.command,{dom_transition_contract:'DP01_1',native_transition_contract:'NR01_1',document_transition_contract:'ND01_1'});
 t.after(()=>{clearTimeout(f.core.dom?.timer);for(const c of f.receivers.values()){w.clearInterval(c.heartbeat);c.effect.stopEpoch();}w.close();});
 if(guest)await f.core.start(3,crypto.randomUUID());else await f.core.startCommand(f.command);
 const actor=f.receivers.get('document-0');assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
 const next=d.createElement('ytd-shorts');next.style.display='flex';d.querySelector('ytd-shorts').replaceWith(next);
 await settle(actor.effect);
 return {f,actor,next,w};
}

for(const guest of [false,true]){
 const name=guest?'guest':'member';
 test(name+' replacement viewer waits for media within the original DOM grant, then confirms and restores',async t=>{
  const {f,actor,next,w}=await prepared(t,guest),pending=await f.core.bundle();
  assert.equal(actor.effect.evidence().media_count,0);
  assert.equal(actor.effect.evidence().error_count,0);
  assert.equal(actor.inactive,false,'an incomplete player must not commit invalid DOM_CONFIRM or stop observation');
  assert.equal(pending.a.session_status,'EFFECT_VERIFYING');
  assert.equal(pending.a.effect_transition.grants[0].phase,'OPEN');
  assert.equal(pending.bindings[0].cleanup_pending,true);
  const deadline=pending.a.effect_transition.deadline_at,generation=pending.a.generation;
  next.append(w.document.createElement('video'));await settle(actor.effect);
  const confirmed=await f.core.bundle();
  assert.equal(confirmed.a.effect_transition.grants[0].phase,'CONFIRMED');
  assert.equal(confirmed.a.effect_transition.deadline_at,deadline);
  assert.equal(confirmed.a.generation,generation);
  await actor.checkpoint(true);
  assert.equal((await f.core.bundle()).a.effect_transition.grants[0].phase,'CONFIRMED','duplicate observation does not create a second confirmation');
  await f.core.tick();assert.equal((await f.core.bundle()).a.session_status,'RUNNING');
  await f.core.end(confirmed.a.session_id);
  const ended=await f.core.bundle();assert.equal(ended.a.session_status,'ENDED');
  assert.equal(ended.state.journal.observed,'RELEASED');
  assert.equal(ended.bindings.some(b=>b.resolution==='NONE'||b.cleanup_pending),false);
  assert.equal(next.style.display,'flex');assert.equal(next.inert,false);
 });
 test(name+' absent media never confirms and expires with restoration obligations intact',async t=>{
  const {f,actor}=await prepared(t,guest),pending=await f.core.bundle();
  assert.equal(pending.a.session_status,'EFFECT_VERIFYING');assert.equal(actor.inactive,false);
  t.mock.timers.tick(3001);f.advance(3001);
  await assert.rejects(f.core.tick(),{message:'REVALIDATION_REQUIRED'});
  const after=await f.core.bundle();assert.equal(after.a.session_status,'UNKNOWN');
  assert.equal(after.state.journal.desired,'APPLIED');assert.notEqual(after.state.journal.observed,'RELEASED');
  assert.equal(after.bindings[0].cleanup_pending,true);assert(after.bindings[0].ledger.length>=2);
  assert.equal(after.a.effect_transition.deadline_at,pending.a.effect_transition.deadline_at);
  assert.notEqual(after.a.effect_transition.grants[0].phase,'CONFIRMED');
 });
 test(name+' Root still rejects an explicitly submitted media-less DOM_CONFIRM',async t=>{
  const {f,actor}=await prepared(t,guest),b=await f.core.bundle();
  const op=(await f.core.registry.rows()).find(r=>r.phase==='COMPLETED'&&r.command?.payload.operation==='APPLY');
  await assert.rejects(actor.client.commit({kind:'DOM_CONFIRM',dom_cap:actor.client.domCapability,operation_id:op.operation_id,round_id:op.command.payload.round_id,effect_evidence:actor.effect.evidence(),coverage_evidence:null,observed_at:new Date().toISOString()}),{message:'INVALID_EFFECT_EVIDENCE'});
  const after=await f.core.bundle();assert.equal(after.a.session_status,'UNKNOWN');
  assert.equal(after.state.journal.desired,'APPLIED');assert.notEqual(after.state.journal.observed,'RELEASED');
  assert.equal(after.bindings[0].cleanup_pending,true);assert.equal(after.bindings[0].ledger.length,b.bindings[0].ledger.length);
 });
 for(const reason of ['scan error','unhidden viewer','non-inert viewer','malformed evidence'])test(name+' media readiness wait does not suppress '+reason,async t=>{
  const {f,actor}=await prepared(t,guest),evidence=actor.effect.evidence();
  if(reason==='scan error')evidence.error_count=1;
  if(reason==='unhidden viewer')evidence.hidden_viewer_count=0;
  if(reason==='non-inert viewer')evidence.inert_viewer_count=0;
  if(reason==='malformed evidence')delete evidence.observer_ready;
  actor.effect.evidence=()=>evidence;await actor.checkpoint(true);
  assert.equal(actor.inactive,true);assert.equal(actor.effect.running,false);
  if(reason==='malformed evidence'){
   // Schema rejection cannot confirm effects. Root's original bounded grant
   // expires even when a rejected sender cannot subsequently invalidate it.
   assert.notEqual((await f.core.bundle()).a.session_status,'RUNNING');
   t.mock.timers.tick(3001);f.advance(3001);
   await assert.rejects(f.core.tick(),{message:'REVALIDATION_REQUIRED'});
  }
  const after=await f.core.bundle();assert.equal(after.a.session_status,'UNKNOWN');
  assert.equal(after.bindings[0].cleanup_pending,true);assert(after.bindings[0].ledger.length>=2);
  assert.notEqual(after.state.journal.observed,'RELEASED');
 });
}
