'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto'),{JSDOM}=require('jsdom');
const popup=fs.readFileSync(path.join(__dirname,'../popup/popup.js'),'utf8'),code=popup.match(/function focusErrorCode\(error\)\{[\s\S]*?\n\}/)[0],gate=fs.readFileSync(path.join(__dirname,'../popup/guest-user-gate.js'),'utf8');
const key='focurve_user_ui_hold';
async function fixture(t,operation){
 const dom=new JSDOM('<div id="focus-page"><button id="start"></button><button id="end"></button><button id="request-end"></button><button class="account-button"></button><p id="focus-feedback"></p></div>',{url:'chrome-extension://'+'a'.repeat(32)+'/popup/popup.html',runScripts:'outside-only'}),w=dom.window,storage={focurve_installation_ready_launch:'b'.repeat(32)},calls=[];
 w.FOCURVE_DEPLOYMENT={launchId:'b'.repeat(32)};w.startFocus=w.document.getElementById('start');w.endFocus=w.document.getElementById('end');w.focusVerified=true;w.focusSession={status:'RUNNING'};
 Object.defineProperty(w,'crypto',{value:{randomUUID}});w.navigator.locks={request:async(_n,_o,f)=>f({})};
 w.chrome={storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(k=>Object.hasOwn(storage,k)).map(k=>[k,structuredClone(storage[k])])),set:async values=>Object.assign(storage,structuredClone(values)),remove:async k=>{delete storage[k];}},onChanged:{addListener(){}}}};
 w.siteRequest=async(type,payload,id)=>{calls.push({type,payload,id});return operation(type,payload,id);};w.eval(code);w.eval(gate);await new Promise(r=>setTimeout(r,0));
 t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});return {w,storage,calls};
}

