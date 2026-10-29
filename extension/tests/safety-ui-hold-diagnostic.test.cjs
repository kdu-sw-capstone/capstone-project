'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
async function observe(marker,{appearsLater=false,stateAudit,firstAudit}={}){
 let click,reads=0,coreReads=0;const audits=[];const output={};const before=JSON.stringify(marker);
 const reader={create:()=>({observe:async()=>{coreReads++;return {gate:'CLEAR_LOCAL_ONLY'};},...(stateAudit?{auditPendingState:async id=>{audits.push(id);return stateAudit;}}:{}),...(firstAudit?{auditFirstFailure:async()=>{audits.push('FIRST_FAILURE');return firstAudit;}}:{}),cancel(){}})};
 const world={Date,JSON,Set,Number,Array,chrome:{storage:{local:{get:async()=>({focurve_member_auth:{phase:'LINKED'},focurve_user_ui_hold:appearsLater&&++reads===1?null:marker}),set(){throw Error('WRITE_FORBIDDEN');},remove(){throw Error('REMOVE_FORBIDDEN');}}}},R2LocalSafety:reader,FocurveGuestSafety:reader,indexedDB:{},crypto:{},location:{},document:{querySelector:id=>id==='#result'?output:{addEventListener:(event,fn)=>click=fn}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../safety/ui.js'),'utf8'),world);await click();
 assert.equal(JSON.stringify(marker),before);return {result:JSON.parse(output.textContent),coreReads,audits};
}
for(const action of ['STATE','START','END'])test(`held ${action} request remains UNKNOWN without storage writes or core observation`,async()=>{
 const {result,coreReads}=await observe({action,requestId:'12345678-1234-1234-1234-123456789abc',atUTC:'2026-10-27T00:00:00.000Z',unconfirmed:true,token:'must-not-output'});
 assert.equal(result.gate,'UNKNOWN');assert.equal(result.counts,null);assert.deepEqual(result.identity,{});assert.equal(coreReads,0);
 assert.equal(result.unconfirmedOperation.action,action);assert.equal(result.unconfirmedOperation.classification,action==='STATE'?'QUERY_REQUEST':'MUTATION_REQUEST');
 assert.equal(result.unconfirmedOperation.requestId,'12345678-1234-1234-1234-123456789abc');assert(!JSON.stringify(result).includes('must-not-output'));
});
test('invalid diagnostic values are never copied to the result',async()=>{
 const {result}=await observe({action:'private-secret-value',requestId:'secret-token',atUTC:'private-path',nested:{password:'private-password'}});
 assert.equal(result.unconfirmedOperation.action,'UNRECOGNIZED');assert.equal(result.unconfirmedOperation.classification,'UNKNOWN');
 assert(!JSON.stringify(result).includes('private'));assert(!Object.hasOwn(result.unconfirmedOperation,'requestId'));
});
test('a marker appearing during observation still replaces CLEAR with UNKNOWN',async()=>{
 const {result,coreReads}=await observe({action:'STATE',unconfirmed:true},{appearsLater:true});
 assert.equal(coreReads,1);assert.equal(result.gate,'UNKNOWN');assert.equal(result.counts,null);assert.equal(result.unconfirmedOperation.action,'STATE');
});

test('held STATE uses only its exact negative audit without ordinary Core observation or marker changes',async()=>{
 const marker={action:'STATE',requestId:'e7e02f37-9037-4cf8-a1a9-06d2ace7b45a',unconfirmed:true};
 const {result,coreReads,audits}=await observe(marker,{stateAudit:{contract:'R4_STATE_LEDGER_AUDIT_1',gate:'UNKNOWN',auditOnly:true,counts:{sessionRules:2}}});
 assert.equal(result.gate,'UNKNOWN');assert.equal(result.counts.sessionRules,2);assert.equal(coreReads,0);assert.deepEqual(audits,[marker.requestId]);
});

test('STATE audit cannot replace a held result with CLEAR or be called for END',async()=>{
 const marker={action:'STATE',requestId:'e7e02f37-9037-4cf8-a1a9-06d2ace7b45a',unconfirmed:true};
 const invalid={contract:'R4_STATE_LEDGER_AUDIT_1',gate:'CLEAR_LOCAL_ONLY'};
 const r=await observe(marker,{stateAudit:invalid});assert.equal(r.result.contract,'R4_UI_HOLD_1');assert.equal(r.result.gate,'UNKNOWN');
 const end=await observe({...marker,action:'END'},{stateAudit:invalid});assert.deepEqual(end.audits,[]);
});


test('existing inspect button extracts a stored first failure on a held operation without ordinary Worker observation',async()=>{
 const audit={contract:'R4_FIRST_FAILURE_AUDIT_1',gate:'UNKNOWN',auditOnly:true,identity:{installation:true},firstFailure:{status:'STORED_FIRST_FAILURE',code:'STORE_UNCONFIRMED',stage:'CONTENT_RESPONSE_WAIT',requestId:'11111111-1111-4111-8111-111111111111'}};
 const {result,coreReads,audits}=await observe({action:'UNRECOGNIZED',unconfirmed:true},{firstAudit:audit});
 assert.deepEqual(result,audit);assert.equal(coreReads,0);assert.deepEqual(audits,['FIRST_FAILURE']);
});

test('diagnostic extraction cannot substitute CLEAR or unverified identity for an existing hold',async()=>{
 for(const firstAudit of [{contract:'R4_FIRST_FAILURE_AUDIT_1',gate:'CLEAR_LOCAL_ONLY',auditOnly:true,identity:{installation:true}},{contract:'R4_FIRST_FAILURE_AUDIT_1',gate:'UNKNOWN',auditOnly:true,identity:{installation:false}}]){
  const {result}=await observe({action:'END',unconfirmed:true},{firstAudit});assert.equal(result.contract,'R4_UI_HOLD_1');assert.equal(result.gate,'UNKNOWN');
 }
});
