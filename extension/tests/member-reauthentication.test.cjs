const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ex='11111111-1111-4111-8111-111111111111',origin='https://localhost:29511',callback='chrome-extension://'+'a'.repeat(32)+'/popup/popup.html',attempt='22222222-2222-4222-8222-222222222222',link='33333333-3333-4333-8333-333333333333';
async function fixture(){
 let record={phase:'AUTH_RECOVERY_REQUIRED',error:'AUTH_RESPONSE_UNCONFIRMED',owner_user_id:'1',executor_id:ex,server_url:origin+'/api/v1',web_origin:origin,installation_proof:'p'.repeat(40),access_token:'OLD_ACCESS'.repeat(8),refresh_token:'OLD_REFRESH'.repeat(8),access_expires_at:Date.now()-1000};
 let approved=true,foreign=false,failed=false,debt=false;const requests=[],opens=[],data={policy:{sites:['kept.example']},history:[{id:'kept-record'}]};
 const world={URL,TextEncoder,AbortController,setTimeout,clearTimeout,btoa,crypto:require('node:crypto').webcrypto,FocurveDeploymentBinding:{assertInput:c=>assert.equal(c.server_url,origin+'/api/v1')}};
 vm.runInNewContext(source('background/member-auth.js'),world);vm.runInNewContext(source('integration/same-owner-recovery.js'),world);
 const auth=new world.FocurveMemberAuth.MemberAuth({store:{get:async()=>structuredClone(record),put:async r=>(record=structuredClone(r))},getInstallation:async()=>({installation_id:ex}),inspectIdle:async()=>({active_session_id:null,owned_rule_ids:[],pending_action_count:0}),callbackUri:callback,openApproval:async url=>opens.push(url),now:Date.now,crypto:world.crypto,fetch:async(url,o)=>{
  requests.push({path:url.slice((origin+'/api/v1').length),body:o.body?JSON.parse(o.body):null});let value;
  if(url.endsWith('/extension-link-requests'))value={link_request_id:link,expires_at:new Date(Date.now()+300000).toISOString(),verification_uri:origin+'/#link?id='+link};
  else if(url.endsWith('/evidence'))value={accepted:true};
  else if(url.endsWith('/claim'))value=approved?{status:'APPROVED',state:record.state,code:'c'.repeat(40)}:{status:'PENDING'};
  else if(url.endsWith('/extension-tokens')){if(failed)throw Error('PRIVATE_NETWORK_FAILURE');value={access_token:'a'.repeat(40),refresh_token:'r'.repeat(40),expires_in:900};}
  else if(url.endsWith('/auth/me'))value={user_id:foreign?'2':'1'};
  else throw Error('UNEXPECTED_REQUEST');return {ok:true,json:async()=>value};
 }});
 const inspect=async()=>({owner:'MEMBER:1',executor:ex,memberRootPhase:'RELEASED',...Object.fromEntries(world.FocurveSameOwnerRecovery.obligationFields.map(k=>[k,debt?1:0]))});
 const actor=new world.FocurveSameOwnerRecovery.SameOwnerRecovery({auth,inspectObligations:inspect,isolated:true});
 return {world,actor,auth,requests,opens,data,record:()=>structuredClone(record),pending:()=>approved=false,approve:()=>approved=true,foreign:()=>foreign=true,fail:()=>failed=true,debt:()=>debt=true};
}
const config={server_url:origin+'/api/v1',web_origin:origin};
test('same owner fresh PKCE reauthentication preserves installation, policy and history without replaying old refresh',async()=>{
 const f=await fixture(),before=structuredClone(f.data);await f.actor.begin(config,attempt);const r=await f.actor.poll();assert.equal(r.phase,'LINKED');assert.equal(r.owner_user_id,'1');assert.equal(r.executor_id,ex);assert.deepEqual(f.data,before);assert.equal(f.opens.length,1);assert(!f.requests.some(r=>r.path.includes('refresh')));assert(!JSON.stringify(f.requests).includes('OLD_REFRESH'));assert(!JSON.stringify(r).includes('a'.repeat(40)));
});
test('foreign web owner cannot replace retained member ownership',async()=>{const f=await fixture();await f.actor.begin(config,attempt);f.foreign();await assert.rejects(f.actor.poll(),/AUTH_OWNER_MISMATCH/);assert.equal(f.record().owner_user_id,'1');assert.equal(f.record().phase,'AUTH_RECOVERY_REQUIRED');});
test('local unresolved obligation or changed authority refuses before writes/network',async()=>{for(const kind of ['debt','authority']){const f=await fixture(),before=f.record();if(kind==='debt')f.debt();await assert.rejects(f.actor.begin(kind==='authority'?{...config,web_origin:'https://other.invalid'}:config,attempt),/RECOVERY_OBLIGATION_UNCONFIRMED|RECOVERY_AUTHORITY_CHANGED/);assert.deepEqual(f.record(),before);assert.equal(f.requests.length,0);}});
test('duplicate begin never creates a second PKCE request',async()=>{const f=await fixture();await f.actor.begin(config,attempt);await assert.rejects(f.actor.begin(config,attempt),/RECOVERY_ATTEMPT_ALREADY_USED/);assert.equal(f.requests.filter(r=>r.path==='/extension-link-requests').length,1);});
test('unapproved or cancelled web flow remains pending, later explicit confirmation exchanges only once',async()=>{const f=await fixture();await f.actor.begin(config,attempt);f.pending();assert.equal((await f.actor.poll()).phase,'LINK_PENDING');assert(!f.requests.some(r=>r.path==='/extension-tokens'));f.approve();assert.equal((await f.actor.poll()).phase,'LINKED');await assert.rejects(f.actor.poll(),/RECOVERY_POLL_NOT_ADMISSIBLE/);assert.equal(f.requests.filter(r=>r.path==='/extension-tokens').length,1);});
test('lost exchange response preserves uncertainty, owner, original failure and data without retry',async()=>{const f=await fixture(),data=structuredClone(f.data);await f.actor.begin(config,attempt);f.fail();await assert.rejects(f.actor.poll(),/AUTH_RESPONSE_UNCONFIRMED/);assert.equal(f.record().phase,'AUTH_RECOVERY_REQUIRED');assert.equal(f.record().owner_user_id,'1');assert.equal(f.record().recovery_first_error,'AUTH_RESPONSE_UNCONFIRMED');assert.deepEqual(f.data,data);await assert.rejects(f.actor.poll(),/RECOVERY_POLL_NOT_ADMISSIBLE/);});

