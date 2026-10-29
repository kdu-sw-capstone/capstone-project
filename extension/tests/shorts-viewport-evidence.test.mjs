import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {A0ShortsEffect} from '../a0/shorts-effect.mjs';
import {ShortsControl} from '../content/shorts.mjs';
import {confirmedEffect} from '../a0/contract.mjs';
import {fixture as memberFixture} from './member-fixture.mjs';
import {A1Content as MemberContent} from '../member-a1/content.mjs';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

// Native geometry is simulated from CSSOM's distinct viewport/scrollbar sizes.
// This reproduces a source defect, not the unrecorded geometry of the user tab.
function fixture({scrollbar=15,horizontalScrollbar=0,shorts=true,noticeWidth,noticeHeight,noticeLeft=0,noticeTop=0,noticeStyle={},pauseFails=false}={}){
 const dom=new JSDOM('<!doctype html><html><body><a href="/shorts/test">Shorts</a><a href="/watch?v=normal">Normal</a><ytd-shorts style="display:grid"><video></video></ytd-shorts></body></html>',{url:shorts?'https://www.youtube.com/shorts/test':'https://www.youtube.com/results?search_query=test'});
 const {document:d}=dom.window,w=dom.window;Object.defineProperties(w,{innerWidth:{value:1280,configurable:true},innerHeight:{value:720,configurable:true}});
 // JSDOM omits the native inert=false IDL default required by the ledger schema.
 Object.defineProperty(w.HTMLElement.prototype,'inert',{value:false,writable:true,configurable:true});
 Object.defineProperties(d.documentElement,{clientWidth:{get:()=>1280-scrollbar,configurable:true},clientHeight:{get:()=>720-horizontalScrollbar,configurable:true}});
 const geometry={left:noticeLeft,top:noticeTop,width:noticeWidth??1280-scrollbar,height:noticeHeight??720-horizontalScrollbar};
 w.HTMLElement.prototype.getBoundingClientRect=()=>({right:geometry.left+geometry.width,bottom:geometry.top+geometry.height,...geometry});
 const computed=w.getComputedStyle.bind(w);w.getComputedStyle=el=>el.hasAttribute('data-focurve-restriction')?{display:'block',visibility:'visible',opacity:'1',pointerEvents:'auto',...noticeStyle}:computed(el);
 const media=d.querySelector('video');Object.defineProperty(media,'paused',{get:()=>!pauseFails,configurable:true});media.pause=()=>{};
 return {dom,d,w,geometry,close:()=>w.close()};
}
for(const scrollbar of [0,15])test('full document viewport remains verified with '+scrollbar+'px vertical scrollbar',async()=>{
 const f=fixture({scrollbar});try{const effect=new A0ShortsEffect(f.d,{preserveOnFailure:true});const result=await effect.start(async()=>{});
 assert.equal(result.result_state,'APPLIED');assert.equal(result.evidence.error_count,0);assert.equal(confirmedEffect(result.evidence),true);
 assert.equal((await effect.release()).owned_changes_restored,true);assert.equal(f.d.querySelector('ytd-shorts').style.display,'grid');
 }finally{f.close();}
});
test('full document viewport with horizontal scrollbar is also covered',async()=>{
 const f=fixture({horizontalScrollbar:15});try{const effect=new A0ShortsEffect(f.d,{preserveOnFailure:true});assert.equal((await effect.start(async()=>{})).result_state,'APPLIED');await effect.release();}finally{f.close();}
});
for(const options of [{noticeWidth:1264},{noticeHeight:719},{noticeStyle:{pointerEvents:'none'}},{noticeStyle:{opacity:'0'}},{pauseFails:true}])test('genuine incomplete control still fails: '+JSON.stringify(options),async()=>{
 const f=fixture(options);try{const effect=new A0ShortsEffect(f.d,{preserveOnFailure:true});const result=await effect.start(async()=>{});
 assert.equal(result.result_state,'APPLY_FAILED');assert.equal(result.evidence.error_count,1);assert.equal(confirmedEffect(result.evidence),false);
 assert.equal(effect.control.changes.size>0,true);assert.equal((await effect.release()).owned_changes_restored,true);
 }finally{f.close();}
});
test('search results, SPA Shorts entry, removed node, and normal video restoration use owned changes only',()=>{
 const f=fixture({shorts:false});try{
 const control=new ShortsControl(f.d),short=f.d.querySelector('a[href^="/shorts"]'),normal=f.d.querySelector('a[href^="/watch"]');
 control.apply();assert.equal(short.style.display,'none');assert.notEqual(normal.style.display,'none');assert(!control.notice);
 f.w.history.pushState({},'', '/shorts/test');assert.equal(control.apply().status,'SUPPORTED');assert.equal(f.d.querySelector('video').paused,true);
 short.remove();f.w.history.pushState({},'', '/watch?v=normal');control.apply();assert.equal(control.notice,null);
 assert.equal(control.release(),true);assert.equal(short.style.display,'');assert.equal(f.d.querySelector('ytd-shorts').style.display,'grid');assert.notEqual(normal.style.display,'none');
 }finally{f.close();}
});
test('zero viewport measurements remain unconfirmed rather than falling back to an assumed success',()=>{
 const f=fixture();try{Object.defineProperty(f.d.documentElement,'clientWidth',{value:0});const c=new ShortsControl(f.d);assert.equal(c.apply().status,'FAILED');assert.equal(c.lastApplyFailure.code,'NOTICE_VIEWPORT_UNCONFIRMED');assert.equal(c.release(),true);}finally{f.close();}
});
test('failure logging does not mask a real failed control or clear its restoration ledger',async t=>{
 const f=fixture({noticeWidth:1264});t.mock.method(console,'error',()=>{throw Error('LOG_SINK_FAILED');});try{const e=new A0ShortsEffect(f.d,{preserveOnFailure:true});const r=await e.start(async()=>{});assert.equal(r.result_state,'APPLY_FAILED');assert.equal(r.evidence.error_count,1);assert.equal(e.control.lastApplyFailure.code,'NOTICE_VIEWPORT_NOT_COVERED');assert.equal(e.control.changes.size>0,true);await e.release();}finally{f.close();}
});
test('real Content effect with scrollbar geometry passes Core ACK and explicit END restoration',async()=>{
 const doms=[];class ViewportContent extends MemberContent{constructor(config,runtime,_document,options){const dom=fixture();doms.push(dom);super(config,runtime,dom.d,{...options,effect:new A0ShortsEffect(dom.d,{preserveOnFailure:true})});}}
 try{const f=await memberFixture({ContentClass:ViewportContent,p1:true,d1b5:true,limitedProduct11:true});await f.core.startCommand(f.command);
 assert.equal((await f.core.bundle()).a.session_status,'RUNNING');assert.equal(f.receivers.get('document-0').effect.evidence().error_count,0);
 await f.core.end(f.command.session_id);assert.equal((await f.core.bundle()).a.session_status,'ENDED');assert.equal((await f.core.bundle()).bindings.some(b=>b.cleanup_pending||b.resolution==='NONE'),false);assert.equal(doms[0].d.querySelector('ytd-shorts').style.display,'grid');
 }finally{for(const dom of doms)dom.close();}
});


for(const options of [{noticeLeft:1},{noticeTop:1},{noticeLeft:-1},{noticeTop:-1}])test('a displaced notice cannot claim full viewport coverage: '+JSON.stringify(options),async()=>{
 const f=fixture(options);try{const effect=new A0ShortsEffect(f.d,{preserveOnFailure:true});const r=await effect.start(async()=>{});
 assert.equal(r.result_state,'APPLY_FAILED');assert.equal(confirmedEffect(r.evidence),false);assert.equal(effect.control.lastApplyFailure.code,'NOTICE_VIEWPORT_NOT_COVERED');
 assert.equal((await effect.release()).owned_changes_restored,true);
 }finally{f.close();}
});