function renderGuest(f,status='RUNNING'){
 const source=fs.readFileSync(path.join(__dirname,'../popup/popup-ui.js'),'utf8');
 const render=source.slice(source.indexOf(' function renderFocus(){'),source.indexOf(' window.FocurvePopupUI='));
 for(const [,id] of render.matchAll(/\$\('([^']+)'\)/g))if(!f.w.document.getElementById(id)){const node=f.w.document.createElement('div');node.id=id;f.w.document.getElementById('focus-page').append(node);}
 Object.assign(f.w,{focusSession:{status,planned_end_at:new Date(Date.now()+60000).toISOString()},focusVerified:true,focusBusy:false,focusActionError:'',focusStates:{},page:'focus',preparing:false,previousStatus:null});
 f.w.eval("const $=id=>document.getElementById(id);const terminal=s=>['ENDED','INTERRUPTED','START_FAILED'].includes(s);function summary(){}"+render+';renderFocus();');
}

test('guest visible END is restored after readiness disabled it, without sending END',async t=>{
 const f=await fixture(t,()=>({status:'RUNNING'}));
 f.w.document.getElementById('request-end').disabled=true;
 renderGuest(f);
 assert.equal(f.w.document.getElementById('request-end').disabled,false);
 assert.equal(f.w.endFocus.disabled,false);assert.equal(f.calls.length,0);
});

test('uncertain guest operation still blocks visible END after a running render',async t=>{
 const f=await fixture(t,()=>{throw Error('RESPONSE_UNCONFIRMED');});
 await assert.rejects(f.w.siteRequest('DEV_SESSION_STATE'),/RESPONSE_UNCONFIRMED/);
 renderGuest(f);await new Promise(r=>setTimeout(r,0));
 assert.equal(f.w.document.getElementById('request-end').disabled,true);
 assert.equal(f.w.endFocus.disabled,true);
 await assert.rejects(f.w.siteRequest('DEV_SESSION_END',{}),/USER_OPERATION_UNCONFIRMED/);
 assert.equal(f.calls.length,1);
});
test('guest first mutation rejection preserves its request ID, action and bounded code',async t=>{
 const f=await fixture(t,()=>{throw Error('INVALID_SNAPSHOT');}),id=randomUUID();await assert.rejects(f.w.siteRequest('DEV_SESSION_START',{duration_minutes:2},id),/INVALID_SNAPSHOT/);
 assert.equal(f.calls[0].id,id);assert.equal(f.storage[key].requestId,id);assert.equal(f.storage[key].action,'DEV_SESSION_START');assert.equal(f.storage[key].errorCode,'INVALID_SNAPSHOT');assert.equal(f.storage[key].unconfirmed,true);
 assert.match(f.w.document.getElementById('focus-feedback').textContent,/INVALID_SNAPSHOT/);
 const first=structuredClone(f.storage[key]);await assert.rejects(f.w.siteRequest('DEV_SESSION_STATE'),/INVALID_SNAPSHOT/);assert.deepEqual(f.storage[key],first);
});
test('generated request ID is the same in the pending marker and actual worker call',async t=>{
 const f=await fixture(t,()=>{throw Error('RELEASE_UNCONFIRMED');});await assert.rejects(f.w.siteRequest('DEV_SESSION_END',{}),/RELEASE_UNCONFIRMED/);assert.equal(f.storage[key].requestId,f.calls[0].id);assert.match(f.calls[0].id,/^[a-f0-9-]{36}$/);
});
test('normal acknowledged mutation removes only its ordinary pending marker',async t=>{
 const f=await fixture(t,()=>({status:'RUNNING'}));assert.equal((await f.w.siteRequest('DEV_SESSION_START',{duration_minutes:2},randomUUID())).status,'RUNNING');assert.equal(f.storage[key],undefined);
});
test('a late successful reply cannot clear changed or already uncertain evidence',async t=>{
 let change;const f=await fixture(t,()=>{change();return {status:'RUNNING'};}),other={action:'DEV_SESSION_STATE',requestId:randomUUID(),unconfirmed:true};change=()=>{f.storage[key]=structuredClone(other);};
 await assert.rejects(f.w.siteRequest('DEV_SESSION_START',{duration_minutes:2}),/RESPONSE_UNCONFIRMED/);assert.deepEqual(f.storage[key],other);
});
test('later read failure never attributes its error to another pending mutation',async t=>{
 const f=await fixture(t,()=>{throw Error('RESPONSE_UNCONFIRMED');}),row={action:'DEV_SESSION_START',requestId:randomUUID(),atUTC:new Date().toISOString()};f.storage[key]=structuredClone(row);
 await assert.rejects(f.w.siteRequest('DEV_SESSION_STATE'),/RESPONSE_UNCONFIRMED/);assert.deepEqual(f.storage[key],row);
});
test('legacy uncertain evidence is not backfilled or cleared and duplicate START is not sent',async t=>{
 const f=await fixture(t,()=>{throw Error('RESPONSE_UNCONFIRMED');}),row={action:'DEV_SESSION_START',unconfirmed:true,atUTC:new Date().toISOString()};f.storage[key]=structuredClone(row);
 await assert.rejects(f.w.siteRequest('DEV_SESSION_STATE'),/RESPONSE_UNCONFIRMED/);assert.deepEqual(f.storage[key],row);
 const count=f.calls.length;await assert.rejects(f.w.siteRequest('DEV_SESSION_START',{duration_minutes:2}),/USER_OPERATION_UNCONFIRMED/);assert.equal(f.calls.length,count);
});
test('unknown private error text is never persisted or presented as an error code',async t=>{
 const privateText='PRIVATE_CREDENTIAL_DO_NOT_OUTPUT',f=await fixture(t,()=>{throw Error(privateText);});await assert.rejects(f.w.siteRequest('DEV_SESSION_START',{duration_minutes:2}),/PRIVATE_CREDENTIAL/);
 assert.equal(f.storage[key].errorCode,'EXECUTION_UNCONFIRMED');assert(!JSON.stringify(f.storage).includes(privateText));assert.equal(f.w.focusErrorCode(Error(privateText)),'EXECUTION_UNCONFIRMED');
 assert(!f.w.document.body.textContent.includes(privateText));assert.match(f.w.document.getElementById('focus-feedback').textContent,/EXECUTION_UNCONFIRMED/);
});