const popup={setTimeout,clearTimeout};vm.runInNewContext(source('member-ui/popup-model.js'),popup);const {controller}=popup.FocurveUserPopup;
function ui(){let response={ok:true,data:{phase:'AUTH_RECOVERY_REQUIRED',error:'AUTH_RESPONSE_UNCONFIRMED',recovery_available:true}},calls=[];const c=controller({readyAllowed:()=>false,send:async m=>{calls.push(m);return response;},config:()=>config,matches:()=>true,onChange(){},onError(){},uuid:()=>attempt});return {c,calls,set:r=>response=r};}
test('recovery UI works in focus-closed scope, no START or ordinary CONNECT, no HOLD removal',async()=>{const f=ui();await f.c.act('STATE');assert.equal(f.c.view().canRecover,true);assert.equal(f.c.view().canStart,false);assert.equal(await f.c.act('START',{minutes:3}),false);assert.equal(await f.c.act('CONNECT'),false);f.set({ok:true,data:{phase:'LINK_PENDING',recovery_pending:true,error:null,recovery_available:true}});assert.equal(await f.c.act('RECOVER_BEGIN'),true);assert.equal(f.calls.at(-1).payload.approval_id,attempt);assert.equal(f.c.view().canRecoverConfirm,true);f.set({ok:true,data:{phase:'LINKED',error:null,recovery_pending:false,local_status:'IDLE'}});await f.c.act('RECOVER_CONFIRM');assert.equal(f.c.view().linked,true);assert.equal(f.c.view().canStart,false);});
test('existing UI HOLD remains blocked even with an available recovery scope',async()=>{const f=ui();f.set({ok:false,error:'UNCONFIRMED'});await f.c.act('STATE');assert.equal(f.c.held(),true);assert.equal(await f.c.act('RECOVER_BEGIN'),false);});


