import test from 'node:test';
import assert from 'node:assert/strict';
import {A1Core} from '../a1/core.mjs';

function fixture(){
 const frame={frameId:0,documentId:'guest-document',documentLifecycle:'active',url:'https://www.youtube.com/watch?v=fixture'};
 const tab={id:7,status:'loading',url:frame.url};
 const core=Object.create(A1Core.prototype);Object.assign(core,{boot:'current-boot',nativeReadyDocs:new Map(),requestCheck(){},
  env:{policy:{select:()=>({site_id:'youtube',access_policy:'ALLOW',feature_policies:[{enabled:true}]})}},
  chrome:{tabs:{query:async()=>[tab]},webNavigation:{getAllFrames:async()=>[frame]}}});
 // The readiness signal is Root webNavigation, never a Content claim.
 const ready=(changes={})=>core.nativeDocumentReady?.({tabId:tab.id,...frame,...changes});
 return {core,frame,tab,ready};
}
const snapshot={sites:[]};

test('Root DOMContentLoaded allows exact active document while late subresources keep tab loading',async()=>{
 const f=fixture();f.ready();const seen=await f.core.census(snapshot);
 assert.equal(seen.required.length,1);assert.equal(seen.required[0].documentId,f.frame.documentId);
});
test('complete tab remains observable without any readiness hint',async()=>{
 const f=fixture();f.tab.status='complete';assert.equal((await f.core.census(snapshot)).required.length,1);
});
for(const kind of ['no-event','other-document','other-tab','other-url','other-boot','pending-url','subframe','cached','content-supplied-shape'])test('loading remains unconfirmed: '+kind,async()=>{
 const f=fixture();
 if(kind==='other-document')f.ready({documentId:'foreign'});
 else if(kind==='other-tab')f.ready({tabId:8});
 else if(kind==='other-url')f.ready({url:'https://www.youtube.com/watch?v=foreign'});
 else if(kind==='subframe')f.ready({frameId:1});
 else if(kind==='cached')f.ready({documentLifecycle:'cached'});
 else if(kind==='content-supplied-shape')f.ready({tabId:undefined,tab:{id:7}});
 else if(kind!=='no-event')f.ready();
 if(kind==='other-boot')f.core.boot='new-boot';
 if(kind==='pending-url')f.tab.pendingUrl='https://www.youtube.com/shorts/pending';
 await assert.rejects(f.core.census(snapshot),e=>e.message==='REVALIDATION_REQUIRED'&&e.cause.stage==='ROOT_NATIVE_CENSUS');
});
test('readiness never extends the five-second native fence',()=>{
 const f=fixture();f.core.profile='profile';f.core.now=()=>5000;f.ready();
 const a={native_transition_contract:'NR01_1',native_transition:{version:'NR01_1',phase:'VERIFYING',profile:'profile',boot:f.core.boot,started_at:0,deadline_at:5000,last_seen_at:0}};
 assert.throws(()=>f.core.nrCheck(a),/REVALIDATION_REQUIRED/);assert.equal(a.native_transition.deadline_at,5000);
});
