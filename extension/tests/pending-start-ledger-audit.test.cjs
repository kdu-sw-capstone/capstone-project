const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {IDBFactory}=require('fake-indexeddb'),crypto=require('node:crypto').webcrypto;
const world={URL,TextEncoder,setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../safety/reader.js'),'utf8'),world);const core=world.R2LocalSafety;
const executor='11111111-1111-4111-8111-111111111111',request='13ddd97b-7f5b-4dd6-a69d-7b274140b1c0',eid='a'.repeat(32),origin='https://localhost:29511';
async function fixture({intent=null,rule=false,foreign=false,expired=true}={}){
 const dbs=new IDBFactory(),auth={phase:'LINKED',recovery_pending:false,error:null,access_token:'PRIVATE_ACCESS',refresh_token:'PRIVATE_REFRESH',installation_proof:'PRIVATE_PROOF',access_expires_at:Date.now()+(expired?-60000:3600000),server_url:origin+'/api/v1',web_origin:origin,owner_user_id:1,executor_id:executor};
 const marker={requestId:request,action:'START',unconfirmed:true,atUTC:'2026-10-26T18:27:56.359Z'};
 const key={owner_key:'MEMBER:1',executor_id:executor,authority:auth.server_url},scope=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(core.canonical(key)))).toString('hex');
 const member='focurve-member-a1:'+scope,names=['focurve-local','focurve-execution','focurve-member-a1-root-authority',member,'focurve-a0-registry'];let writes=0;
 for(const name of names)await new Promise((resolve,reject)=>{const q=dbs.open(name,1);q.onupgradeneeded=()=>{for(const [store,keyPath] of Object.entries(core.schema(name)))q.result.createObjectStore(store,{keyPath});};q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,tx=db.transaction([...db.objectStoreNames],'readwrite');
  if(name==='focurve-local')tx.objectStore('metadata').put({key:'installation_id',value:executor});
  if(name==='focurve-execution')tx.objectStore('metadata').put({key:'a1:owner-fence',owner_context:'MEMBER_OR_TRANSITION',transitioning:true,epoch:executor});
  if(name===member&&intent)tx.objectStore('metadata').put({key:'member:start-intent',...intent});
  tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
 const env={indexedDB:dbs,crypto,location:{href:'chrome-extension://'+eid+'/safety/index.html'},deployment:{contract:'STANDALONE_API_1',origin,api:origin+'/api/v1'},context:{contract:'R2_DEDICATED_PROFILE_1',extensionId:foreign?'b'.repeat(32):eid,origin,profileInstance:'a'.repeat(32)},chrome:{runtime:{id:eid},tabs:{getCurrent:async()=>({url:'chrome-extension://'+eid+'/safety/index.html',incognito:false})},storage:{local:{get:async()=>({focurve_member_auth:auth,focurve_user_ui_hold:marker}),set(){writes++;throw Error('WRITE_FORBIDDEN');},remove(){writes++;throw Error('REMOVE_FORBIDDEN');}}},declarativeNetRequest:{getSessionRules:async()=>rule?[{id:12345,action:{type:'block'},condition:{urlFilter:'PRIVATE_URL'}}]:[],getDynamicRules:async()=>[],updateSessionRules(){writes++;throw Error('DNR_WRITE_FORBIDDEN');},updateDynamicRules(){writes++;throw Error('DNR_WRITE_FORBIDDEN');}}}};
 return {env,marker,auth,member,dbs,get writes(){return writes;}};
}
test('expired stored owner can be audited without authenticating or granting CLEAR',async()=>{
 const f=await fixture(),before=JSON.stringify([f.auth,f.marker]);const r=await core.create(f.env).auditPendingStart(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.auditOnly,true);assert.equal(r.startIntent.present,false);assert.equal(r.authentication.accessExpiry,'EXPIRED');assert.equal(r.authentication.authenticationVerified,false);
 assert.equal(r.identity.installation,true);assert.equal(r.counts.sessionRules,0);assert.equal(r.counts.unreleasedJournals,0);assert.equal(r.dnr.ownership,'NO_RULES_PRESENT');assert.equal(f.writes,0);assert.equal(JSON.stringify([f.auth,f.marker]),before);
 assert.equal(r.resources.openConnections,0);assert.equal(r.resources.activeReadTransactions,0);assert.equal(r.resources.pendingNativeCalls,0);assert(!JSON.stringify(r).includes('PRIVATE_'));
});
test('ordinary safety check still rejects expired authentication',async()=>{const f=await fixture(),r=await core.create(f.env).observe();assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert(r.issues.includes('AUTH_IDENTITY_UNCONFIRMED'));});

for(const [field,value,reason] of [
 ['phase','PRIVATE_UNKNOWN_PHASE','AUTH_STATE_NOT_ALLOWED'],
 ['recovery_pending',true,'RECOVERY_PENDING'],
 ['refresh_token','','REFRESH_TOKEN_MISSING'],
 ['server_url','https://private.invalid/api/v1','API_ORIGIN_MISMATCH'],
 ['owner_user_id',0,'MEMBER_OWNER_INVALID']
])test('STATE audit classifies '+reason+' without reading ledgers or exposing auth values',async()=>{
 const f=await fixture();f.marker.action='STATE';f.auth[field]=value;let inventories=0;
 f.env.indexedDB.databases=async()=>{inventories++;throw Error('MUST_NOT_READ_LEDGER');};
 const before=JSON.stringify([f.auth,f.marker]),r=await core.create(f.env).auditPendingState(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.failureStage,'AUTH_READ');assert.equal(r.counts,null);
 assert(r.authState.rejectionConditions.includes(reason));assert.equal(r.authState.authenticationVerified,false);
 assert.equal(inventories,0);assert.equal(f.writes,0);assert.equal(JSON.stringify([f.auth,f.marker]),before);
 assert(!JSON.stringify(r).includes('PRIVATE_'));assert(!JSON.stringify(r).includes('private.invalid'));
});
test('legacy in-doubt intent is observed without assigning the UI request',async()=>{const f=await fixture({intent:{id:executor,minutes:10,completed:false}}),r=await core.create(f.env).auditPendingStart(request);assert.equal(r.startIntent.id,executor);assert.equal(r.startIntent.correlation,'LEGACY_ID_NOT_LINKED');assert.equal(r.startIntent.uiRequestId,null);assert.equal(r.counts.transitions,1);assert.equal(r.gate,'UNKNOWN');});
test('DNR rules are reported without inventing ownership or releasing them',async()=>{const f=await fixture({rule:true}),r=await core.create(f.env).auditPendingStart(request);assert.equal(r.counts.sessionRules,1);assert.equal(r.dnr.sessionRuleIds[0],12345);assert.equal(r.dnr.ownership,'NOT_ESTABLISHED_BY_COUNTS');assert.equal(f.writes,0);assert(!JSON.stringify(r).includes('PRIVATE_URL'));});
test('wrong request and wrong profile cannot yield a ledger proof',async()=>{for(const foreign of [false,true]){const f=await fixture({foreign}),r=await core.create(f.env).auditPendingStart(foreign?request:executor);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert.equal(r.auditOnly,undefined);}});
test('timeout remains UNKNOWN with no request replay or storage changes',async()=>{const f=await fixture();f.env.timeoutMs=5;f.env.indexedDB={databases:()=>new Promise(()=>{})};const r=await core.create(f.env).auditPendingStart(request);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert(r.issues.includes('OBSERVATION_TIMEOUT'));assert.equal(f.writes,0);});

test('ordinary fresh member safety contract remains unchanged',async()=>{const f=await fixture({expired:false}),r=await core.create(f.env).observe();assert.equal(r.contract,'R3_LOCAL_SAFETY_2');assert.equal(r.gate,'CLEAR_LOCAL_ONLY');assert.equal(r.auditOnly,undefined);});
test('marker change between double reads invalidates the audit',async()=>{const f=await fixture();let reads=0;f.env.chrome.storage.local.get=async()=>({focurve_member_auth:f.auth,focurve_user_ui_hold:{...f.marker,requestId:++reads===1?request:executor}});const r=await core.create(f.env).auditPendingStart(request);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert(r.issues.includes('OBSERVATION_CHANGED'));});
test('DNR query errors never expose raw errors or claim zero rules',async()=>{const f=await fixture();f.env.chrome.declarativeNetRequest.getSessionRules=async()=>{throw Error('PRIVATE_RULE_ERROR');};const r=await core.create(f.env).auditPendingStart(request);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert(!JSON.stringify(r).includes('PRIVATE_RULE_ERROR'));});

async function allRows(factory){
 const rows=[];for(const info of await factory.databases()){
  const db=await new Promise((resolve,reject)=>{const q=factory.open(info.name);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  const data=await new Promise((resolve,reject)=>{const tx=db.transaction([...db.objectStoreNames],'readonly'),result={};for(const name of db.objectStoreNames){const q=tx.objectStore(name).getAll();q.onsuccess=()=>result[name]=q.result;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});db.close();rows.push({name:info.name,data});
 }return JSON.stringify(rows.sort((a,b)=>a.name.localeCompare(b.name)));
}
test('read-only startup preserves intent journal outbox lease binding and DNR fixtures end to end',async()=>{
 const f=await fixture({intent:{id:executor,minutes:10,completed:false},rule:true});
 const db=await new Promise(resolve=>{const q=f.dbs.open(f.member);q.onsuccess=()=>resolve(q.result);});
 await new Promise((resolve,reject)=>{const tx=db.transaction(['metadata','journal','outbox'],'readwrite');
  tx.objectStore('metadata').put({key:'a1:binding:test',record_kind:'A1_BINDING',resolution:'NONE',cleanup_pending:true});
  tx.objectStore('metadata').put({key:'lease:test',record_kind:'CLEANUP_LEASE',phase:'ISSUED'});
  tx.objectStore('journal').put({owner_key:'MEMBER:1',session_id:executor,desired:'APPLIED',observed:'UNKNOWN'});
  tx.objectStore('outbox').put({owner_key:'MEMBER:1',item_id:executor,acked:false});
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
 });db.close();
 const before=await allRows(f.dbs),authBefore=JSON.stringify([f.auth,f.marker]);let forbidden=0;
 const world={chrome:f.env.chrome,indexedDB:f.dbs,fetch(){forbidden++;throw Error('NETWORK_FORBIDDEN');},importScripts(){forbidden++;throw Error('IMPORT_FORBIDDEN');},GuestSession:{tick(){forbidden++;throw Error('RECOVERY_FORBIDDEN');}}};
 const entry=fs.readFileSync(path.join(__dirname,'../../distribution/diagnostics/readonly-worker.js'),'utf8');vm.runInNewContext(entry,world);
 const r=await core.create(f.env).auditPendingStart(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts.unreleasedJournals,1);assert.equal(r.counts.pendingOutbox,1);assert.equal(r.counts.pendingLeases,1);assert.equal(r.counts.unresolvedBindings,1);assert.equal(r.counts.sessionRules,1);
 assert.equal(r.startIntent.correlation,'LEGACY_ID_NOT_LINKED');assert.equal(await allRows(f.dbs),before);assert.equal(JSON.stringify([f.auth,f.marker]),authBefore);assert.equal(f.writes,0);assert.equal(forbidden,0);
 assert.equal(r.resources.openConnections,0);assert.equal(r.resources.activeReadTransactions,0);
});

async function stateFixture(){
 const f=await fixture({rule:true});f.marker.action='STATE';
 const sid='cecf2b03-2a51-42cc-87c1-e4032b1d5e98',snapshotId='881a098b-7988-4d51-bfba-a7fc8e3df268',bid='5b0e9c36-c5a9-4dc7-8123-f5371168f36b';
 const snapshot={policy_snapshot_id:snapshotId,format_version:'1.1',source_version:1,owner_user_id:'1',executor_id:executor,sites:[]};
 const snapshotHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(core.canonical(snapshot)))).toString('hex');
 const rules=await f.env.chrome.declarativeNetRequest.getSessionRules();
 const rows={metadata:[
  {key:'current',execution_contract:'d06-member-a1-1',owner_key:'MEMBER:1',session_id:sid},
  {key:'a1:owner-fence',owner_context:'MEMBER:1',transitioning:false,epoch:executor},
  {key:'a1:aggregate:'+sid,record_kind:'A1_AGGREGATE',session_id:sid,owner_context:'MEMBER:1',executor_id:executor,desired_revision:1,session_status:'UNKNOWN',cleanup_pending:false,snapshot_ref:{policy_snapshot_id:snapshotId,snapshot_format:'1.1',source_version:1,snapshot_sha256:snapshotHash},local_links:{journal_revision:1,journal_action_seq:1}},
  {key:'a1:binding:'+bid,record_kind:'A1_BINDING',scope:{binding_id:bid,session_id:sid,owner_context:'MEMBER:1',executor_id:executor},resolution:'GONE_NATIVE',cleanup_pending:false,apply_closed:true,native_lifecycle:'GONE',ledger:[{private:'PRIVATE_LEDGER'}],channel_credential:'PRIVATE_BINDING'},
  {key:'lease:test',record_kind:'CLEANUP_LEASE',session_id:sid,binding_id:bid,phase:'EXPIRED'},
  {key:'member:outbox:test',acked:false,body:{session_id:sid,private:'PRIVATE_OUTBOX'}}
 ],sessions:[{owner_key:'MEMBER:1',session_id:sid,executor_id:executor,status:'UNKNOWN',snapshot,member_admission:{session_id:sid,executor_id:executor,authority:origin+'/api/v1'}}],journal:[{owner_key:'MEMBER:1',session_id:sid,revision:1,action_seq:1,desired:'APPLIED',observed:'APPLIED',rules}]};
 async function write(name,values){const db=await new Promise(resolve=>{const q=f.dbs.open(name);q.onsuccess=()=>resolve(q.result);});await new Promise((resolve,reject)=>{const tx=db.transaction(Object.keys(values),'readwrite');for(const [store,rows] of Object.entries(values))for(const row of rows)tx.objectStore(store).put(row);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}
 await write(f.member,rows);
 await write('focurve-member-a1-root-authority',{metadata:[{key:'member:root-authority',phase:'ACTIVE',owner_key:'MEMBER:1',executor_id:executor,authority:origin+'/api/v1',session_id:sid,epoch:executor}]});
 return {...f,sid,rows,write};
}

test('STATE hold reads existing UNKNOWN journal/rules without assigning the query ID to START or changing any data',async()=>{
 const f=await stateFixture(),before=await allRows(f.dbs),authBefore=JSON.stringify([f.auth,f.marker]);
 const r=await core.create(f.env).auditPendingState(request);
 assert.equal(r.contract,'R4_STATE_LEDGER_AUDIT_1');assert.equal(r.gate,'UNKNOWN');assert.equal(r.auditOnly,true);
 assert.equal(r.session.sessionId,f.sid);assert.equal(r.session.status,'UNKNOWN');assert.equal(r.authentication.authenticationVerified,false);
 assert.equal(r.counts.activeSessions,1);assert.equal(r.counts.unreleasedJournals,1);assert.equal(r.counts.pendingLeases,1);
 assert.equal(r.counts.pendingOutbox,1);assert.equal(r.bindings[0].ledgerEntries,1);
 assert.equal(r.dnr.ownership,'EXACT_SESSION_JOURNAL_MATCH');assert.deepEqual([...r.dnr.exactOwnedRuleIds],[12345]);
 assert.equal(r.dnr.nativeIdentityVerified,false);assert.equal(r.startIntent.correlation,'NOT_A_START_REQUEST_NO_RETROACTIVE_ATTRIBUTION');
 assert.equal(await allRows(f.dbs),before);assert.equal(JSON.stringify([f.auth,f.marker]),authBefore);assert.equal(f.writes,0);
 assert(!JSON.stringify(r).includes('PRIVATE_'));assert.equal(r.resources.openConnections,0);
});

test('AUTH_RECOVERY_REQUIRED only identifies a stored STATE audit owner, never ordinary clearance or START audit',async()=>{
 const f=await stateFixture();f.auth.phase='AUTH_RECOVERY_REQUIRED';f.auth.error='AUTH_RESPONSE_UNCONFIRMED';
 const reader=core.create(f.env),r=await reader.auditPendingState(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.session.storedIdentityMatches,true);assert.equal(r.authentication.authenticationVerified,false);
 assert.equal((await reader.observe()).counts,null);assert.equal((await reader.auditPendingStart(request)).counts,null);
});

test('production stored recovery owner has no public recovery_pending field and remains audit-only',async()=>{
 const f=await stateFixture();delete f.auth.recovery_pending;
 Object.assign(f.auth,{phase:'AUTH_RECOVERY_REQUIRED',error:'AUTH_RESPONSE_UNCONFIRMED'});
 const before=await allRows(f.dbs),authBefore=JSON.stringify(f.auth),reader=core.create(f.env);
 const r=await reader.auditPendingState(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.auditOnly,true);assert.equal(r.session.storedIdentityMatches,true);
 assert.equal(r.authentication.authenticationVerified,false);assert.equal(r.counts.activeSessions,1);
 assert.equal(r.dnr.ownership,'EXACT_SESSION_JOURNAL_MATCH');
 assert.equal((await reader.observe()).counts,null);assert.equal((await reader.auditPendingStart(request)).counts,null);
 assert.equal(await allRows(f.dbs),before);assert.equal(JSON.stringify(f.auth),authBefore);assert.equal(f.writes,0);
});

for(const pending of [true,null,'false'])test('stored recovery owner rejects explicit pending/malformed '+String(pending),async()=>{
 const f=await stateFixture();Object.assign(f.auth,{phase:'AUTH_RECOVERY_REQUIRED',error:'AUTH_RESPONSE_UNCONFIRMED',recovery_pending:pending});
 const r=await core.create(f.env).auditPendingState(request);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);
 assert(r.issues.includes('AUTH_IDENTITY_UNCONFIRMED'));assert.equal(f.writes,0);
});

test('raw pending PKCE recovery cannot become an audit owner by omitting the public flag',async()=>{
 const f=await stateFixture();delete f.auth.recovery_pending;
 Object.assign(f.auth,{phase:'LINK_PENDING',error:null,recovery_mode:'SAME_OWNER_RECOVERY_1_CANDIDATE',recovery_poll_attempted:false});
 const r=await core.create(f.env).auditPendingState(request);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert.equal(f.writes,0);
});

test('changed actual rule body is not accepted as owned merely because its ID matches',async()=>{
 const f=await stateFixture();f.env.chrome.declarativeNetRequest.getSessionRules=async()=>[{id:12345,action:{type:'allow'},condition:{urlFilter:'PRIVATE_URL'}}];
 const r=await core.create(f.env).auditPendingState(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.dnr.ownership,'UNCONFIRMED_RULES_PRESENT');assert.deepEqual([...r.dnr.unownedOrChangedRuleIds],[12345]);
 assert.equal(f.writes,0);
});

test('missing rules remain a missing-journal observation, not proof of completed END',async()=>{
 const f=await stateFixture();f.env.chrome.declarativeNetRequest.getSessionRules=async()=>[];
 const r=await core.create(f.env).auditPendingState(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.dnr.ownership,'JOURNAL_RULES_MISSING');assert.equal(r.session.status,'UNKNOWN');
});

for(const kind of ['request','profile','member','session','journal','snapshot','claim'])test('STATE audit refuses mismatched '+kind+' identity',async()=>{
 const f=await stateFixture();
 if(kind==='request')f.marker.requestId=executor;
 if(kind==='profile')f.env.context.extensionId='b'.repeat(32);
 if(kind==='member')f.rows.metadata[2].owner_context='MEMBER:2';
 if(kind==='session')f.rows.sessions[0].status='ENDED';
 if(kind==='journal')f.rows.journal[0].revision=2;
 if(kind==='snapshot')f.rows.sessions[0].snapshot.sites.push({private:'PRIVATE_CHANGED'});
 if(kind==='claim')await f.write('focurve-member-a1-root-authority',{metadata:[{key:'member:root-authority',owner_key:'MEMBER:2',phase:'ACTIVE'}]});
 await f.write(f.member,f.rows);
 const r=await core.create(f.env).auditPendingState(request);assert.equal(r.gate,'UNKNOWN');assert.equal(r.counts,null);assert.equal(r.auditOnly,undefined);
});
const nativeScope={tab_id:17,frame_id:0,document_id:'stored-document'};
for(const kind of ['active','cached','prerender','pending_deletion','missing','mismatch','allFramesError','frameError'])test('ENDING document observation distinguishes '+kind+' without authorizing restoration',async()=>{
 let calls=[];const ch={webNavigation:{getAllFrames:async args=>{calls.push(['frames',args]);if(kind==='allFramesError')throw Error('PRIVATE_NATIVE_FAILURE');return kind==='active'?[{frameId:0,documentId:nativeScope.document_id,documentLifecycle:'active'}]:[{frameId:0,documentId:'replacement-document',documentLifecycle:'active',url:'PRIVATE_URL'}];},getFrame:async args=>{calls.push(['frame',args]);if(kind==='frameError')throw TypeError('PRIVATE_TOKEN_FAILURE');return kind==='missing'?null:{documentId:kind==='mismatch'?'foreign-document':nativeScope.document_id,documentLifecycle:kind==='active'?'active':kind};}}};
 const r=await core.observeStoredDocument(nativeScope,ch);
 assert.equal(r.classification,kind==='active'?'ACTIVE_MATCH':['cached','prerender','pending_deletion'].includes(kind)?'INACTIVE_MATCH':kind==='missing'?'NOT_RETURNED':['allFramesError','frameError'].includes(kind)?'QUERY_ERROR':'UNCONFIRMED');
 assert.equal(r.disappearanceProven,false);assert.equal(r.nativeIdentityVerified,false);assert.equal(r.mutationAllowed,false);assert(!JSON.stringify(r).includes('PRIVATE_'));
 if(kind==='allFramesError')assert.equal(r.failureStage,'WEB_NAVIGATION_GET_ALL_FRAMES');
 if(kind==='frameError')assert.equal(r.failureStage,'WEB_NAVIGATION_GET_FRAME');
});

test('ENDING audit publishes stored tab/frame/document and native classification with no writes, Worker messages, or authentication',async()=>{
 const f=await stateFixture(),a=f.rows.metadata[2],b=f.rows.metadata[3];a.session_status='ENDING';f.rows.sessions[0].status='ENDING';f.rows.journal[0].desired='RELEASED';b.resolution='NONE';b.cleanup_pending=true;b.native_lifecycle='UNCONFIRMED';Object.assign(b.scope,nativeScope);
 await f.write(f.member,f.rows);let forbidden=0;
 f.env.chrome.runtime.sendMessage=()=>{forbidden++;throw Error('NO_WORKER');};f.env.fetch=()=>{forbidden++;throw Error('NO_HTTP');};
 f.env.chrome.webNavigation={getAllFrames:async()=>[],getFrame:async()=>null};
 const before=await allRows(f.dbs),authBefore=JSON.stringify(f.auth),r=await core.create(f.env).auditPendingState(request);
 assert.equal(r.gate,'UNKNOWN');assert.equal(r.session.status,'ENDING');assert.equal(r.bindings[0].cleanupPending,true);assert.equal(r.nativeDocuments[0].bindingId,b.scope.binding_id);assert.equal(r.nativeDocuments[0].tabId,17);assert.equal(r.nativeDocuments[0].frameId,0);assert.equal(r.nativeDocuments[0].documentId,'stored-document');assert.equal(r.nativeDocuments[0].classification,'NOT_RETURNED');assert.equal(r.nativeDocuments[0].disappearanceProven,false);
 assert.equal(before,await allRows(f.dbs));assert.equal(authBefore,JSON.stringify(f.auth));assert.equal(f.writes,0);assert.equal(forbidden,0);assert.equal(r.resources.pendingNativeCalls,0);
});

test('invalid stored scope and unavailable Native API cannot be classified as a gone document',async()=>{
 assert.equal((await core.observeStoredDocument({tab_id:17,frame_id:1,document_id:'d'},{})).reason,'STORED_DOCUMENT_SCOPE_INVALID');
 const r=await core.observeStoredDocument(nativeScope,{});assert.equal(r.classification,'UNCONFIRMED');assert.equal(r.reason,'NATIVE_READ_API_UNAVAILABLE');assert.equal(r.disappearanceProven,false);
});