async function runtimeFixture(){
 const f=await fixture(),world=f.world,{IDBFactory}=require('fake-indexeddb');
 world.indexedDB=new IDBFactory();world.importScripts=()=>{};vm.runInNewContext(source('safety/reader.js'),world);
 world.MemberA1Contract=await import('../member-a1/contract.mjs');
 const scope=await world.MemberA1Contract.digest({owner_key:'MEMBER:1',executor_id:ex,authority:origin+'/api/v1'});
 const schemas=world.R2LocalSafety;
 const names=['focurve-local','focurve-execution','focurve-member-a1-root-authority','focurve-member-a1:'+scope,'focurve-a0-registry'];
 for(const name of names)await new Promise((resolve,reject)=>{const q=world.indexedDB.open(name,1);q.onupgradeneeded=()=>{for(const [store,keyPath] of Object.entries(schemas.schema(name)))q.result.createObjectStore(store,{keyPath});};q.onerror=()=>reject(q.error);q.onsuccess=()=>{q.result.close();resolve();};});
 const put=async(name,store,value)=>new Promise((resolve,reject)=>{const q=world.indexedDB.open(name);q.onsuccess=()=>{const db=q.result,tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};});
 await put('focurve-local','metadata',{key:'installation_id',value:ex});
 await put('focurve-execution','metadata',{key:'a1:owner-fence',epoch:attempt,owner_context:'MEMBER_OR_TRANSITION',transitioning:true});
 await put('focurve-member-a1:'+scope,'metadata',{key:'a1:owner-fence',epoch:attempt,owner_context:'MEMBER:1',transitioning:false});
 await put('focurve-local','owner_settings',{owner_key:'MEMBER:1',sites:['kept.example']});
 await put('focurve-member-a1:'+scope,'sessions',{owner_key:'MEMBER:1',session_id:link,executor_id:ex,status:'ENDED',record:'kept-history'});
 world.chrome={runtime:{getURL:p=>p},declarativeNetRequest:{getSessionRules:async()=>[],getDynamicRules:async()=>[]}};
 world.__memberIntegration={auth:f.auth,serial:fn=>fn()};world.__memberA1={serial:fn=>fn(),identity:async()=>({owner_key:'MEMBER:1',executor_id:ex})};
 const request=f.auth.request.bind(f.auth);let offline=false,wrong=false;
 f.auth.request=async(r,path,...args)=>{if(path==='/install/auth-recovery'){if(offline)throw Error('AUTH_RESPONSE_UNCONFIRMED');return {contract:'FOCURVE_MEMBER_REAUTH_READY_1',operation_id:'a'.repeat(32),executor_id:wrong?'22222222-2222-4222-8222-222222222222':ex,owner_user_id:'1',web_origin:origin,callback_uri:callback,not_after:new Date(Date.now()+600000).toISOString(),focus_allowed:false};}return request(r,path,...args);};
 vm.runInNewContext(source('integration/recovery-runtime.js'),world);
 const dump=async()=>{const result={};for(const name of names)result[name]=await new Promise(resolve=>{const q=world.indexedDB.open(name);q.onsuccess=()=>{const db=q.result,stores=[...db.objectStoreNames],tx=db.transaction(stores,'readonly'),rows={};for(const st of stores){const r=tx.objectStore(st).getAll();r.onsuccess=()=>rows[st]=r.result;}tx.oncomplete=()=>{db.close();resolve(rows);};};});return result;};
 return {...f,runtime:world.MemberRecovery,put,scope,dump,offline:()=>offline=true,wrong:()=>wrong=true};
}

test('product recovery runtime joins scoped readiness, strict real IndexedDB observations and existing PKCE actor',async()=>{
 const f=await runtimeFixture(),before=await f.dump();assert.equal((await f.runtime.status()).recovery_available,true);
 assert.equal((await f.runtime.begin({config,approval_id:attempt})).phase,'LINK_PENDING');assert.equal((await f.runtime.confirm()).phase,'LINKED');assert.deepEqual(await f.dump(),before);
 assert.equal((await f.runtime.status()).recovery_available,false);assert(!f.requests.some(x=>x.path.includes('refresh')));
});
test('product runtime refuses server offline, foreign installation and retained unresolved Journal',async()=>{
 for(const type of ['offline','wrong','journal']){const f=await runtimeFixture(),before=f.record();if(type==='journal')await f.put('focurve-member-a1:'+f.scope,'journal',{owner_key:'MEMBER:1',session_id:link,desired:'APPLIED',observed:'APPLIED'});else f[type]();
  assert.equal((await f.runtime.status()).recovery_available,false);await assert.rejects(f.runtime.begin({config,approval_id:attempt}));assert.deepEqual(f.record(),before);
 }
});


