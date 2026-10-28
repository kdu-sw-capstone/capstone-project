import test from 'node:test';
import assert from 'node:assert/strict';
import {MemberA1Adapter} from '../integration/member-a1-adapter.mjs';

async function attempt(code,diagnosticCode){
 const calls=[],failure=Error('PRIVATE_UNBOUNDED_ERROR');
 const adapter=Object.create(MemberA1Adapter.prototype);
 Object.assign(adapter,{tickInnerBody:async()=>{throw failure;},core:{firstFailureDiagnostic:{code:diagnosticCode},bundle:async()=>({a:{session_status:'UNKNOWN'},state:{session:{last_error_code:code}}})},read:async()=>({command:{command_id:'fixed-command'}}),report:async(...args)=>calls.push(args),flush:async()=>calls.push(['flush'])});
 await assert.rejects(adapter.tickInner(),e=>e===failure);
 return calls;
}
test('durable first failure is carried by the existing UNCONFIRMED report',async()=>{
 const calls=await attempt('REVALIDATION_REQUIRED','STORE_UNCONFIRMED');
 assert.deepEqual(calls,[[{command_id:'fixed-command'},'UNCONFIRMED',{errorCode:'REVALIDATION_REQUIRED'}],['flush']]);
});
test('bounded ephemeral failure is used only when no durable failure exists',async()=>{
 const calls=await attempt(undefined,'OWNER_MISMATCH');
 assert.equal(calls[0][2].errorCode,'OWNER_MISMATCH');
});
test('raw or unrecognized failures never escape and existing UNKNOWN report still remains',async()=>{
 const calls=await attempt('PRIVATE_TOKEN_SENTINEL','REVALIDATION_REQUIRED');
 assert.deepEqual(calls[0][2],{});assert(!JSON.stringify(calls).includes('PRIVATE'));
});
