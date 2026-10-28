import test from 'node:test';
import assert from 'node:assert/strict';
import {A1Core} from '../member-a1/core.mjs';

function core(){
 let time=1000;
 const c=Object.create(A1Core.prototype);
 Object.assign(c,{now:()=>time,nrCheck:()=>{},registry:{issue:async()=>{}},env:{},chrome:{tabs:{sendMessage:async()=>{}}}});
 return {c,advance:ms=>{time+=ms;}};
}

test('runtime Content transport loss is labelled at the actual wait, without replacing the error or cause',async()=>{
 const {c,advance}=core(),cause={secret:'never export'},error=Error('STORE_UNCONFIRMED',{cause});
 c.chrome.tabs.sendMessage=async()=>{advance(80);throw error;};
 await assert.rejects(c.dispatch({scope:{tab_id:1,document_id:'document'}},{native_transition:{phase:'FRESH_APPLY'}},{payload:{operation:'APPLY'}}),e=>e===error);
 assert.equal(error.cause,cause);c.captureFirstFailure(error);
 assert.equal(c.firstFailureDiagnostic.stage,'CONTENT_RESPONSE_WAIT');
 assert.equal(c.firstFailureDiagnostic.code,'STORE_UNCONFIRMED');
 assert.equal(c.firstFailureDiagnostic.transition_phase,'FRESH_APPLY');
 assert.equal(c.firstFailureDiagnostic.wait_started_at,1000);assert.equal(c.firstFailureDiagnostic.wait_finished_at,1080);
 assert(!JSON.stringify(c.firstFailureDiagnostic).includes('never export'));
 const first=c.firstFailureDiagnostic;c.captureFirstFailure(Error('OWNER_MISMATCH'));assert.equal(c.firstFailureDiagnostic,first);
});

test('publication deadline keeps its native guard code and adds the publication wait boundary',async()=>{
 const {c,advance}=core();let checks=0;
 c.nrCheck=()=>{if(++checks===2)throw Error('REVALIDATION_REQUIRED',{cause:{stage:'NATIVE_TRANSITION_GUARD',rejected_fields:['deadline_at'],transition_phase:'FRESH_APPLY'}});};
 const a={native_transition:{phase:'FRESH_APPLY',deadline_at:6000}};let error;
 try{await c.waitNativePublication(a,async()=>advance(5001));}catch(e){error=e;}
 assert.equal(error.message,'REVALIDATION_REQUIRED');c.captureFirstFailure(error);
 assert.equal(c.firstFailureDiagnostic.stage,'NATIVE_TRANSITION_GUARD');
 assert.equal(c.firstFailureDiagnostic.wait_stage,'REPORT_PUBLICATION_WAIT');
 assert.deepEqual([...c.firstFailureDiagnostic.rejected_fields],['deadline_at']);
 assert.equal(c.firstFailureDiagnostic.wait_finished_at,6001);assert.equal(a.native_transition.deadline_at,6000);
});

test('a failed diagnostic annotation cannot mask a frozen transport error',async()=>{
 const {c}=core(),error=Object.freeze(Error('STORE_UNCONFIRMED'));
 c.chrome.tabs.sendMessage=async()=>{throw error;};
 await assert.rejects(c.dispatch({scope:{tab_id:1,document_id:'document'}},{},{payload:{operation:'QUERY'}}),e=>e===error);
});

test('an unknown stage is explicitly unclassified instead of claiming START_APPLY',()=>{
 const {c}=core();c.captureFirstFailure(Error('STORE_UNCONFIRMED',{cause:{stage:'secret raw text',rejected_fields:['secret raw text']}}));
 assert.equal(c.firstFailureDiagnostic.stage,'UNCLASSIFIED_STAGE');
 assert(!JSON.stringify(c.firstFailureDiagnostic).includes('secret raw text'));
 assert.equal(c.firstFailureDiagnostic.authority_granted,false);
});