test('actual user popup DOM exposes recovery without granting focus or exposing private values',async()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM(source('member-ui/popup.html'),{url:'chrome-extension://'+'a'.repeat(32)+'/member-ui/popup.html',runScripts:'outside-only'}),w=dom.window;
 let phase='AUTH_RECOVERY_REQUIRED';const calls=[];w.FOCURVE_DEPLOYMENT={api:origin+'/api/v1',origin,launchId:'a'.repeat(32),launchDeadlineUTC:new Date(Date.now()+600000).toISOString()};
 w.fetch=async()=>({ok:true,json:async()=>({contract:'STANDALONE_LAUNCH_1',extensionId:'a'.repeat(32),...w.FOCURVE_DEPLOYMENT})});
 w.FocurveDeploymentBinding={config:()=>config,stateMatches:()=>true};w.navigator.locks={request:async(_n,_o,f)=>f({})};
 const savedUI={};w.chrome={storage:{local:{get:async()=>structuredClone(savedUI),set:async v=>Object.assign(savedUI,v),remove:async k=>{delete savedUI[k];}}},runtime:{id:'a'.repeat(32),getURL:p=>'chrome-extension://'+'a'.repeat(32)+'/'+p,sendMessage:async m=>{calls.push(m.action);if(m.action==='RECOVER_BEGIN')phase='LINK_PENDING';if(m.action==='RECOVER_CONFIRM')phase='LINKED';return {ok:true,data:{phase,error:phase==='AUTH_RECOVERY_REQUIRED'?'AUTH_RESPONSE_UNCONFIRMED':null,recovery_pending:phase==='LINK_PENDING',recovery_available:phase!=='LINKED',local_status:'IDLE',access_token:'PRIVATE_DO_NOT_RENDER'}};}}};
 const wait=()=>new Promise(r=>setTimeout(r,35));
 try{w.eval(source('member-ui/popup-model.js'));w.eval(source('member-ui/user.js'));await wait();assert.equal(w.document.getElementById('recover-begin').disabled,false);assert.equal(w.document.getElementById('start').disabled,true);
 w.document.getElementById('recover-begin').click();await wait();assert.equal(w.document.getElementById('recover-confirm').disabled,false);w.document.getElementById('recover-confirm').click();await wait();assert.equal(w.document.getElementById('start').disabled,true);assert(!w.document.body.textContent.includes('PRIVATE_DO_NOT_RENDER'));assert(!calls.includes('START'));assert(!calls.includes('END'));
 }finally{dom.window.close();}
});


test('expired PKCE and installation mismatch preserve member ownership and never exchange tokens',async()=>{
 const f=await fixture();await f.actor.begin(config,attempt);f.auth.now=()=>Date.now()+400000;await assert.rejects(f.actor.poll(),/RECOVERY_POLL_NOT_ADMISSIBLE/);assert.equal(f.record().phase,'AUTH_RECOVERY_REQUIRED');assert.equal(f.record().owner_user_id,'1');assert(!f.requests.some(r=>r.path==='/extension-tokens'));
 const g=await fixture(),before=g.record();g.auth.getInstallation=async()=>({installation_id:'22222222-2222-4222-8222-222222222222'});await assert.rejects(g.actor.begin(config,attempt),/AUTH_INSTALLATION_MISMATCH/);assert.deepEqual(g.record(),before);
});
test('recovery strict observation refuses bindings, leases, outbox, rules, unknown schema and installation mismatch',async()=>{
 for(const type of ['binding','lease','outbox','rules','schema','installation']){
  const f=await runtimeFixture(),before=f.record();
  if(type==='binding')await f.put('focurve-member-a1:'+f.scope,'metadata',{key:'a1:binding:'+link,record_kind:'A1_BINDING',resolution:'NONE',cleanup_pending:false});
  if(type==='lease')await f.put('focurve-member-a1:'+f.scope,'metadata',{key:'lease',record_kind:'CLEANUP_LEASE',phase:'ACTIVE'});
  if(type==='outbox')await f.put('focurve-member-a1:'+f.scope,'metadata',{key:'member:outbox:pending',acked:false});
  if(type==='rules')f.world.chrome.declarativeNetRequest.getSessionRules=async()=>[{id:1}];
  if(type==='installation')await f.put('focurve-local','metadata',{key:'installation_id',value:link});
  if(type==='schema')await new Promise(resolve=>{const q=f.world.indexedDB.open('unknown-obligation-db',1);q.onupgradeneeded=()=>q.result.createObjectStore('unrecognized');q.onsuccess=()=>{q.result.close();resolve();};});
  assert.equal((await f.runtime.status()).recovery_available,false,type);await assert.rejects(f.runtime.begin({config,approval_id:attempt}));assert.deepEqual(f.record(),before);
 }
});
test('lost extension response holds recovery UI; duplicate click never resends or grants START',async()=>{
 let resolve,calls=0;const c=controller({readyAllowed:()=>false,config:()=>config,matches:()=>true,onChange(){},onError(){},uuid:()=>attempt,timeoutMs:10,send:m=>m.action==='STATE'?Promise.resolve({ok:true,data:{phase:'AUTH_RECOVERY_REQUIRED',error:'AUTH_RESPONSE_UNCONFIRMED',recovery_available:true}}):(calls++,new Promise(r=>resolve=r))});
 await c.act('STATE');const pending=c.act('RECOVER_BEGIN');assert.equal(await c.act('RECOVER_BEGIN'),false);await pending;resolve({ok:true,data:{phase:'LINKED',error:null,recovery_pending:false,local_status:'IDLE'}});await new Promise(r=>setTimeout(r,0));assert.equal(c.held(),true);assert.equal(c.view().canStart,false);assert.equal(await c.act('RECOVER_CONFIRM'),false);assert.equal(calls,1);
});
