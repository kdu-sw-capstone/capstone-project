import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fixture} from './member-fixture.mjs';
const world={TextEncoder,URL,crypto,setTimeout,clearTimeout};
vm.runInNewContext(await readFile(new URL('../safety/reader.js',import.meta.url),'utf8'),world);
const safety=world.R2LocalSafety,origin='https://localhost:30193';

async function running(){
 const f=await fixture({nd01:true,dp01:true,nr01:true,d1b5:true,p1:true,limitedProduct11:true});
 Object.assign(f.command,{native_transition_contract:'NR01_1',dom_transition_contract:'DP01_1',document_transition_contract:'ND01_1'});
 const authorize=f.env.authorize;f.env.authorize=async c=>{const x=await authorize(c);x.admission.authority=origin+'/api/v1';return x;};
 await f.core.startCommand(f.command);return f;
}
const metadata=f=>f.db.transaction('readonly',(tx,done)=>{const q=tx.objectStore('metadata').getAll();q.onsuccess=()=>done(q.result);});
async function stored(f){return (await metadata(f)).find(r=>r.key==='member:first-failure:'+f.command.session_id);}
async function failContent(f){
 await f.core.nrBegin(await f.core.bundle());
 const send=f.chrome.tabs.sendMessage;f.originalSendMessage=send;
 f.chrome.tabs.sendMessage=async(...a)=>{const result=await send(...a);if(a[1]?.payload?.operation==='APPLY')throw Error('STORE_UNCONFIRMED');return result;};
 await assert.rejects(f.core.tick(),{message:'STORE_UNCONFIRMED'});
 assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');
 return stored(f);
}
async function data(f){
 const names=['metadata','sessions','journal','events','intervals','outbox'];
 return f.db.transaction('readonly',(tx,done)=>{const result={};let n=names.length;for(const name of names){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{result[name]=q.result;if(!--n)done(result);};}});
}
async function observe(f){
 const scopeKey={owner_key:f.owner.owner_key,executor_id:f.owner.installation_id,authority:origin+'/api/v1'};
 const scope=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(safety.canonical(scopeKey))).then(b=>Buffer.from(b).toString('hex'));
 const empty=()=>({metadata:[],sessions:[],journal:[],events:[],intervals:[],outbox:[]});
 const guest=empty();guest.metadata.push({key:'a1:owner-fence',owner_context:'MEMBER_OR_TRANSITION',transitioning:true,epoch:crypto.randomUUID()});
 const rows=[{name:'focurve-local',data:{metadata:[{key:'installation_id',value:f.owner.installation_id}],owner_settings:[]}},{name:'focurve-execution',data:guest},{name:'focurve-a0-registry',data:{registry:[]}},{name:'focurve-member-a1-root-authority',data:empty()},{name:'focurve-member-a1:'+scope,data:await data(f)}];
 const eid='a'.repeat(32),href='chrome-extension://'+eid+'/safety/index.html';let opens=0,closes=0,writes=0,messages=0;
 const hold={action:'UNRECOGNIZED',unconfirmed:true,requestId:crypto.randomUUID()};
 const auth={phase:'AUTH_RECOVERY_REQUIRED',owner_user_id:'1',executor_id:f.owner.installation_id,server_url:origin+'/api/v1',web_origin:origin,access_token:'PRIVATE_ACCESS',refresh_token:'PRIVATE_REFRESH',installation_proof:'PRIVATE_PROOF',access_expires_at:Date.now()-1,error:'AUTH_RESPONSE_UNCONFIRMED'};
 const env={crypto,location:{href},deployment:{contract:'STANDALONE_API_1',origin,api:origin+'/api/v1'},context:{contract:'R2_DEDICATED_PROFILE_1',extensionId:eid,origin,profileInstance:'a'.repeat(32)},chrome:{runtime:{id:eid,sendMessage:()=>{messages++;throw Error('WORKER_FORBIDDEN');}},tabs:{getCurrent:async()=>({url:href,incognito:false})},storage:{local:{get:async()=>({focurve_member_auth:auth,focurve_user_ui_hold:hold}),set:()=>{writes++;throw Error('WRITE_FORBIDDEN');}}},declarativeNetRequest:{getSessionRules:async()=>[],getDynamicRules:async()=>[]}},indexedDB:{databases:async()=>rows.map(r=>({name:r.name,version:1})),open:name=>{
  opens++;const request={};queueMicrotask(()=>{const row=rows.find(r=>r.name===name);request.result={version:1,objectStoreNames:Object.keys(row.data),close:()=>closes++,transaction:(names,mode)=>{
   assert.equal(mode,'readonly');let n=names.length;const tx={abort:()=>{},objectStore:s=>({keyPath:safety.schema(name)[s],getAll:()=>{const q={};queueMicrotask(()=>{q.result=structuredClone(row.data[s]);q.onsuccess();if(!--n)queueMicrotask(()=>tx.oncomplete());});return q;},put:()=>{writes++;throw Error('WRITE_FORBIDDEN');}})};return tx;
  }};request.onsuccess();});return request;
 }}};
 const before=JSON.stringify(rows),result=await safety.create(env).auditFirstFailure();
 assert.equal(JSON.stringify(rows),before);assert.equal(opens,closes);assert.equal(writes,0);assert.equal(messages,0);
 assert(!JSON.stringify(result).includes('PRIVATE_'));assert.ok(result.firstFailure,JSON.stringify(result));return result;
}

