import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './member-fixture.mjs';
import {control} from '../member-a1/domain.mjs';
import {control as guestControl} from '../a1/domain.mjs';

async function pending(guest){
 const f=await fixture({guest,nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 if(guest)await f.core.start(3,crypto.randomUUID());else await f.core.startCommand(f.command);
 await f.core.nrBegin(await f.core.bundle());return f;
}
for(const guest of [false,true])for(const stage of ['CONTENT','P1'])test(`${guest?'guest':'member'} ${stage} response wait cannot restart five seconds near an existing NR deadline`,async t=>{
 const f=await pending(guest);f.advance(4900);
 let entered;const sent=new Promise(resolve=>entered=resolve);
 f.chrome.tabs.sendMessage=()=>{entered();return new Promise(()=>{});};
 t.mock.timers.enable({apis:['setTimeout']});let result;
 const b=await f.core.bundle(),binding=b.bindings[0];
 const waiting=(stage==='P1'?f.core.p1.attest(binding,{revalidate:true}):f.core.dispatch(binding,b.a,(guest?guestControl:control)(binding,b.a,'QUERY'))).then(()=>{result='RESOLVED';},e=>{result=e.message;});
 await sent;f.advance(100);t.mock.timers.tick(100);
 for(let i=0;i<30;i++)await Promise.resolve();
 const atOriginalDeadline=result;
 // Settle the old implementation too, so a failing before-test leaks no timer.
 t.mock.timers.tick(5000);await waiting;
 assert.equal(atOriginalDeadline,'REVALIDATION_REQUIRED');
 assert.equal((await f.core.bundle()).a.native_transition.deadline_at,b.a.native_transition.deadline_at);
});

for(const guest of [false,true])for(const stage of ['CONTENT','P1'])test(`${guest?'guest':'member'} explicit END keeps the original ${stage} cleanup timeout after NR expiry`,async t=>{
 const f=await pending(guest),sid=(await f.core.bundle()).a.session_id;await f.core.endIntent(sid);f.advance(6000);
 let entered;const sent=new Promise(resolve=>entered=resolve);f.chrome.tabs.sendMessage=()=>{entered();return new Promise(()=>{});};
 t.mock.timers.enable({apis:['setTimeout']});let result;
 const b=await f.core.bundle(),binding=b.bindings[0];
 const work=(stage==='P1'?f.core.p1.attest(binding,{revalidate:true}):f.core.dispatch(binding,b.a,(guest?guestControl:control)(binding,b.a,'QUERY'))).then(()=>{result='RESOLVED';},e=>{result=e.message;});
 await sent;t.mock.timers.tick(4999);for(let i=0;i<20;i++)await Promise.resolve();assert.equal(result,undefined);
 t.mock.timers.tick(1);await work;assert.equal(result,'STORE_UNCONFIRMED');assert.equal((await f.core.bundle()).a.intent,'END');
});
