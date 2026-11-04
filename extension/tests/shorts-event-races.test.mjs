import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');
const turn=()=>new Promise(r=>setImmediate(r));
function setup(){
 const dom=new JSDOM('<!doctype html><a id="short" href="/shorts/a" style="display:inline-flex"></a><a id="normal" href="/watch?v=a"></a>',{url:'https://www.youtube.com/'});
 const d=dom.window.document;Object.defineProperty(dom.window.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 return {dom,d,e:new A0ShortsEffect(d,{preserveOnFailure:true})};
}
test('release during pending ledger and replacement blocks late apply and play listener',async()=>{
 const {dom,d,e}=setup();let unlock,entered;const waiting=new Promise(r=>entered=r),gate=new Promise(r=>unlock=r);
 try{
 const starting=e.start(async()=>{entered();await gate;});await waiting;
 const released=e.release();const next=d.createElement('a');next.href='/shorts/b';next.style.display='grid';d.querySelector('#short').replaceWith(next);
 unlock();await starting;const r=await released;await turn();
 assert.equal(r.owned_changes_restored,true);assert.equal(next.style.display,'grid');assert.equal(e.control.changes.size,0);assert.equal(e.control.active,false);assert.equal(e.running,false);
 let pauses=0;const viewer=d.createElement('ytd-shorts'),v=d.createElement('video');v.pause=()=>pauses++;viewer.append(v);d.body.append(viewer);dom.window.history.pushState({},'','/shorts/b');v.dispatchEvent(new dom.window.Event('play',{bubbles:true}));await turn();assert.equal(pauses,0);assert.equal(next.style.display,'grid');
 }finally{await e.release();dom.window.close();}
});
test('revocation while replacement scan awaits ledger retains old debt and never hides new target',async()=>{
 const {dom,d,e}=setup();let block=false,unlock,entered;const waiting=new Promise(r=>entered=r),gate=new Promise(r=>unlock=r);
 try{
 await e.start(async()=>{if(block){entered();await gate;}});assert.equal(d.querySelector('#short').style.display,'none');
 block=true;const next=d.createElement('a');next.href='/shorts/b';next.style.display='grid';d.body.append(next);await waiting;
 e.stopEpoch();unlock();await e.pending;assert.equal(next.style.display,'grid');assert.equal(e.control.changes.size,1);assert.equal(d.querySelector('#short').style.display,'none');
 const r=await e.release();assert.equal(r.owned_changes_restored,true);assert.equal(d.querySelector('#short').style.display,'inline-flex');assert.equal(d.querySelector('#normal').style.display,'');
 }finally{await e.release();dom.window.close();}
});
test('restore failure preserves fixed ledger goal across concurrent retries and keeps unowned node',async()=>{
 const {dom,d,e}=setup();const target=d.querySelector('#short'),other=d.querySelector('#normal');let deny=true;
 try{
 await e.start(async()=>{});const real=target.style.setProperty.bind(target.style);
 target.style.setProperty=(...args)=>{if(deny&&args[0]==='display'&&args[1]==='inline-flex')throw Error('SYNTHETIC_RESTORE_FAILURE');return real(...args);};
 const first=await e.release();assert.equal(first.owned_changes_restored,false);assert.equal(first.remaining_owned_changes,1);
 // Pending RESTORE has a fixed goal; an ambiguous intermediate write cannot replace it.
 deny=false;target.style.setProperty('display','flex');other.style.setProperty('display','block','important');
 const results=await Promise.all([e.release(),e.release()]);assert(results.every(r=>r.owned_changes_restored));assert.equal(target.style.display,'inline-flex');assert.equal(other.style.getPropertyPriority('display'),'important');assert.equal(other.style.display,'block');assert.equal(e.control.changes.size,0);
 }finally{deny=false;await e.release();dom.window.close();}
});

test('page edit without pending restore remains the cleanup baseline',async()=>{const {dom,d,e}=setup();try{await e.start(async()=>{});e.stopEpoch();d.querySelector('#short').style.setProperty('display','flex');const r=await e.release();assert(r.owned_changes_restored);assert.equal(d.querySelector('#short').style.display,'flex');}finally{await e.release();dom.window.close();}});