test('first Content failure survives a new Worker boot and is automatically extracted through the existing readonly reader',async()=>{
 const f=await running(),before=await f.core.bundle(),oldCore=f.core,first=await failContent(f);
 assert.equal(first.diagnostic.code,'STORE_UNCONFIRMED');assert.equal(first.diagnostic.stage,'CONTENT_RESPONSE_WAIT');assert.equal(first.request_id,before.state.session.start_request_id);
 const original=JSON.stringify(first),oldBoot=f.core.boot;await f.restart();
 assert.notEqual(f.core,oldCore);assert.notEqual(f.core.boot,oldBoot);assert.equal(f.core.firstFailureDiagnostic,undefined);
 assert.equal(JSON.stringify(await stored(f)),original);
 const result=await observe(f);assert.equal(result.contract,'R4_FIRST_FAILURE_AUDIT_1');assert.equal(result.gate,'UNKNOWN');
 assert.equal(result.firstFailure.status,'STORED_FIRST_FAILURE');assert.equal(result.firstFailure.code,first.diagnostic.code);assert.equal(result.firstFailure.stage,first.diagnostic.stage);assert.equal(result.firstFailure.requestId,first.request_id);
 assert.equal(result.resources.openConnections,0);assert.equal(result.resources.activeReadTransactions,0);
 await f.core.markUnknown('OWNER_MISMATCH');assert.equal(JSON.stringify(await stored(f)),original);
});

test('concurrent diagnostic commits preserve exactly the first committed row',async()=>{
 const f=await running(),b=await f.core.bundle();f.core.captureFirstFailure(Error('STORE_UNCONFIRMED'),b);
 const outcomes=await Promise.all([f.core.persistFirstFailure(b),f.core.persistFirstFailure(b)]);
 assert.equal(outcomes.filter(Boolean).length,1);assert.equal((await metadata(f)).filter(r=>r.key.startsWith('member:first-failure:')).length,1);
});

test('legacy UNKNOWN without a diagnostic remains absent after later errors and Worker recreation',async()=>{
 const f=await running(),save=f.core.persistFirstFailure.bind(f.core);f.core.persistFirstFailure=async()=>{throw Error('DIAGNOSTIC_UNAVAILABLE');};
 await f.core.markUnknown('REVALIDATION_REQUIRED');assert.equal(await stored(f),undefined);
 f.core.persistFirstFailure=save;await f.core.markUnknown('OWNER_MISMATCH');await f.restart();await f.core.markUnknown('STORE_UNCONFIRMED');
 assert.equal(await stored(f),undefined);const result=await observe(f);assert.equal(result.firstFailure.status,'ABSENT');assert.equal(result.firstFailure.historicalEvidenceReconstructed,false);
});

test('diagnostic store failure cannot prevent the original UNKNOWN transition',async()=>{
 const f=await running(),atomic=f.core.store.atomic.bind(f.core.store);let attempts=0;
 f.core.store.atomic=(...a)=>++attempts===1?Promise.reject(Error('QUOTA_UNCONFIRMED')):atomic(...a);
 await f.core.markUnknown('STORE_UNCONFIRMED');assert.equal((await f.core.bundle()).a.session_status,'UNKNOWN');assert.equal(await stored(f),undefined);
});

test('changed owner fence prevents diagnostic persistence and never grants execution authority',async()=>{
 const f=await running(),b=await f.core.bundle();f.core.captureFirstFailure(Error('STORE_UNCONFIRMED'),b);
 f.owner.owner_key='MEMBER:2';await assert.rejects(f.core.markUnknown('STORE_UNCONFIRMED'),{message:'OWNER_MISMATCH'});assert.equal(await stored(f),undefined);
});

test('automatic projection rejects foreign request/owner, added secret fields and malformed diagnostic values',async()=>{
 const f=await running();await failContent(f);const d=await data(f),sid=f.command.session_id;
 for(const mutate of [r=>r.request_id=crypto.randomUUID(),r=>r.owner_key='MEMBER:2',r=>r.token='PRIVATE',r=>r.diagnostic.stage='PRIVATE_STAGE',r=>r.diagnostic.code='PRIVATE_CODE',r=>r.diagnostic.rejected_fields=['PRIVATE']]){
  const copy=structuredClone(d),r=copy.metadata.find(r=>r.key==='member:first-failure:'+sid);mutate(r);
  const result=safety.projectStoredFirstFailure(copy,sid,f.owner.owner_key,f.owner.installation_id);assert.equal(result.status,'INVALID');assert(!JSON.stringify(result).includes('PRIVATE'));
 }
});

test('a new session receives its own first diagnostic without replacing the previous session evidence',async()=>{
 const f=await running();await failContent(f);const first=await stored(f),oldKey=first.key;
 // Explicit END is exercised only in this isolated fixture, with its original
 // reachable document and scoped release evidence. No installed session runs.
 f.chrome.tabs.sendMessage=f.originalSendMessage;
 await f.core.end(f.command.session_id);assert.equal((await f.core.bundle()).a.session_status,'ENDED');
 f.command.session_id=crypto.randomUUID();f.command.command_id=crypto.randomUUID();await f.core.startCommand(f.command);
 await f.core.markUnknown('REVALIDATION_REQUIRED');const next=await stored(f);
 assert.equal(next.diagnostic.code,'REVALIDATION_REQUIRED');assert.notEqual(next.request_id,first.request_id);
 assert.equal(JSON.stringify((await metadata(f)).find(r=>r.key===oldKey)),JSON.stringify(first));
});
