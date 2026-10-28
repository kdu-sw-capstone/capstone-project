import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fixture} from './member-fixture.mjs';
import {A1Content} from '../member-a1/content.mjs';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
import {DocumentCoordinator} from '../execution/document-coordinator.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

for(const order of ['DOM_BEFORE_HISTORY','HISTORY_BEFORE_DOM'])test('real DOM mutation and same-document history preserve policy and END: '+order,{timeout:30000},async t=>{
 // Keep store/effect clock equal to the fixture clock during event ordering.
 // Physical deadline behaviour is covered separately by native-response-budget.
 t.mock.timers.enable({apis:['Date'],now:Date.now()});
 const dom=new JSDOM('<!doctype html><html><body><a href="/shorts/one">Shorts</a><a href="/watch?v=normal">Normal</a><div id="mount"></div></body></html>',{url:'https://www.youtube.com/watch?v=normal'}),w=dom.window,d=w.document;
 Object.defineProperty(w.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 Object.defineProperties(d.documentElement,{clientWidth:{get:()=>1265},clientHeight:{get:()=>720}});
 w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,right:1265,bottom:720,width:1265,height:720});
 const computed=w.getComputedStyle.bind(w);w.getComputedStyle=el=>el.hasAttribute('data-focurve-restriction')?{display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto'}:computed(el);
 class DOMContent extends A1Content{constructor(config,runtime,_doc,options){super(config,runtime,d,{...options,effect:new A0ShortsEffect(d,{preserveOnFailure:true})});}}
 const settle=async f=>{for(let k=0;k<10;k++){await f.core.tick();if((await f.core.bundle()).a.session_status==='RUNNING')return;}assert.fail('No RUNNING inside the existing transition');};
 try{
  const f=await fixture({experimental:true,nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true,ContentClass:DOMContent});
  f.frames[0].url=w.location.href;
  Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
  await f.core.startCommand(f.command);const engine=new DocumentCoordinator(f.core);
  for(let cycle=0;cycle<3;cycle++){
   const path='/shorts/one?cycle='+cycle;w.history.pushState({},'',path);f.frames[0].url=w.location.href;f.senderUrls.set(f.frames[0].documentId,w.location.href);
   const viewer=d.createElement('ytd-shorts'),media=d.createElement('video');let paused=false;Object.defineProperty(media,'paused',{get:()=>paused});media.pause=()=>{paused=true;};viewer.append(media);
   const history=()=>engine.event('HISTORY',{...f.frames[0],timeStamp:f.core.now()});
   if(order==='HISTORY_BEFORE_DOM')await history();
   d.querySelector('#mount').append(viewer);const effect=f.receivers.get(f.frames[0].documentId).effect;effect.refresh();await effect.pending;
   if(order==='DOM_BEFORE_HISTORY')await history();
   await settle(f);const evidence=f.receivers.get(f.frames[0].documentId).effect.evidence();
   assert.equal(evidence.error_count,0);assert.equal(evidence.paused_media_count,evidence.media_count);assert.equal(viewer.style.display,'none');assert.equal(viewer.inert,true);
   assert.notEqual(d.querySelector('a[href="/watch?v=normal"]').style.display,'none');
   w.history.pushState({},'','/watch?v=normal&cycle='+cycle);f.frames[0].url=w.location.href;f.senderUrls.set(f.frames[0].documentId,w.location.href);
   await history();await settle(f);viewer.remove();
  }
  await f.core.end(f.command.session_id);const b=await f.core.bundle();assert.equal(b.a.session_status,'ENDED');
  assert.equal(b.bindings.some(x=>x.resolution==='NONE'||x.cleanup_pending),false);assert.equal(b.state.journal.observed,'RELEASED');assert.equal(f.rules().length,0);
  assert.equal(d.querySelector('a[href="/shorts/one"]').style.display,'');
 }finally{w.close();}
});
